"""Stage 2 — Recipe Agent.

Takes the skeleton produced by Stage 1 and generates full recipes — ingredients,
instructions, and macros — one day at a time.  All days are dispatched in parallel
(bounded by a semaphore so we don't hammer the API rate limit).

The skeleton means each recipe call has a tight focus:
  - Cuisine is already decided → model doesn't have to balance it across the plan
  - Protein is already decided → no protein repetition logic needed here
  - Carb target (if cycling) is a concrete gram number, not a vague soft constraint
  - Keto / diet-type constraints are injected as hard rules, not hopes

Model: gpt-4 (or RECIPE_MODEL env override) — quality matters here.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any

import openai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Diet-type hard constraint injections
# ---------------------------------------------------------------------------

DIET_CONSTRAINTS: dict[str, str] = {
    "keto": (
        "KETO HARD RULES:\n"
        "  • Total carbs across ALL meals this day: UNDER 50g.\n"
        "  • At least 65% of calories must come from fat.\n"
        "  • No grains, bread, pasta, rice, legumes, or added sugar.\n"
        "  • Sweeteners must be keto-safe (stevia, erythritol) if used at all."
    ),
    "vegan": (
        "VEGAN HARD RULES:\n"
        "  • Zero animal products: no meat, poultry, seafood, dairy, eggs, honey.\n"
        "  • All protein must come from plants."
    ),
    "vegetarian": (
        "VEGETARIAN HARD RULES:\n"
        "  • No meat or seafood. Eggs and dairy are allowed."
    ),
    "paleo": (
        "PALEO HARD RULES:\n"
        "  • No grains, legumes, dairy, refined sugar, or processed oils.\n"
        "  • Focus on meat, fish, eggs, vegetables, fruits, nuts, seeds."
    ),
    "gluten-free": (
        "GLUTEN-FREE HARD RULES:\n"
        "  • No wheat, barley, rye, or regular oats.\n"
        "  • Verify soy sauce is tamari/GF, pasta is GF, etc."
    ),
}


def _get_diet_constraint_block(diet_type: str, dietary_restrictions: list[str]) -> str:
    """Build the hard constraint paragraph for this user's diet."""
    blocks = []
    dt = (diet_type or "").lower()
    for key, block in DIET_CONSTRAINTS.items():
        if key in dt or any(key in r.lower() for r in dietary_restrictions):
            blocks.append(block)
    return "\n\n".join(blocks)


# ---------------------------------------------------------------------------
# Per-day prompt builder
# ---------------------------------------------------------------------------

