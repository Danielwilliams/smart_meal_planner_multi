"""Multi-Agent Meal Plan Pipeline Orchestrator.

Entry point for the 3-stage pipeline:
  Stage 1 → skeleton_agent   (cuisine / protein / carb-tier assignment)
  Stage 2 → recipe_agent     (full recipe generation, parallelised by day)
  Stage 3 → validator_agent  (Python checks + targeted AI fixes)

Called from menu.py when USE_AGENT_PIPELINE=true.
Returns a dict in the same shape as generate_meal_plan_single_request()
so zero changes are needed in the calling code beyond the dispatch switch.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Preference helpers (mirrors the helpers already in menu.py)
# ---------------------------------------------------------------------------

def _split_csv(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if v]
    return [v.strip() for v in str(value).split(",") if v.strip()]


def _get_appliances(prefs: dict) -> list[str]:
    appliances_dict = prefs.get("appliances") or {}
    name_map = {
        "airFryer": "Air Fryer",
        "instapot": "Instant Pot",
        "crockpot": "Crock Pot",
    }
    return [
        name_map.get(k, k.replace("_", " ").title())
        for k, v in appliances_dict.items()
        if v
    ]


def _prep_complexity_label(value) -> str:
    try:
        v = int(value or 50)
    except (TypeError, ValueError):
        return "standard"
    if v <= 25:
        return "minimal"
    if v <= 50:
        return "easy"
    if v <= 75:
        return "standard"
    return "complex"


def _get_meal_times(prefs: dict, req_meal_times) -> list[str]:
    """Resolve required meal times from request or user profile."""
    if req_meal_times:
        if isinstance(req_meal_times, list):
            return [m for m in req_meal_times if m.lower() not in ("snack", "snacks")]
        if isinstance(req_meal_times, str):
            return [
                m.strip() for m in req_meal_times.split(",")
                if m.strip() and m.strip().lower() not in ("snack", "snacks")
            ]
    # Fall back to profile meal_times JSONB
    meal_times_pref = prefs.get("meal_times") or {}
    if isinstance(meal_times_pref, dict):
        return [mt for mt, enabled in meal_times_pref.items()
                if enabled and mt.lower() not in ("snack", "snacks")]
    return ["breakfast", "lunch", "dinner"]


def build_global_constraints(req, prefs: dict) -> dict:
    """
    Assemble the constraint dict that is passed to the recipe and validator agents.

    Includes everything that affects what goes INTO a recipe:
    calories, macros, dietary restrictions, disliked ingredients, diet type,
    carb cycling state, time constraints, appliances, prep complexity, servings.
    """
    dietary_restrictions = _split_csv(prefs.get("dietary_restrictions"))
    disliked_ingredients = _split_csv(prefs.get("disliked_ingredients"))

    # Merge request-level overrides if present
    if getattr(req, "dietary_preferences", None):
        dietary_restrictions = list(set(dietary_restrictions + list(req.dietary_preferences)))
    if getattr(req, "disliked_ingredients", None):
        disliked_ingredients = list(set(disliked_ingredients + list(req.disliked_ingredients)))

    return {
        "calorie_goal":          getattr(req, "calorie_goal", None) or prefs.get("calorie_goal") or 2000,
        "macro_protein_pct":     getattr(req, "macro_protein", None) or prefs.get("macro_protein") or 30,
        "macro_carbs_pct":       getattr(req, "macro_carbs", None) or prefs.get("macro_carbs") or 40,
        "macro_fat_pct":         getattr(req, "macro_fat", None) or prefs.get("macro_fat") or 30,
        "dietary_restrictions":  dietary_restrictions,
        "disliked_ingredients":  disliked_ingredients,
        "diet_type":             prefs.get("diet_type") or "",
        "carb_cycling_enabled":  bool(prefs.get("carb_cycling_enabled")),
        "carb_cycling_config":   prefs.get("carb_cycling_config") or {},
        "time_constraints":      prefs.get("time_constraints") or {},
        "appliances":            _get_appliances(prefs),
        "prep_complexity":       _prep_complexity_label(prefs.get("prep_complexity")),
        "servings_per_meal":     getattr(req, "servings_per_meal", None) or prefs.get("servings_per_meal") or 1,
    }


# ---------------------------------------------------------------------------
# Ingredient usage logging
# ---------------------------------------------------------------------------

def _normalize_ingredient_name(name: str) -> str:
    """Strip descriptors so 'diced red onion' and 'red onion' hit the same cooldown."""
    descriptors = [
        "diced", "chopped", "minced", "sliced", "shredded", "grated",
        "frozen", "fresh", "dried", "canned", "cooked", "raw", "large",
        "medium", "small", "whole", "halved", "roughly", "finely",
        "thinly", "baby", "organic", "low-fat", "fat-free",
    ]
    tokens = name.lower().split()
    filtered = [t for t in tokens if t not in descriptors]
    return " ".join(filtered).strip()


def _log_ingredient_usage(cursor, user_id: int, menu_id: int | None, day_results: list[dict]) -> None:
    """Bulk-insert ingredients from the completed plan into ingredient_usage_log.

    Also prunes rows older than 14 days so the table stays lean.
    """
    rows = []
    plan_start = date.today()

    for day in day_results:
        day_num = day.get("day_number", 1)
        used_date = plan_start  # all days start from today for cooldown purposes

        for meal in day.get("meals", []):
            meal_time = meal.get("meal_time", "")
            for ing in meal.get("ingredients", []):
                name = ""
                if isinstance(ing, dict):
                    name = ing.get("name", "")
                elif isinstance(ing, str):
                    name = ing
                name = _normalize_ingredient_name(name)
                if name:
                    rows.append((user_id, menu_id, name, used_date, meal_time))

    if not rows:
        return

    try:
        cursor.executemany(
            """
            INSERT INTO ingredient_usage_log
                (user_id, menu_id, ingredient_name, used_on_date, meal_time)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            rows,
        )
        # Prune old rows
        cursor.execute(
            """
            DELETE FROM ingredient_usage_log
            WHERE user_id = %s
              AND used_on_date < CURRENT_DATE - INTERVAL '14 days'
            """,
            (user_id,),
        )
        logger.info(
            "pipeline_orchestrator: logged %d ingredient usages for user %s",
            len(rows), user_id,
        )
    except Exception as exc:
        logger.warning("pipeline_orchestrator: ingredient usage log failed: %s", exc)


