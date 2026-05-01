"""Recipe Matcher — runs between Stage 1 (skeleton) and Stage 2 (recipe agent).

For each meal slot in the skeleton, queries scraped_recipes for a real DB recipe
that satisfies the user's constraints.  Slots with a match skip the GPT-4 call
entirely.  Only unmatched slots are forwarded to recipe_agent.

Match priority (highest → lowest):
  1. User has saved this recipe (saved_recipes table)
  2. User has rated this recipe ≥ 4 (recipe_interactions)
  3. Recipe matches cuisine + protein + diet constraints, sorted by rating DESC

Exclusions:
  - Any recipe the user rated ≤ 2
  - Any recipe already used in this plan (dedup within the run)
  - Any recipe whose ingredients contain a disliked item
  - Recipes whose macros fall outside the day's carb target ±30g (if carb cycling)
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cuisine keyword map — maps skeleton cuisine labels to DB search terms
# ---------------------------------------------------------------------------

_CUISINE_TERMS: dict[str, list[str]] = {
    "mediterranean": ["mediterranean", "greek", "middle eastern", "turkish", "lebanese"],
    "asian":         ["asian", "chinese", "thai", "vietnamese", "japanese", "korean"],
    "mexican":       ["mexican", "tex-mex", "latin", "southwestern"],
    "italian":       ["italian", "pasta", "roman", "sicilian"],
    "american":      ["american", "southern", "bbq", "comfort"],
    "thai":          ["thai"],
    "indian":        ["indian"],
    "japanese":      ["japanese"],
    "korean":        ["korean"],
    "french":        ["french"],
    "moroccan":      ["moroccan", "north african"],
    "spanish":       ["spanish"],
    "middle eastern":["middle eastern", "lebanese", "persian"],
    "greek":         ["greek", "mediterranean"],
}

# Diet tag keywords that must appear in diet_tags JSONB when restriction is active
_DIET_TAG_REQUIRED: dict[str, list[str]] = {
    "vegan":       ["vegan"],
    "vegetarian":  ["vegan", "vegetarian"],
    "gluten-free": ["gluten-free", "gluten free"],
    "dairy-free":  ["dairy-free", "dairy free"],
    "paleo":       ["paleo"],
    "keto":        ["keto", "low-carb", "low carb"],
}

# Protein keywords used to match recipe ingredients / title to skeleton protein
_PROTEIN_TERMS: dict[str, list[str]] = {
    "chicken":      ["chicken"],
    "beef":         ["beef", "ground beef", "steak", "brisket"],
    "pork":         ["pork", "bacon", "ham", "prosciutto"],
    "turkey":       ["turkey"],
    "salmon":       ["salmon"],
    "tuna":         ["tuna"],
    "shrimp":       ["shrimp", "prawn"],
    "eggs":         ["egg", "eggs"],
    "tofu":         ["tofu"],
    "tempeh":       ["tempeh"],
    "lentils":      ["lentil", "lentils"],
    "chickpeas":    ["chickpea", "chickpeas", "garbanzo"],
    "black beans":  ["black bean", "black beans"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cuisine_sql_terms(cuisine: str) -> list[str]:
    key = cuisine.lower().strip()
    return _CUISINE_TERMS.get(key, [key])


def _protein_keywords(protein: str) -> list[str]:
    key = protein.lower().strip()
    for p_key, terms in _PROTEIN_TERMS.items():
        if p_key in key or key in p_key:
            return terms
    return [key]


def _diet_tag_filters(dietary_restrictions: list[str]) -> list[str]:
    """Return the diet tag values we REQUIRE to be present in diet_tags JSONB."""
    required = []
    for r in dietary_restrictions:
        r_low = r.strip().lower()
        for tag_key, tags in _DIET_TAG_REQUIRED.items():
            if tag_key in r_low:
                required.extend(tags)
    return list(set(required))


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _recipe_to_meal_dict(recipe: dict, meal_time: str, servings: int) -> dict:
    """
    Convert a scraped_recipes row (with joined ingredients / nutrition) into
    the same dict shape that recipe_agent produces, so downstream code is
    unaffected.
    """
    instructions = recipe.get("instructions") or []
    if isinstance(instructions, str):
        try:
            instructions = json.loads(instructions)
        except Exception:
            instructions = [s.strip() for s in instructions.split("\n") if s.strip()]
    if not isinstance(instructions, list):
        instructions = [str(instructions)]

    ingredients_raw = recipe.get("ingredients") or []
    ingredients = []
    for ing in ingredients_raw:
        if isinstance(ing, dict):
            ingredients.append({
                "name":     ing.get("name", ""),
                "quantity": ing.get("amount", ""),
                "unit":     ing.get("unit", ""),
                "calories": "",
                "protein":  "",
                "carbs":    "",
                "fat":      "",
            })
        else:
            ingredients.append({"name": str(ing), "quantity": "", "unit": "",
                                 "calories": "", "protein": "", "carbs": "", "fat": ""})

    nutrition = recipe.get("nutrition") or {}
    cal  = nutrition.get("calories") or 0
    prot = nutrition.get("protein")  or 0
    carb = nutrition.get("carbs")    or 0
    fat  = nutrition.get("fat")      or 0

    return {
        "meal_time":          meal_time,
        "title":              recipe.get("title", ""),
        "ingredients":        ingredients,
        "instructions":       instructions,
        "servings":           servings,
        "prep_time_minutes":  recipe.get("prep_time") or 0,
        "cook_time_minutes":  recipe.get("cook_time") or 0,
        "macros": {
            "perServing": {
                "calories": round(cal / max(servings, 1)),
                "protein":  f"{round(prot / max(servings, 1))}g",
                "carbs":    f"{round(carb / max(servings, 1))}g",
                "fat":      f"{round(fat  / max(servings, 1))}g",
            },
            "perMeal": {
                "calories": cal,
                "protein":  f"{round(prot)}g",
                "carbs":    f"{round(carb)}g",
                "fat":      f"{round(fat)}g",
            },
        },
        # Metadata so the caller knows this came from the DB
        "_source": "db",
        "_recipe_id": recipe.get("id"),
    }


# ---------------------------------------------------------------------------
# Core DB query
# ---------------------------------------------------------------------------

def _fetch_candidates(
    cursor,
    cuisine_terms: list[str],
    protein_keywords: list[str],
    required_diet_tags: list[str],
    excluded_recipe_ids: set[int],
    user_id: int,
    limit: int = 20,
) -> list[dict]:
    """
    Pull candidate recipes from scraped_recipes joined with nutrition and
    user interaction data.  Returns raw dicts for further Python filtering.
    """
    # Build cuisine OR clause
    cuisine_clauses = " OR ".join(["LOWER(r.cuisine) LIKE %s"] * len(cuisine_terms))
    cuisine_params  = [f"%{t}%" for t in cuisine_terms]

    # Protein: match against title or ingredient names
    protein_title_clauses = " OR ".join(["LOWER(r.title) LIKE %s"] * len(protein_keywords))
    protein_ing_clauses   = " OR ".join(["LOWER(ing.name) LIKE %s"] * len(protein_keywords))
    protein_params_title  = [f"%{kw}%" for kw in protein_keywords]
    protein_params_ing    = [f"%{kw}%" for kw in protein_keywords]

    # Excluded IDs placeholder
    excl_clause = ""
    excl_params: list = []
    if excluded_recipe_ids:
        placeholders = ", ".join(["%s"] * len(excluded_recipe_ids))
        excl_clause = f"AND r.id NOT IN ({placeholders})"
        excl_params = list(excluded_recipe_ids)

    # Diet tag filter — each required tag must appear somewhere in the JSONB array
    diet_clauses = ""
    diet_params: list = []
    if required_diet_tags:
        diet_parts = []
        for tag in required_diet_tags:
            diet_parts.append("r.diet_tags::text ILIKE %s")
            diet_params.append(f"%{tag}%")
        diet_clauses = "AND (" + " OR ".join(diet_parts) + ")"

    sql = f"""
        SELECT
            r.id,
            r.title,
            r.cuisine,
            r.complexity,
            r.prep_time,
            r.cook_time,
            r.diet_tags,
            r.instructions,
            r.metadata,
            r.flavor_profile,
            rn.calories,
            rn.protein,
            rn.carbs,
            rn.fat,
            -- User signals
            COALESCE(ri_avg.avg_score, 0)   AS avg_rating,
            COALESCE(ri_avg.rating_count, 0) AS rating_count,
            CASE WHEN sr.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
        FROM scraped_recipes r
        -- Protein match via ingredients
        JOIN recipe_ingredients ing ON ing.recipe_id = r.id
             AND ({protein_ing_clauses})
        -- Nutrition (left join — may be missing)
        LEFT JOIN recipe_nutrition rn ON rn.recipe_id = r.id
        -- User ratings aggregate
        LEFT JOIN (
            SELECT recipe_id,
                   AVG(rating_score)  AS avg_score,
                   COUNT(*)           AS rating_count
            FROM recipe_interactions
            WHERE user_id = %s
              AND rating_score IS NOT NULL
            GROUP BY recipe_id
        ) ri_avg ON ri_avg.recipe_id = r.id
        -- Saved recipes
        LEFT JOIN saved_recipes sr
               ON sr.scraped_recipe_id = r.id
              AND sr.user_id = %s
        WHERE ({cuisine_clauses})
          {excl_clause}
          {diet_clauses}
          -- Exclude recipes the user rated poorly
          AND COALESCE(ri_avg.avg_score, 3) > 2
        ORDER BY
            is_saved DESC,
            COALESCE(ri_avg.avg_score, 3) DESC,
            r.id DESC
        LIMIT %s
    """

    params = (
        protein_params_ing          # protein ingredient match
        + [user_id, user_id]        # rating subquery + saved_recipes
        + cuisine_params            # cuisine WHERE
        + excl_params               # excluded ids
        + diet_params               # diet tag filter
        + [limit]
    )

    try:
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        if not rows:
            return []
        # Rows may be dicts (RealDictCursor) or tuples
        if isinstance(rows[0], dict):
            return list(rows)
        cols = [
            "id", "title", "cuisine", "complexity", "prep_time", "cook_time",
            "diet_tags", "instructions", "metadata", "flavor_profile",
            "calories", "protein", "carbs", "fat",
            "avg_rating", "rating_count", "is_saved",
        ]
        return [dict(zip(cols, r)) for r in rows]
    except Exception as exc:
        logger.warning("recipe_matcher: candidate query failed: %s", exc)
        return []


def _fetch_ingredients_for_recipes(cursor, recipe_ids: list[int]) -> dict[int, list[dict]]:
    """Batch-fetch ingredients for a list of recipe ids."""
    if not recipe_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(recipe_ids))
    try:
        cursor.execute(
            f"""
            SELECT recipe_id, name, amount, unit
            FROM recipe_ingredients
            WHERE recipe_id IN ({placeholders})
            ORDER BY recipe_id, id
            """,
            recipe_ids,
        )
        rows = cursor.fetchall()
        result: dict[int, list[dict]] = {}
        for row in rows:
            if isinstance(row, dict):
                rid, name, amount, unit = row["recipe_id"], row["name"], row["amount"], row["unit"]
            else:
                rid, name, amount, unit = row
            result.setdefault(rid, []).append({"name": name, "amount": amount, "unit": unit})
        return result
    except Exception as exc:
        logger.warning("recipe_matcher: ingredient fetch failed: %s", exc)
        return {}


# ---------------------------------------------------------------------------
# Python-level filters applied after the DB query
# ---------------------------------------------------------------------------

def _passes_disliked_filter(recipe: dict, disliked: list[str]) -> bool:
    """Return False if any disliked ingredient appears in this recipe's ingredients."""
    if not disliked:
        return True
    disliked_lower = [d.lower().strip() for d in disliked if d.strip()]
    for ing in recipe.get("ingredients") or []:
        name = ing.get("name", "").lower() if isinstance(ing, dict) else str(ing).lower()
        if any(d in name for d in disliked_lower):
            return False
    return True