def _build_day_prompt(
    day_skeleton: dict,
    global_constraints: dict,
    day_index: int,
) -> tuple[str, str]:
    """Build system + user prompt for a single day's recipe generation."""

    calorie_goal: int = global_constraints.get("calorie_goal", 2000)
    protein_pct: int = global_constraints.get("macro_protein_pct", 30)
    carbs_pct: int = global_constraints.get("macro_carbs_pct", 40)
    fat_pct: int = global_constraints.get("macro_fat_pct", 30)
    dietary_restrictions: list = global_constraints.get("dietary_restrictions", [])
    disliked: list = global_constraints.get("disliked_ingredients", [])
    diet_type: str = global_constraints.get("diet_type", "")
    servings: int = global_constraints.get("servings_per_meal", 1)
    time_constraints: dict = global_constraints.get("time_constraints", {})
    appliances: list = global_constraints.get("appliances", [])
    prep_complexity: str = global_constraints.get("prep_complexity", "standard")

    # Carb cycling override
    carb_tier = day_skeleton.get("carb_tier")
    carb_label = day_skeleton.get("carb_label", "")
    carb_target = day_skeleton.get("carb_target_grams")

    # Macro gram targets from percentages
    protein_g = round((calorie_goal * protein_pct / 100) / 4)
    fat_g = round((calorie_goal * fat_pct / 100) / 9)
    if carb_target:
        carbs_g = carb_target
        # Recalculate calorie goal if carb cycling overrides carbs
        effective_calories = (protein_g * 4) + (carbs_g * 4) + (fat_g * 9)
    else:
        carbs_g = round((calorie_goal * carbs_pct / 100) / 4)
        effective_calories = calorie_goal

    # Meal-time calorie split
    meals_in_day = [m for m in day_skeleton.get("meals", []) if not m["meal_time"].startswith("snack")]
    snacks_in_day = [m for m in day_skeleton.get("meals", []) if m["meal_time"].startswith("snack")]
    snack_cal_each = round(effective_calories * 0.10) if snacks_in_day else 0
    remaining_cal = effective_calories - (snack_cal_each * len(snacks_in_day))

    cal_split = {}
    for mt in [m["meal_time"] for m in meals_in_day]:
        if mt == "breakfast":
            cal_split[mt] = round(remaining_cal * 0.25)
        elif mt == "lunch":
            cal_split[mt] = round(remaining_cal * 0.35)
        elif mt == "dinner":
            cal_split[mt] = round(remaining_cal * 0.40)
        else:
            cal_split[mt] = round(remaining_cal / max(len(meals_in_day), 1))

    diet_constraint_block = _get_diet_constraint_block(diet_type, dietary_restrictions)
    disliked_str = ", ".join(disliked) if disliked else "None"
    restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "None"
    appliances_str = ", ".join(appliances) if appliances else "None"

    # ---- system prompt ----
    system_lines = [
        f"You are a professional chef generating recipes for Day {day_index + 1} of a meal plan.",
        "",
        "ABSOLUTE RULES — violations will cause regeneration:",
        f"  • NEVER use these ingredients: {disliked_str}",
        f"  • Follow ALL dietary restrictions: {restrictions_str}",
        f"  • Prep complexity: {prep_complexity} — match this level.",
        f"  • Available appliances: {appliances_str}",
    ]

    if diet_constraint_block:
        system_lines += ["", diet_constraint_block]

    if carb_label:
        system_lines += [
            "",
            f"⚡ THIS IS A {carb_label} ⚡",
            f"  Total carbs across all meals today: {carbs_g}g (target).",
            "  Distribute carb budget proportionally across meal times.",
        ]

    system_lines += [
        "",
        "NUTRITION TARGETS FOR TODAY:",
        f"  • Total calories: ~{effective_calories} kcal",
        f"  • Protein: ~{protein_g}g  |  Carbs: ~{carbs_g}g  |  Fat: ~{fat_g}g",
        "",
        "PER-MEAL CALORIE TARGETS:",
    ]
    for mt, cal in cal_split.items():
        system_lines.append(f"  • {mt.capitalize()}: ~{cal} kcal")
    if snacks_in_day:
        system_lines.append(f"  • Each snack: ~{snack_cal_each} kcal")

    system_lines += [
        "",
        "INGREDIENT UNITS — MANDATORY RULES:",
        "  • Every ingredient MUST have a unit. Use standardized units: cup, tbsp, tsp, oz, lb, g, slice, clove, can, bunch, pinch, dash.",
        "  • quantity must be a number only (e.g. '2', '0.5', '1/4'). NEVER embed the unit in the quantity field.",
        "  • unit must be a measurement word only (e.g. 'cup', 'tbsp', 'oz', 'lb'). NEVER leave it blank.",
        "  • Exception: countable whole items (eggs, bananas, tortillas, bagels) may use unit='' with a whole-number quantity.",
        "  • BAD:  {\"name\": \"lean ground beef\", \"quantity\": \"1\", \"unit\": \"\"}",
        "  • GOOD: {\"name\": \"lean ground beef\", \"quantity\": \"1\", \"unit\": \"lb\"}",
        "  • BAD:  {\"name\": \"olive oil\", \"quantity\": \"2 tbsp\", \"unit\": \"\"}",
        "  • GOOD: {\"name\": \"olive oil\", \"quantity\": \"2\", \"unit\": \"tbsp\"}",
        "",
        "Return ONLY valid JSON matching the schema in the user message. No prose, no markdown fences.",
    ]
    system_prompt = "\n".join(system_lines)

    # ---- user prompt — one entry per meal slot ----
    meal_slots = []
    for meal in day_skeleton.get("meals", []):
        mt = meal["meal_time"]
        is_snack = mt.startswith("snack")
        tc_key = "weekday-" + mt if not is_snack else None
        tc_mins = time_constraints.get(tc_key, 30) if tc_key else 15

        slot: dict[str, Any] = {
            "meal_time": mt,
            "cuisine": meal.get("cuisine", ""),
            "primary_protein": meal.get("primary_protein", ""),
            "meal_format": meal.get("meal_format", ""),
            "servings": servings,
            "max_prep_plus_cook_minutes": tc_mins,
            "calorie_target": snack_cal_each if is_snack else cal_split.get(mt, round(effective_calories / 3)),
        }
        if carb_target:
            per_meal_carbs = round(carbs_g / max(len(meals_in_day) + len(snacks_in_day), 1))
            slot["carb_target_grams"] = per_meal_carbs
        meal_slots.append(slot)

    response_schema: dict[str, Any] = {
        "day_number": day_index + 1,
        "meals": [
            {
                "meal_time": s["meal_time"],
                "title": "GENERATE a unique, descriptive meal title",
                "ingredients": [
                    {"name": "str", "quantity": "str",
                     "unit": "REQUIRED measurement unit — e.g. 'lb', 'oz', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'fillet', 'clove', 'medium', 'large' — NEVER leave empty",
                     "calories": "int", "protein": "Xg", "carbs": "Xg", "fat": "Xg"}
                ],
                "instructions": ["Step 1", "Step 2", "Step 3"],
                "servings": servings,
                "prep_time_minutes": "int",
                "cook_time_minutes": "int",
                "macros": {
                    "perServing": {"calories": 0, "protein": "Xg", "carbs": "Xg", "fat": "Xg"},
                    "perMeal":    {"calories": 0, "protein": "Xg", "carbs": "Xg", "fat": "Xg"},
                },
            }
            for s in meal_slots
        ],
    }

    user_prompt = (
        f"Generate recipes for Day {day_index + 1}.\n\n"
        f"Meal slot specifications:\n{json.dumps(meal_slots, indent=2)}\n\n"
        f"Fill in the following JSON schema completely:\n{json.dumps(response_schema, indent=2)}"
    )

    return system_prompt, user_prompt


