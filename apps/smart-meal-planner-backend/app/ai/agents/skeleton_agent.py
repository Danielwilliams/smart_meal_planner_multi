"""Stage 1 — Skeleton Agent.

Assigns cuisine, primary protein, meal format, and (when carb cycling is enabled)
a daily carb tier to every meal slot before any full recipes are written.

Keeping this separate from recipe generation means:
- The recipe agent receives hard structural constraints (cuisine, protein, carb target)
  instead of soft prompt suggestions.
- Variety is enforced at the plan level, not hoped for in a single monolithic prompt.
- The model used here is cheap/fast (gpt-3.5-turbo) because the output is lightweight JSON.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import date, timedelta
from typing import Any

import openai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cuisine and format pools — used to build the diversity constraint prompt
# ---------------------------------------------------------------------------

CUISINE_POOL = [
    "Mediterranean", "Asian", "Mexican", "Italian", "American",
    "Thai", "Indian", "Japanese", "Middle Eastern", "Greek",
    "French", "Korean", "Vietnamese", "Moroccan", "Spanish",
]

MEAL_FORMATS = {
    "breakfast": ["scramble", "bowl", "smoothie", "toast", "oatmeal", "frittata", "wrap", "pancakes"],
    "lunch":     ["salad", "wrap", "bowl", "sandwich", "soup", "stir-fry", "tacos", "plate"],
    "dinner":    ["stir-fry", "roasted", "pasta", "tacos", "curry", "grill", "bake", "one-pot", "skillet"],
    "snack":     ["dip-and-veg", "smoothie", "energy-bites", "fruit-and-nut", "yogurt-parfait"],
}

CARB_TIER_LABELS = {
    "high":     "HIGH CARB DAY",
    "moderate": "MODERATE CARB DAY",
    "low":      "LOW CARB DAY",
    "no_carb":  "VERY LOW CARB DAY",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_preferred_cuisines(prefs: dict) -> list[str]:
    """Pull the user's preferred cuisine list from recipe_type."""
    raw = prefs.get("recipe_type") or ""
    if isinstance(raw, str):
        cuisines = [c.strip() for c in raw.split(",") if c.strip()]
    elif isinstance(raw, list):
        cuisines = [str(c).strip() for c in raw if c]
    else:
        cuisines = []
    return cuisines if cuisines else CUISINE_POOL[:7]


def _flatten_proteins(prefs: dict) -> list[str]:
    """Return the user's preferred protein list (readable names)."""
    protein_data = prefs.get("preferred_proteins") or {}
    other_data = prefs.get("other_proteins") or {}
    result = []
    name_map = {
        "dairy_milk": "Milk", "dairy_yogurt": "Yogurt",
        "protein_powder_whey": "Whey Protein", "protein_powder_pea": "Pea Protein",
    }
    for category, proteins in protein_data.items():
        if not isinstance(proteins, dict):
            continue
        for key, selected in proteins.items():
            if not selected:
                continue
            if key == "other":
                custom = other_data.get(category, "")
                if custom:
                    result.extend([p.strip() for p in custom.split(",") if p.strip()])
            else:
                result.append(name_map.get(key, key.replace("_", " ").title()))
    return result


def _carb_schedule(prefs: dict, days: int) -> list[dict | None]:
    """
    Return a list of per-day carb info dicts, or None entries if carb cycling is off.

    Each entry (when cycling is on):
        {"tier": "high", "label": "HIGH CARB DAY", "target_grams": 220}
    """
    if not prefs.get("carb_cycling_enabled"):
        return [None] * days

    config = prefs.get("carb_cycling_config") or {}
    schedule = config.get("weekly_schedule") or {}
    ranges = config.get("carb_ranges") or {}

    # Default midpoints per tier
    default_grams = {"high": 225, "moderate": 112, "low": 50, "no_carb": 12}

    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    today_weekday = date.today().weekday()  # 0 = Monday

    result = []
    for i in range(days):
        weekday_name = day_names[(today_weekday + i) % 7]
        tier = schedule.get(weekday_name, "moderate")

        tier_range = ranges.get(tier, {})
        lo = tier_range.get("min", default_grams.get(tier, 100))
        hi = tier_range.get("max", lo + 50)
        target = round((lo + hi) / 2)

        # Allow user-specified exact grams to override midpoint
        field_map = {
            "high": "high_carb_grams",
            "moderate": "moderate_carb_grams",
            "low": "low_carb_grams",
            "no_carb": "no_carb_grams",
        }
        explicit = config.get(field_map.get(tier, ""))
        if explicit:
            target = int(explicit)

        result.append({
            "tier": tier,
            "label": CARB_TIER_LABELS.get(tier, tier.upper()),
            "target_grams": target,
        })
    return result