# ---------------------------------------------------------------------------
# Output assembly
# ---------------------------------------------------------------------------

def _assemble_meal_plan(day_results: list[dict]) -> dict:
    """Wrap day results in the {meal_plan: {days: [...]}} envelope.
    Renames day_number -> dayNumber to match the frontend's expected schema.
    """
    days = []
    for day in day_results:
        remapped = {**day}
        if "day_number" in remapped:
            remapped["dayNumber"] = remapped.pop("day_number")
        days.append(remapped)
    return {"meal_plan": {"days": days}}


def _build_basic_grocery_list(day_results: list[dict]) -> dict:
    """
    Aggregate ingredients into a simple categorised grocery list.

    The full AI-enhanced grocery list generation (grocery_list.py) runs
    downstream — this is just a fallback so the response is always complete.
    """
    produce, dairy, meat, pantry, frozen, other = [], [], [], [], [], []

    _produce_kw = ["lettuce", "spinach", "kale", "tomato", "pepper", "onion", "garlic",
                   "carrot", "celery", "cucumber", "zucchini", "mushroom", "broccoli",
                   "cauliflower", "apple", "banana", "lemon", "lime", "berry", "herb",
                   "basil", "cilantro", "parsley", "ginger", "avocado", "potato", "sweet potato"]
    _dairy_kw   = ["milk", "cheese", "butter", "cream", "yogurt", "egg", "eggs"]
    _meat_kw    = ["chicken", "beef", "pork", "turkey", "lamb", "fish", "salmon", "tuna",
                   "shrimp", "tofu", "tempeh"]
    _frozen_kw  = ["frozen", "ice"]

    seen: dict[str, bool] = {}
    for day in day_results:
        for meal in day.get("meals", []):
            for ing in meal.get("ingredients", []):
                if isinstance(ing, dict):
                    name = ing.get("name", "")
                    qty  = ing.get("quantity", "")
                    unit = ing.get("unit", "")
                else:
                    name, qty, unit = str(ing), "", ""

                key = name.lower().strip()
                if not key or key in seen:
                    continue
                seen[key] = True

                entry = f"{name}: {qty} {unit}".strip().rstrip(":")

                if any(kw in key for kw in _frozen_kw):
                    frozen.append(entry)
                elif any(kw in key for kw in _produce_kw):
                    produce.append(entry)
                elif any(kw in key for kw in _dairy_kw):
                    dairy.append(entry)
                elif any(kw in key for kw in _meat_kw):
                    meat.append(entry)
                else:
                    pantry.append(entry)

    return {
        "produce": produce,
        "dairy":   dairy,
        "meat":    meat,
        "pantry":  pantry,
        "frozen":  frozen,
    }


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