# ---------------------------------------------------------------------------
# Single-day runner (async, semaphore-bounded)
# ---------------------------------------------------------------------------

async def _run_day(
    day_skeleton: dict,
    global_constraints: dict,
    day_index: int,
    semaphore: asyncio.Semaphore,
    model: str,
    cursor,
    user_id: int,
) -> dict:
    """Generate recipes for one day. Runs inside a semaphore."""
    async with semaphore:
        system_prompt, user_prompt = _build_day_prompt(day_skeleton, global_constraints, day_index)
        t0 = time.time()
        tokens_used = 0
        last_exc = None

        for attempt in range(2):
            try:
                # openai library v0.x (synchronous) — wrap in executor for async context
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: openai.ChatCompletion.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user",   "content": user_prompt},
                        ],
                        max_tokens=2000,
                        temperature=0.4,
                        request_timeout=120,
                    ),
                )
                raw = response.choices[0].message.content.strip()
                tokens_used = response.usage.total_tokens if response.usage else 0
                break
            except Exception as exc:
                last_exc = exc
                logger.warning("recipe_agent day %d attempt %d failed: %s", day_index + 1, attempt + 1, exc)
                await asyncio.sleep(2)
        else:
            raise RuntimeError(f"recipe_agent: day {day_index + 1} failed after 2 attempts: {last_exc}") from last_exc

        duration_ms = int((time.time() - t0) * 1000)

        # Strip markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            day_result = json.loads(raw.strip())
        except json.JSONDecodeError as exc:
            logger.error("recipe_agent day %d JSON parse error: %s\nRaw: %.500s", day_index + 1, exc, raw)
            raise ValueError(f"Recipe agent day {day_index + 1} returned invalid JSON: {exc}") from exc

        _log_pipeline_stage(
            cursor=cursor,
            user_id=user_id,
            stage=f"recipe_day_{day_index + 1}",
            model=model,
            tokens=tokens_used,
            duration_ms=duration_ms,
            output=day_result,
        )

        logger.info(
            "recipe_agent: day %d done in %dms (%d tokens)",
            day_index + 1, duration_ms, tokens_used,
        )
        return day_result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run(
    skeleton: dict,
    global_constraints: dict,
    cursor,
    user_id: int,
) -> list[dict]:
    """
    Run the recipe agent for all days in parallel.

    Args:
        skeleton:            Output from skeleton_agent.run().
        global_constraints:  Dict built by pipeline_orchestrator._build_global_constraints().
        cursor:              Active psycopg2 cursor (for pipeline logging).
        user_id:             User id (for logging).

    Returns:
        List of day dicts in the existing meal plan format
        (day_number + meals array with full recipe data).
    """
    model = os.getenv("RECIPE_MODEL", "gpt-4o")
    max_parallel = int(os.getenv("MAX_PARALLEL_DAYS", "3"))
    semaphore = asyncio.Semaphore(max_parallel)

    days = skeleton.get("days", [])
    tasks = [
        _run_day(
            day_skeleton=day,
            global_constraints=global_constraints,
            day_index=i,
            semaphore=semaphore,
            model=model,
            cursor=cursor,
            user_id=user_id,
        )
        for i, day in enumerate(days)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Surface any per-day failures
    day_results = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.error("recipe_agent: day %d raised an exception: %s", i + 1, r)
            raise r
        day_results.append(r)

    return day_results


def _log_pipeline_stage(cursor, user_id, stage, model, tokens, duration_ms, output, error=None):
    """Write a row to generation_pipeline_log. Non-fatal if table doesn't exist yet."""
    if not os.getenv("PIPELINE_LOG_ENABLED", "true").lower() == "true":
        return
    try:
        cursor.execute(
            """
            INSERT INTO generation_pipeline_log
                (user_id, stage, model_used, tokens_used, duration_ms, stage_output, success, error_message)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id, stage, model, tokens, duration_ms,
                json.dumps(output), error is None, str(error) if error else None,
            ),
        )
    except Exception as exc:
        logger.debug("recipe_agent: pipeline log insert skipped: %s", exc)
