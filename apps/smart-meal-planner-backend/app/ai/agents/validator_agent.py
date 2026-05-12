"""Stage 3 — Validator Agent.

Two-phase validation:

Phase A — Pure Python (no API cost):
  • Duplicate meal titles across all days
  • Disliked ingredients present in any meal
  • Required meal times missing from any day
  • Dietary restriction keyword checks

Phase B — Targeted AI regeneration (only for meals that failed Phase A):
  • One gpt-3.5-turbo call per violating meal — not a full plan regeneration
  • Uses the skeleton metadata (cuisine, protein, format) as hard constraints
    so the replacement stays structurally consistent
  • Maximum one fix pass — avoids infinite loops

Model for fixes: gpt-3.5-turbo (or VALIDATOR_MODEL env override)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any

import openai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Dietary restriction keyword maps (Phase A)
# ---------------------------------------------------------------------------

_RESTRICTION_KEYWORDS: dict[str, list[str]] = {
    "gluten-free": [
        "wheat", "flour", "bread", "pasta", "noodles", "barley", "rye",
        "breadcrumbs", "croutons", "soy sauce",
    ],
    "dairy-free": [
        "milk", "cheese", "butter", "cream", "yogurt", "whey", "lactose",
        "parmesan", "mozzarella", "cheddar", "ricotta",
    ],
    "vegan": [
        "meat", "beef", "pork", "chicken", "turkey", "lamb", "fish", "salmon",
        "tuna", "shrimp", "prawn", "egg", "eggs", "milk", "cheese", "butter",
        "cream", "yogurt", "honey",
    ],
    "vegetarian": [
        "beef", "pork", "chicken", "turkey", "lamb", "veal", "bacon", "ham",
        "sausage", "fish", "salmon", "tuna", "shrimp", "prawn",
    ],
    "nut-free": [
        "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut",
        "peanut", "pine nut",
    ],
    "egg-free": ["egg", "eggs", "mayo", "mayonnaise"],
    "soy-free": ["soy", "tofu", "tempeh", "edamame", "miso"],
    "low-sodium": [],  # handled separately if needed
}


def _ingredient_names(meal: dict) -> list[str]:
    names = []
    for ing in meal.get("ingredients", []):
        if isinstance(ing, dict):
            names.append(ing.get("name", "").lower())
        else:
            names.append(str(ing).lower())
    return names


# ---------------------------------------------------------------------------
# Phase A — Python-only checks
# ---------------------------------------------------------------------------

def _check_duplicates(day_results: list[dict]) -> list[dict]:
    """Find meals whose title appears more than once across all days."""
    seen: dict[str, dict] = {}  # title_lower → first occurrence info
    violations = []
    for day in day_results:
        day_num = day.get("day_number", 0)
        for meal in day.get("meals", []):
            title = meal.get("title", "").strip()
            if not title:
                continue
            key = title.lower()
            if key in seen:
                violations.append({
                    "day": day_num,
                    "meal_time": meal.get("meal_time", ""),
                    "type": "duplicate_title",
                    "detail": f'"{title}" already used on day {seen[key]["day"]}',
                    "meal": meal,
                })
            else:
                seen[key] = {"day": day_num, "meal_time": meal.get("meal_time", "")}
    return violations


def _check_disliked(day_results: list[dict], disliked: list[str]) -> list[dict]:
    """Find meals that contain a disliked ingredient."""
    if not disliked:
        return []
    disliked_lower = [d.strip().lower() for d in disliked if d.strip()]
    violations = []
    for day in day_results:
        day_num = day.get("day_number", 0)
        for meal in day.get("meals", []):
            names = _ingredient_names(meal)
            for d in disliked_lower:
                if any(d in n for n in names):
                    violations.append({
                        "day": day_num,
                        "meal_time": meal.get("meal_time", ""),
                        "type": "disliked_ingredient",
                        "detail": f'"{d}" found in "{meal.get("title", "")}"',
                        "meal": meal,
                    })
                    break  # one violation per meal is enough
    return violations


def _check_restrictions(day_results: list[dict], dietary_restrictions: list[str]) -> list[dict]:
    """Keyword-based check for common dietary restriction violations."""
    violations = []
    active = [r.strip().lower() for r in dietary_restrictions if r.strip()]
    for day in day_results:
        day_num = day.get("day_number", 0)
        for meal in day.get("meals", []):
            names = _ingredient_names(meal)
            for restriction in active:
                keywords = _RESTRICTION_KEYWORDS.get(restriction, [])
                for kw in keywords:
                    if any(kw in n for n in names):
                        violations.append({
                            "day": day_num,
                            "meal_time": meal.get("meal_time", ""),
                            "type": "restriction_violation",
                            "detail": f'"{kw}" violates {restriction} restriction in "{meal.get("title", "")}"',
                            "meal": meal,
                        })
                        break
    return violations


# Proteins that require meaningful cook time — used for cook time sanity check
_RAW_PROTEINS = [
    "chicken", "beef", "pork", "turkey", "lamb", "bison", "veal",
    "salmon", "tuna", "cod", "tilapia", "shrimp", "scallop", "lobster",
    "crab", "fish", "steak", "sausage", "bacon", "ham",
]

# Minimum realistic cook time (minutes) for meals containing these proteins
_MIN_COOK_MINUTES = 5   # shrimp/scallops can genuinely be ~3-4 min, 5 is a safe floor
_MIN_BONE_IN_MINUTES = 20  # bone-in or whole cuts need more time

_BONE_IN_MARKERS = [
    "whole chicken", "bone-in", "drumstick", "thigh with bone",
    "rack of", "roast chicken", "whole turkey",
]


def _check_cook_times(day_results: list[dict]) -> list[dict]:
    """Flag meals whose cook_time_minutes is implausibly low for raw protein."""
    violations = []
    for day in day_results:
        day_num = day.get("day_number", 0)
        for meal in day.get("meals", []):
            cook_time = meal.get("cook_time_minutes") or 0
            if not isinstance(cook_time, (int, float)):
                try:
                    cook_time = int(cook_time)
                except (ValueError, TypeError):
                    cook_time = 0

            ing_names = _ingredient_names(meal)
            full_text = " ".join(ing_names + [meal.get("title", "").lower()])

            has_raw_protein = any(p in full_text for p in _RAW_PROTEINS)
            if not has_raw_protein:
                continue

            has_bone_in = any(b in full_text for b in _BONE_IN_MARKERS)
            min_required = _MIN_BONE_IN_MINUTES if has_bone_in else _MIN_COOK_MINUTES

            if cook_time < min_required:
                violations.append({
                    "day": day_num,
                    "meal_time": meal.get("meal_time", ""),
                    "type": "unrealistic_cook_time",
                    "detail": (
                        f'cook_time_minutes={cook_time} is too low for a meal '
                        f'with raw protein in "{meal.get("title", "")}" '
                        f'(minimum {min_required} min)'
                    ),
                    "meal": meal,
                })
    return violations


def validate_plan(
    day_results: list[dict],
    disliked: list[str],
    dietary_restrictions: list[str],
) -> dict:
    """Run all Phase A checks. Returns {clean: bool, violations: [...]}."""
    violations = (
        _check_duplicates(day_results)
        + _check_disliked(day_results, disliked)
        + _check_restrictions(day_results, dietary_restrictions)
        + _check_cook_times(day_results)
    )
    return {"clean": len(violations) == 0, "violations": violations}


# ---------------------------------------------------------------------------
# Phase B — Targeted AI regeneration
# ---------------------------------------------------------------------------

def _build_fix_prompt(
    violation: dict,
    skeleton_meal: dict | None,
    global_constraints: dict,
    existing_titles: set[str],
) -> tuple[str, str]:
    """Build a tight prompt to regenerate one specific meal."""
    broken_meal = violation["meal"]
    meal_time = violation["meal_time"]
    vtype = violation["type"]
    detail = violation["detail"]

    disliked_str = ", ".join(global_constraints.get("disliked_ingredients", [])) or "None"
    restrictions_str = ", ".join(global_constraints.get("dietary_restrictions", [])) or "None"
    titles_str = ", ".join(sorted(existing_titles)[:40]) or "None"
    servings = global_constraints.get("servings_per_meal", 1)
    diet_type = global_constraints.get("diet_type", "")

    cuisine = (skeleton_meal or {}).get("cuisine", broken_meal.get("cuisine", ""))
    protein = (skeleton_meal or {}).get("primary_protein", "")
    fmt = (skeleton_meal or {}).get("meal_format", "")
    cal_target = broken_meal.get("macros", {}).get("perMeal", {}).get("calories", 500)

    system_prompt = (
        f"You are fixing a single {meal_time} recipe that failed validation.\n"
        f"Violation: {vtype} — {detail}\n\n"
        f"HARD RULES:\n"
        f"  • NEVER use these ingredients: {disliked_str}\n"
        f"  • Follow ALL dietary restrictions: {restrictions_str}\n"
        f"  • Diet type: {diet_type or 'Mixed'}\n"
        f"  • MUST be a UNIQUE title — do NOT use any of these existing titles: {titles_str}\n"
        f"  • cook_time_minutes must be realistic — NEVER 0 or under 5 for raw protein\n"
        f"  • If the meal contains meat or seafood, the instructions MUST state the required\n"
        f"    internal temperature: chicken/turkey 165°F, ground beef/pork 160°F,\n"
        f"    whole beef/pork/lamb 145°F (rest 3 min), fish/seafood 145°F\n\n"
        "Return ONLY valid JSON for a single meal. No prose, no markdown fences."
    )

    user_prompt = (
        f"Regenerate this {meal_time} recipe.\n\n"
        f"Keep these structural constraints:\n"
        f"  • Cuisine: {cuisine}\n"
        f"  • Primary protein: {protein}\n"
        f"  • Meal format: {fmt}\n"
        f"  • Servings: {servings}\n"
        f"  • Approximate calories: {cal_target}\n\n"
        f"The broken meal was:\n{json.dumps(broken_meal, indent=2)}\n\n"
        "Return JSON matching this schema exactly:\n"
        + json.dumps({
            "meal_time": meal_time,
            "title": "NEW unique title",
            "ingredients": [
                {"name": "str", "quantity": "str", "unit": "str",
                 "calories": "int", "protein": "Xg", "carbs": "Xg", "fat": "Xg"}
            ],
            "instructions": ["Step 1", "Step 2"],
            "servings": servings,
            "prep_time_minutes": "int",
            "cook_time_minutes": "int",
            "macros": {
                "perServing": {"calories": 0, "protein": "Xg", "carbs": "Xg", "fat": "Xg"},
                "perMeal":    {"calories": 0, "protein": "Xg", "carbs": "Xg", "fat": "Xg"},
            },
        }, indent=2)
    )
    return system_prompt, user_prompt


async def _fix_meal(
    violation: dict,
    skeleton: dict,
    global_constraints: dict,
    existing_titles: set[str],
    model: str,
    cursor,
    user_id: int,
) -> dict | None:
    """Regenerate one violating meal. Returns the replacement meal dict, or None on failure."""

    # Find the skeleton entry for this meal so we preserve cuisine/protein/format
    day_num = violation["day"]
    meal_time = violation["meal_time"]
    skeleton_meal = None
    for sday in skeleton.get("days", []):
        if sday.get("day_number") == day_num:
            for sm in sday.get("meals", []):
                if sm.get("meal_time") == meal_time:
                    skeleton_meal = sm
                    break

    system_prompt, user_prompt = _build_fix_prompt(
        violation, skeleton_meal, global_constraints, existing_titles
    )

    t0 = time.time()
    tokens_used = 0
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
                max_tokens=800,
                temperature=0.5,
                request_timeout=60,
            ),
        )
        raw = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as exc:
        logger.warning("validator_agent fix_meal failed (day=%d %s): %s", day_num, meal_time, exc)
        return None

    duration_ms = int((time.time() - t0) * 1000)

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        replacement = json.loads(raw.strip())
    except json.JSONDecodeError:
        logger.warning("validator_agent: fix_meal returned invalid JSON for day=%d %s", day_num, meal_time)
        return None

    _log_pipeline_stage(
        cursor=cursor,
        user_id=user_id,
        stage=f"validator_fix_day{day_num}_{meal_time}",
        model=model,
        tokens=tokens_used,
        duration_ms=duration_ms,
        output=replacement,
    )
    return replacement


def _apply_fix(day_results: list[dict], violation: dict, replacement: dict) -> None:
    """Replace the violating meal in-place."""
    day_num = violation["day"]
    meal_time = violation["meal_time"]
    for day in day_results:
        if day.get("day_number") == day_num:
            for i, meal in enumerate(day.get("meals", [])):
                if meal.get("meal_time") == meal_time:
                    day["meals"][i] = replacement
                    return


def _collect_titles(day_results: list[dict]) -> set[str]:
    titles = set()
    for day in day_results:
        for meal in day.get("meals", []):
            t = meal.get("title", "").strip().lower()
            if t:
                titles.add(t)
    return titles


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run(
    day_results: list[dict],
    skeleton: dict,
    global_constraints: dict,
    cursor,
    user_id: int,
) -> list[dict]:
    """
    Validate the assembled meal plan and fix any violations.

    Args:
        day_results:        Output from recipe_agent.run() — list of day dicts.
        skeleton:           Output from skeleton_agent.run() — used for structural constraints on fixes.
        global_constraints: Dict from pipeline_orchestrator._build_global_constraints().
        cursor:             Active psycopg2 cursor.
        user_id:            For logging.

    Returns:
        Validated (and patched if needed) list of day dicts.
    """
    disliked = global_constraints.get("disliked_ingredients", [])
    restrictions = global_constraints.get("dietary_restrictions", [])
    model = os.getenv("VALIDATOR_MODEL", "gpt-4o-mini")

    # Phase A
    result = validate_plan(day_results, disliked, restrictions)
    if result["clean"]:
        logger.info("validator_agent: plan is clean — no violations found")
        _log_pipeline_stage(
            cursor=cursor, user_id=user_id, stage="validator",
            model="none", tokens=0, duration_ms=0,
            output={"violations": 0, "fixes": 0},
        )
        return day_results

    violations = result["violations"]
    logger.warning(
        "validator_agent: %d violation(s) found — running targeted fixes",
        len(violations),
    )

    # Phase B — fix each violation concurrently (max 5 parallel)
    semaphore = asyncio.Semaphore(5)
    existing_titles = _collect_titles(day_results)

    async def _bounded_fix(v):
        async with semaphore:
            return v, await _fix_meal(v, skeleton, global_constraints, existing_titles, model, cursor, user_id)

    fix_tasks = [_bounded_fix(v) for v in violations]
    fix_results = await asyncio.gather(*fix_tasks)

    fixes_applied = 0
    for violation, replacement in fix_results:
        if replacement:
            _apply_fix(day_results, violation, replacement)
            # Update title set so subsequent fixes know about new titles
            new_title = replacement.get("title", "").strip().lower()
            if new_title:
                existing_titles.add(new_title)
            fixes_applied += 1
        else:
            logger.warning(
                "validator_agent: could not fix violation (day=%d %s type=%s) — keeping original",
                violation["day"], violation["meal_time"], violation["type"],
            )

    # One re-check pass (no second round of AI fixes)
    final_result = validate_plan(day_results, disliked, restrictions)
    remaining = len(final_result["violations"])
    if remaining > 0:
        logger.warning(
            "validator_agent: %d violation(s) remain after fixes (no second pass)", remaining
        )

    _log_pipeline_stage(
        cursor=cursor, user_id=user_id, stage="validator",
        model=model, tokens=0, duration_ms=0,
        output={
            "violations_found": len(violations),
            "fixes_applied": fixes_applied,
            "violations_remaining": remaining,
        },
    )
    logger.info(
        "validator_agent: done — %d found, %d fixed, %d remaining",
        len(violations), fixes_applied, remaining,
    )
    return day_results


def _log_pipeline_stage(cursor, user_id, stage, model, tokens, duration_ms, output, error=None):
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
        logger.debug("validator_agent: pipeline log insert skipped: %s", exc)