def _get_recent_ingredients(cursor, user_id: int, days: int = 3) -> list[str]:
    """Query ingredient_usage_log for the cooldown window."""
    try:
        cursor.execute(
            """
            SELECT DISTINCT ingredient_name
            FROM ingredient_usage_log
            WHERE user_id = %s
              AND used_on_date >= CURRENT_DATE - INTERVAL '%s days'
            ORDER BY ingredient_name
            """,
            (user_id, days),
        )
        rows = cursor.fetchall()
        if rows and isinstance(rows[0], dict):
            return [r["ingredient_name"] for r in rows]
        return [r[0] for r in rows]
    except Exception as exc:
        logger.warning("skeleton_agent: could not fetch ingredient cooldown list: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _build_prompts(
    prefs: dict,
    days: int,
    meal_times: list[str],
    snacks_per_day: int,
    preferred_cuisines: list[str],
    preferred_proteins: list[str],
    carb_schedule: list[dict | None],
    ingredient_blocklist: list[str],
    diet_type: str,
) -> tuple[str, str]:

    carb_cycling_on = any(c is not None for c in carb_schedule)

    # ---- system prompt ----
    system_lines = [
        "You are a meal plan skeleton generator. Your ONLY job is to assign metadata "
        "(cuisine, primary protein, meal format) to each meal slot. "
        "Do NOT write full recipes, ingredients, or instructions — only the skeleton.",
        "",
        "CUISINE DIVERSITY RULES:",
        f"  • Use at least {min(len(preferred_cuisines), 4)} different cuisines across the plan.",
        "  • No single cuisine may appear more than 40% of the time.",
        "  • Vary cuisines across days — never repeat the same cuisine two days in a row for the same meal time.",
        "",
        "PROTEIN ROTATION RULES:",
        "  • Never assign the same primary protein to the same meal time on consecutive days.",
        "  • Spread proteins evenly across the week.",
        "",
        "FORMAT VARIETY RULES:",
        "  • Never assign the same meal format on consecutive days for the same meal time.",
        "  • meal_format MUST be appropriate for the meal_time — use only these options:",
        "      breakfast → scramble, bowl, toast, oatmeal, frittata, wrap, pancakes, smoothie-bowl, yogurt-parfait",
        "      lunch     → salad, wrap, bowl, sandwich, soup, stir-fry, tacos, plate",
        "      dinner    → stir-fry, roasted, pasta, tacos, curry, grill, bake, one-pot, skillet",
        "      snack     → dip-and-veg, smoothie, energy-bites, fruit-and-nut, yogurt-parfait",
        "  • NEVER assign a breakfast format (e.g. yogurt-parfait, oatmeal) to lunch or dinner.",
    ]

    if carb_cycling_on:
        system_lines += [
            "",
            "CARB CYCLING RULES:",
            "  • Each day has a carb tier assigned — HIGH, MODERATE, LOW, or VERY LOW.",
            "  • On HIGH carb days: favour grains, legumes, starchy vegetables.",
            "  • On LOW / VERY LOW carb days: favour proteins, non-starchy veg, healthy fats.",
            "  • The skeleton MUST record the tier and gram target for each day.",
        ]

    if diet_type and diet_type.lower() not in ("mixed", ""):
        system_lines += [
            "",
            f"DIET TYPE: {diet_type.upper()}",
            "  • All cuisine and protein assignments must be compatible with this diet.",
        ]

    system_lines += [
        "",
        'Return ONLY valid JSON matching the schema in the user message. No prose, no markdown fences.',
    ]

    system_prompt = "\n".join(system_lines)

    # ---- user prompt ----
    day_blocks = []
    for d in range(days):
        carb = carb_schedule[d]
        day_entry: dict[str, Any] = {"day_number": d + 1, "meals": []}
        if carb:
            day_entry["carb_tier"] = carb["tier"]
            day_entry["carb_label"] = carb["label"]
            day_entry["carb_target_grams"] = carb["target_grams"]
        for mt in meal_times:
            day_entry["meals"].append({
                "meal_time": mt,
                "cuisine": "ASSIGN",
                "primary_protein": "ASSIGN",
                "meal_format": "ASSIGN",
            })
        if snacks_per_day > 0:
            for s in range(snacks_per_day):
                day_entry["meals"].append({
                    "meal_time": f"snack_{s + 1}",
                    "cuisine": "ASSIGN",
                    "primary_protein": "ASSIGN",
                    "meal_format": "ASSIGN",
                })
        day_blocks.append(day_entry)

    blocklist_str = (
        ", ".join(ingredient_blocklist[:30]) if ingredient_blocklist else "None"
    )
    protein_str = ", ".join(preferred_proteins) if preferred_proteins else "Any"
    cuisine_str = ", ".join(preferred_cuisines)

    user_prompt = f"""Fill in all "ASSIGN" values in the skeleton below.

PREFERRED CUISINES (prioritise these): {cuisine_str}
PREFERRED PROTEINS (prioritise these): {protein_str}
INGREDIENT COOLDOWN — do NOT make these the primary protein or base ingredient (used in last 3 days): {blocklist_str}
DIET TYPE: {diet_type or 'Mixed'}

Replace every "ASSIGN" with an appropriate value. Keep all other fields exactly as provided.

Return this exact JSON structure with all ASSIGN values filled:
{json.dumps({"days": day_blocks}, indent=2)}
"""

    return system_prompt, user_prompt


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run(
    prefs: dict,
    days: int,
    meal_times: list[str],
    snacks_per_day: int,
    user_id: int,
    cursor,
    diet_type: str = "",
) -> dict:
    """
    Run the skeleton agent.

    Args:
        prefs:          Full user_profiles row (dict).
        days:           Number of days in the plan.
        meal_times:     List of meal time strings e.g. ["breakfast", "lunch", "dinner"].
        snacks_per_day: Number of snacks per day.
        user_id:        Used to look up ingredient cooldown list.
        cursor:         Active psycopg2 cursor (dict or regular).
        diet_type:      User's diet type string e.g. "Keto", "Vegan".

    Returns:
        Skeleton dict with shape {"days": [ {day_number, carb_tier?, meals: [...]} ]}
    """
    preferred_cuisines = _extract_preferred_cuisines(prefs)
    preferred_proteins = _flatten_proteins(prefs)
    carb_sched = _carb_schedule(prefs, days)
    blocklist = _get_recent_ingredients(cursor, user_id)

    system_prompt, user_prompt = _build_prompts(
        prefs=prefs,
        days=days,
        meal_times=meal_times,
        snacks_per_day=snacks_per_day,
        preferred_cuisines=preferred_cuisines,
        preferred_proteins=preferred_proteins,
        carb_schedule=carb_sched,
        ingredient_blocklist=blocklist,
        diet_type=diet_type,
    )

    model = os.getenv("SKELETON_MODEL", "gpt-4o-mini")
    t0 = time.time()
    tokens_used = 0

    try:
        response = openai.ChatCompletion.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            max_tokens=800,
            temperature=0.7,
            request_timeout=60,
        )
        raw = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as exc:
        logger.error("skeleton_agent: OpenAI call failed: %s", exc)
        raise

    duration_ms = int((time.time() - t0) * 1000)

    # Parse JSON — strip markdown fences if model wrapped it
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        skeleton = json.loads(raw.strip())
    except json.JSONDecodeError as exc:
        logger.error("skeleton_agent: could not parse JSON response: %s\nRaw: %s", exc, raw[:500])
        raise ValueError(f"Skeleton agent returned invalid JSON: {exc}") from exc

    # Attach the computed carb schedule data so downstream agents don't re-derive it
    for i, day in enumerate(skeleton.get("days", [])):
        carb = carb_sched[i] if i < len(carb_sched) else None
        if carb and "carb_tier" not in day:
            day["carb_tier"] = carb["tier"]
            day["carb_label"] = carb["label"]
            day["carb_target_grams"] = carb["target_grams"]

    _log_pipeline_stage(
        cursor=cursor,
        user_id=user_id,
        stage="skeleton",
        model=model,
        tokens=tokens_used,
        duration_ms=duration_ms,
        output=skeleton,
    )

    logger.info(
        "skeleton_agent: done in %dms, %d tokens, %d days assigned",
        duration_ms, tokens_used, len(skeleton.get("days", [])),
    )
    return skeleton


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
        logger.debug("skeleton_agent: pipeline log insert skipped: %s", exc)