def _passes_time_filter(recipe: dict, max_minutes: int | None) -> bool:
    if not max_minutes:
        return True
    total = (recipe.get("prep_time") or 0) + (recipe.get("cook_time") or 0)
    return total <= max_minutes * 1.25  # 25% buffer (mirrors existing logic)


def _passes_carb_filter(recipe: dict, carb_target_grams: int | None) -> bool:
    """If carb cycling is active, the recipe's carbs must be within ±30g of target."""
    if not carb_target_grams:
        return True
    carbs = recipe.get("carbs")
    if carbs is None:
        return True  # no nutrition data — give benefit of doubt
    return abs(float(carbs) - carb_target_grams) <= 30


def _passes_complexity_filter(recipe: dict, complexity_level: str) -> bool:
    db_complexity = (recipe.get("complexity") or "").lower()
    if not db_complexity:
        return True
    order = ["minimal", "easy", "standard", "complex"]
    try:
        db_idx  = order.index(db_complexity)
        req_idx = order.index(complexity_level)
        # Allow one level above requested (some stretch is fine)
        return db_idx <= req_idx + 1
    except ValueError:
        return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def match_slots(
    skeleton: dict,
    global_constraints: dict,
    user_id: int,
    cursor,
) -> dict[str, Any]:
    """
    Attempt to match every meal slot in the skeleton to a real DB recipe.

    Returns:
        {
            "matched": {
                "<day_number>_<meal_time>": <meal_dict in recipe_agent output shape>
            },
            "unmatched_slots": [
                {"day_number": int, "meal": <skeleton meal dict>}
            ],
            "stats": {"total": int, "matched": int, "unmatched": int}
        }
    """
    disliked       = global_constraints.get("disliked_ingredients", [])
    restrictions   = global_constraints.get("dietary_restrictions", [])
    diet_type      = global_constraints.get("diet_type", "")
    time_constrs   = global_constraints.get("time_constraints", {})
    complexity     = global_constraints.get("prep_complexity", "standard")
    servings       = global_constraints.get("servings_per_meal", 1)

    # Merge diet_type into restrictions for tag filtering
    all_restrictions = list(restrictions)
    if diet_type and diet_type.lower() not in ("mixed", ""):
        all_restrictions.append(diet_type)
    required_diet_tags = _diet_tag_filters(all_restrictions)

    matched: dict[str, dict] = {}
    unmatched: list[dict] = []
    used_recipe_ids: set[int] = set()
    used_titles: set[str] = set()

    total_slots = sum(len(d.get("meals", [])) for d in skeleton.get("days", []))

    for day in skeleton.get("days", []):
        day_num       = day.get("day_number", 0)
        carb_target   = day.get("carb_target_grams")

        for slot in day.get("meals", []):
            meal_time = slot.get("meal_time", "")
            cuisine   = slot.get("cuisine", "")
            protein   = slot.get("primary_protein", "")

            # Time constraint for this meal time
            tc_key   = f"weekday-{meal_time}" if not meal_time.startswith("snack") else None
            max_mins = time_constrs.get(tc_key) if tc_key else 20

            cuisine_terms   = _cuisine_sql_terms(cuisine)
            protein_kws     = _protein_keywords(protein)

            candidates = _fetch_candidates(
                cursor=cursor,
                cuisine_terms=cuisine_terms,
                protein_keywords=protein_kws,
                required_diet_tags=required_diet_tags,
                excluded_recipe_ids=used_recipe_ids,
                user_id=user_id,
            )

            if not candidates:
                logger.debug(
                    "recipe_matcher: no candidates for day %d %s (cuisine=%s protein=%s)",
                    day_num, meal_time, cuisine, protein,
                )
                unmatched.append({"day_number": day_num, "meal": slot})
                continue

            # Batch-fetch ingredients for all candidates at once
            candidate_ids = [r["id"] for r in candidates]
            ingredients_map = _fetch_ingredients_for_recipes(cursor, candidate_ids)
            for r in candidates:
                r["ingredients"] = ingredients_map.get(r["id"], [])

            # Also pull nutrition into a sub-dict shape for _recipe_to_meal_dict
            for r in candidates:
                r["nutrition"] = {
                    "calories": r.get("calories"),
                    "protein":  r.get("protein"),
                    "carbs":    r.get("carbs"),
                    "fat":      r.get("fat"),
                }

            # Python-level filters
            filtered = [
                r for r in candidates
                if _passes_disliked_filter(r, disliked)
                and _passes_time_filter(r, max_mins)
                and _passes_carb_filter(r, carb_target)
                and _passes_complexity_filter(r, complexity)
                and _normalize(r.get("title", "")) not in used_titles
            ]

            if not filtered:
                logger.debug(
                    "recipe_matcher: all candidates filtered out for day %d %s",
                    day_num, meal_time,
                )
                unmatched.append({"day_number": day_num, "meal": slot})
                continue

            # Pick best — candidates are already sorted by is_saved DESC, avg_rating DESC
            best = filtered[0]
            meal_dict = _recipe_to_meal_dict(best, meal_time, servings)

            slot_key = f"{day_num}_{meal_time}"
            matched[slot_key] = meal_dict
            used_recipe_ids.add(best["id"])
            used_titles.add(_normalize(best.get("title", "")))

            logger.debug(
                "recipe_matcher: matched day %d %s → '%s' (recipe_id=%s, saved=%s, rating=%.1f)",
                day_num, meal_time, best.get("title"),
                best.get("id"), bool(best.get("is_saved")), best.get("avg_rating") or 0,
            )

    stats = {
        "total":     total_slots,
        "matched":   len(matched),
        "unmatched": len(unmatched),
        "match_rate": round(len(matched) / max(total_slots, 1) * 100),
    }
    logger.warning(
        "recipe_matcher: %d/%d slots matched from DB (%d%% hit rate)",
        stats["matched"], stats["total"], stats["match_rate"],
    )

    return {"matched": matched, "unmatched_slots": unmatched, "stats": stats}