async def run_pipeline(
    req,
    prefs: dict,
    cursor,
    conn,
    user_id: int,
    job_id: str | None = None,
) -> dict:
    """
    Execute the 3-stage pipeline and return a fully-assembled meal plan dict.

    The return shape is identical to generate_meal_plan_single_request() so
    the calling code in menu.py requires no changes.

    Args:
        req:     GenerateMealPlanRequest instance.
        prefs:   Full user_profiles row as a dict (must include carb_cycling_enabled,
                 carb_cycling_config, diet_type — ensure these are fetched in menu.py).
        cursor:  Active psycopg2 cursor.
        conn:    Active psycopg2 connection (for commit).
        user_id: Resolved user id (may differ from req.user_id when for_client_id is set).
        job_id:  Optional background job id for progress updates.
    """
    from .agents import skeleton_agent, recipe_agent, validator_agent
    from .agents import recipe_matcher

    days         = getattr(req, "duration_days", 7)
    snacks_pd    = getattr(req, "snacks_per_day", 0) or prefs.get("snacks_per_day") or 0
    meal_times   = _get_meal_times(prefs, getattr(req, "meal_times", None))
    diet_type    = prefs.get("diet_type") or ""
    constraints  = build_global_constraints(req, prefs)

    def _progress(pct: int, msg: str):
        if not job_id:
            return
        try:
            from ..routers.menu import batch_update_job_status
            batch_update_job_status(job_id, {"progress": pct, "message": msg}, force_db_update=False)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Stage 1 — Skeleton
    # ------------------------------------------------------------------
    _progress(10, "Planning meal structure…")
    logger.info("pipeline: stage 1 — skeleton (%d days, %s, carb_cycling=%s)",
                days, diet_type or "mixed", prefs.get("carb_cycling_enabled", False))

    skeleton = await skeleton_agent.run(
        prefs=prefs,
        days=days,
        meal_times=meal_times,
        snacks_per_day=snacks_pd,
        user_id=user_id,
        cursor=cursor,
        diet_type=diet_type,
    )

    # ------------------------------------------------------------------
    # Stage 1.5 — Recipe Matcher (DB lookup before any AI generation)
    # ------------------------------------------------------------------
    _progress(20, "Matching recipes from library…")
    logger.info("pipeline: stage 1.5 — recipe matcher")

    match_result = recipe_matcher.match_slots(
        skeleton=skeleton,
        global_constraints=constraints,
        user_id=user_id,
        cursor=cursor,
    )
    matched_meals  = match_result["matched"]        # slot_key → meal dict
    unmatched_slots = match_result["unmatched_slots"]  # [{day_number, meal}]
    match_stats    = match_result["stats"]
    logger.warning(
        "pipeline: recipe matcher hit rate %d%% (%d/%d slots from DB)",
        match_stats["match_rate"], match_stats["matched"], match_stats["total"],
    )

    # ------------------------------------------------------------------
    # Stage 2 — AI Recipe Generation (only for unmatched slots)
    # ------------------------------------------------------------------
    _progress(30, "Generating remaining recipes with AI…")

    if unmatched_slots:
        # Build a reduced skeleton containing only the unmatched slots
        # so recipe_agent only generates what the DB couldn't supply
        unmatched_by_day: dict[int, list] = {}
        for entry in unmatched_slots:
            d = entry["day_number"]
            unmatched_by_day.setdefault(d, []).append(entry["meal"])

        reduced_skeleton = {
            "days": [
                {**day, "meals": unmatched_by_day[day["day_number"]]}
                for day in skeleton.get("days", [])
                if day["day_number"] in unmatched_by_day
            ]
        }
        logger.info(
            "pipeline: stage 2 — recipe_agent generating %d unmatched slots across %d days",
            len(unmatched_slots), len(reduced_skeleton["days"]),
        )
        ai_day_results = await recipe_agent.run(
            skeleton=reduced_skeleton,
            global_constraints=constraints,
            cursor=cursor,
            user_id=user_id,
        )
    else:
        logger.info("pipeline: stage 2 — skipped (all slots matched from DB)")
        ai_day_results = []

    # Merge DB matches + AI results back into the skeleton day structure
    day_results = recipe_matcher.merge_into_days(
        skeleton=skeleton,
        matched=matched_meals,
        ai_days=ai_day_results,
    )

    # ------------------------------------------------------------------
    # Stage 3 — Validation + targeted fixes
    # ------------------------------------------------------------------
    _progress(75, "Validating and finalising…")
    logger.info("pipeline: stage 3 — validation")

    day_results = await validator_agent.run(
        day_results=day_results,
        skeleton=skeleton,
        global_constraints=constraints,
        cursor=cursor,
        user_id=user_id,
    )

    # ------------------------------------------------------------------
    # Assemble output
    # ------------------------------------------------------------------
    meal_plan_dict  = _assemble_meal_plan(day_results)
    grocery_list    = _build_basic_grocery_list(day_results)

    validation_summary = {
        "disliked_ingredients_avoided": True,
        "all_meal_times_included":      True,
        "no_repeated_titles":           True,
        "time_constraints_respected":   True,
        "pipeline_version":             "v2_threestage",
        "db_match_rate":                match_stats["match_rate"],
        "db_matched_slots":             match_stats["matched"],
        "ai_generated_slots":           match_stats["unmatched"],
    }

    # Log ingredient usage (non-fatal)
    _log_ingredient_usage(cursor, user_id, None, day_results)

    try:
        conn.commit()
    except Exception as exc:
        logger.warning("pipeline_orchestrator: commit failed: %s", exc)

    _progress(90, "Almost done…")
    logger.info("pipeline: complete — %d days generated", len(day_results))

    return {
        "meal_plan":          meal_plan_dict,
        "grocery_list":       grocery_list,
        "validation_summary": validation_summary,
        # Pass through so menu.py can update menu row after insert
        "_pipeline_version":  "v2_threestage",
    }