def merge_into_days(
    skeleton: dict,
    matched: dict[str, dict],
    ai_days: list[dict],
) -> list[dict]:
    """
    Merge DB-matched meals and AI-generated meals into the final day list.

    ai_days contains only the days/slots that were sent to recipe_agent.
    matched contains pre-built meal dicts keyed by "<day_number>_<meal_time>".
    skeleton provides the authoritative day structure.
    """
    # Index AI meals by day_number + meal_time for O(1) lookup
    ai_index: dict[str, dict] = {}
    for day in ai_days:
        d_num = day.get("day_number", 0)
        for meal in day.get("meals", []):
            ai_index[f"{d_num}_{meal.get('meal_time', '')}"] = meal

    final_days = []
    for day in skeleton.get("days", []):
        day_num = day.get("day_number", 0)
        assembled_meals = []

        for slot in day.get("meals", []):
            meal_time = slot.get("meal_time", "")
            slot_key  = f"{day_num}_{meal_time}"

            if slot_key in matched:
                assembled_meals.append(matched[slot_key])
            elif slot_key in ai_index:
                assembled_meals.append(ai_index[slot_key])
            else:
                logger.warning(
                    "recipe_matcher.merge: no meal found for day %d %s — slot will be empty",
                    day_num, meal_time,
                )

        final_day: dict[str, Any] = {"day_number": day_num, "meals": assembled_meals}
        # Preserve carb cycling metadata on the day
        for k in ("carb_tier", "carb_label", "carb_target_grams"):
            if k in day:
                final_day[k] = day[k]
        final_days.append(final_day)

    return final_days
