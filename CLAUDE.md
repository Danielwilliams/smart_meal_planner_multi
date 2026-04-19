# Smart Meal Planner Multi — Claude Code Project Guide

## What This Is

AI-powered meal planning platform. Users set dietary preferences, generate weekly meal plans via a multi-agent AI pipeline, get consolidated grocery lists, and push shopping carts directly to Kroger, Walmart, or Instacart. Supports individual users, coaches managing clients (organizations), and a scraped recipe library of ~1000 recipes.

**Live:** Backend on Railway, Frontend (web) on Vercel (also deployed on Railway).

## Project Root

All source code lives under `smart_meal_planner_multi/apps/`.

## Tech Stack

- **Backend:** FastAPI (Python 3.10), PostgreSQL (psycopg2 connection pool, ThreadedConnectionPool 10–100), raw SQL (no ORM)
- **Frontend (web):** React 18, React Router v6, Material-UI (MUI) v5, Axios
- **AI:** OpenAI API (gpt-4, gpt-3.5-turbo) via `openai` library (v0.x — uses `ChatCompletion.create`, NOT the v1 client)
- **Auth:** JWT (HS256), bcrypt password hashing, Google reCAPTCHA v3 on signup
- **Payments:** Stripe (individual + organization plans), PayPal
- **Storage:** AWS S3 (recipe images)
- **Email:** SMTP via mboxhosting.com
- **Store integrations:** Kroger API, Walmart, Instacart
- **Deploy:** Backend + Frontend both on Railway (Nixpacks), Node.js 24.x

## Directory Structure

```
smart_meal_planner_multi/
├── apps/
│   ├── smart-meal-planner-backend/
│   │   ├── main.py                         # Uvicorn entry point
│   │   ├── app/
│   │   │   ├── main.py                     # FastAPI app, CORS, router registration, startup
│   │   │   ├── config.py                   # Env vars: DB, OpenAI, AWS, Stripe, SMTP
│   │   │   ├── db.py                       # Connection pool, get_db_cursor(), query helpers
│   │   │   ├── migrations.py               # Run-on-startup SQL migrations (add columns, create tables)
│   │   │   ├── create_recipe_tables.py     # scraped_recipes + related table creation
│   │   │   ├── models/
│   │   │   │   ├── user.py                 # Pydantic: UserSignUp, PreferencesUpdate, GenerateMealPlanRequest
│   │   │   │   ├── subscription.py         # Stripe subscription models
│   │   │   │   └── branding.py             # Organization branding models
│   │   │   ├── routers/
│   │   │   │   ├── menu.py                 # ⚠️ 4100+ lines — meal plan generation (monolith + new pipeline dispatch)
│   │   │   │   ├── grocery_list.py         # AI-enhanced shopping list generation (2100+ lines)
│   │   │   │   ├── preferences.py          # GET/PUT user preferences
│   │   │   │   ├── auth.py                 # Register, login, JWT, password reset, email verify
│   │   │   │   ├── signup.py               # Account creation + org setup
│   │   │   │   ├── subscriptions.py        # Stripe webhook + subscription management
│   │   │   │   ├── saved_recipes.py        # User recipe bookmarks
│   │   │   │   ├── scraped_recipes.py      # Browse/search the recipe library
│   │   │   │   ├── recipe_ratings.py       # Rate recipes (1–5), would_make_again, difficulty
│   │   │   │   ├── organizations.py        # Org CRUD
│   │   │   │   ├── organization_clients.py # Coach → client management
│   │   │   │   ├── organization_recipes.py # Org-scoped recipe collections
│   │   │   │   ├── kroger_auth.py          # Kroger OAuth flow
│   │   │   │   ├── kroger_store.py         # Kroger product search + cart
│   │   │   │   ├── walmart_store.py        # Walmart product search + cart
│   │   │   │   ├── instacart_store.py      # Instacart store + cart
│   │   │   │   ├── cart.py                 # Cart aggregation
│   │   │   │   ├── meal_shopping_lists.py  # Per-meal shopping lists
│   │   │   │   ├── user_recipes.py         # User-created custom recipes
│   │   │   │   ├── custom_menu.py          # Custom menu builder
│   │   │   │   ├── client_resources.py     # Shared menus for org clients
│   │   │   │   ├── invitations.py          # Org client invite flow
│   │   │   │   ├── rating_analytics.py     # Analytics endpoints for recipe ratings
│   │   │   │   └── recipe_admin.py         # Admin: import/manage scraped recipes
│   │   │   ├── ai/
│   │   │   │   ├── rating_analytics.py     # Extract user preferences from rating history
│   │   │   │   ├── pipeline_orchestrator.py # 3-stage pipeline entry point
│   │   │   │   └── agents/
│   │   │   │       ├── skeleton_agent.py   # Stage 1: cuisine/protein/format assignment (gpt-3.5-turbo)
│   │   │   │       ├── recipe_matcher.py   # Stage 1.5: match slots to DB recipes before AI
│   │   │   │       ├── recipe_agent.py     # Stage 2: full recipe generation per day (gpt-4, parallel)
│   │   │   │       └── validator_agent.py  # Stage 3: Python checks + targeted AI fixes
│   │   │   ├── integration/
│   │   │   │   ├── kroger.py               # Kroger cart API
│   │   │   │   ├── walmart.py              # Walmart cart API
│   │   │   │   └── instacart.py            # Instacart proxy
│   │   │   ├── utils/
│   │   │   │   ├── grocery_aggregator.py   # Ingredient consolidation + unit normalization (59KB)
│   │   │   │   ├── snack_enhancer.py       # Post-process snacks with instructions
│   │   │   │   ├── meal_grocery_generator.py # Per-meal shopping list creation
│   │   │   │   └── s3/s3_utils.py          # AWS S3 image upload helpers
│   │   │   ├── middleware/
│   │   │   │   └── cors_middleware.py      # CORS setup
│   │   │   └── data/
│   │   │       ├── ingredient_config.json      # Unit normalization rules + filler words
│   │   │       └── ingredient_replacements.json # Healthy substitute mappings
│   └── smart-meal-planner-web/
│       ├── public/
│       ├── src/
│       │   ├── App.jsx                     # React Router routes
│       │   ├── pages/
│       │   │   ├── Menu.jsx                # Meal plan generation UI
│       │   │   ├── MenuDisplayPage.jsx     # Display generated plan
│       │   │   ├── ShoppingListPage.jsx    # Shopping list + store cart push
│       │   │   ├── Preferences.jsx         # User preference settings
│       │   │   ├── RecipeBrowserPage.jsx   # Browse scraped recipe library
│       │   │   ├── RecipeDetailPage.jsx    # Single recipe view
│       │   │   ├── SavedRecipesPage.jsx    # User's saved recipes
│       │   │   ├── OrganizationDashboard.jsx # Coach dashboard
│       │   │   ├── ClientDashboard.jsx     # Client-facing view
│       │   │   ├── SubscriptionPage.jsx    # Stripe checkout
│       │   │   ├── LoginPage.jsx / SignUpPage.jsx / CreateAccount.jsx
│       │   │   └── UserProfilePage.jsx
│       │   ├── components/                 # Shared UI components
│       │   └── contexts/                   # Auth context
│       └── package.json                    # Node 24.x, React 18, MUI v5
```

## Key Architectural Patterns

### Meal Plan Generation Pipeline

Two paths exist simultaneously — controlled by `USE_AGENT_PIPELINE` env var:

**New pipeline (USE_AGENT_PIPELINE=true) — `pipeline_orchestrator.py`:**
```
Stage 1  → skeleton_agent      (gpt-3.5-turbo) — assigns cuisine/protein/format per slot
Stage 1.5→ recipe_matcher      (no AI cost)    — matches slots to scraped_recipes DB
Stage 2  → recipe_agent        (gpt-4, parallel by day) — generates only unmatched slots
Stage 3  → validator_agent     (gpt-3.5-turbo) — Python checks + targeted fixes
```

**Legacy pipeline (USE_AGENT_PIPELINE=false) — `menu.py`:**
- `generate_meal_plan_variety()` → tries `generate_meal_plan_single_request()`, falls back to `generate_meal_plan_legacy()` (7 separate API calls, one per day)

### OpenAI Usage
Uses **openai v0.x** library — `openai.ChatCompletion.create(...)`, NOT `openai.OpenAI()` client. Do not upgrade to v1 syntax without testing.

Model selection via `determine_model()` in `menu.py`. Env vars:
- `SKELETON_MODEL` (default: gpt-3.5-turbo)
- `RECIPE_MODEL` (default: gpt-4)
- `VALIDATOR_MODEL` (default: gpt-3.5-turbo)

### Database
Raw SQL everywhere via `get_db_cursor(dict_cursor=True)` context manager. No SQLAlchemy ORM. All queries use `%s` parameterization (psycopg2 style).

Connection pool: `ThreadedConnectionPool(minconn=10, maxconn=100)`. Always use the context manager — never call `get_db_connection()` and manage connections manually.

### Organization / Multi-Tenant
Two account types: `individual` and `organization`. Organizations have coaches who invite clients. Shared menus flow from org → client via `shared_menus` table. Client data is scoped by `for_client_id` on most meal plan operations.

### Subscription Enforcement
`SUBSCRIPTION_ENFORCE=true` gates features by tier. `SUBSCRIPTION_TEST_MODE=true` bypasses enforcement for testing. Stripe webhooks hit `/api/v2/webhooks/stripe`.

## Database — Key Tables

| Table | Purpose |
|---|---|
| `user_profiles` | Auth + all preferences (JSONB fields for meal_times, appliances, flavor_preferences, carb_cycling_config, preferred_proteins) |
| `menus` | Generated meal plans — `meal_plan_json` JSONB, `grocery_list` JSONB, `pipeline_version` (v1_monolithic \| v2_threestage) |
| `scraped_recipes` | ~1000 real recipes — title, cuisine, complexity, instructions, diet_tags JSONB, flavor_profile JSONB |
| `recipe_ingredients` | Normalized ingredient rows per recipe (recipe_id FK) |
| `recipe_nutrition` | Calories, protein, carbs, fat per recipe |
| `recipe_interactions` | User ratings: rating_score (1–5), made_recipe, would_make_again, difficulty_rating |
| `saved_recipes` | User bookmarks linking to scraped_recipes |
| `ingredient_usage_log` | Per-user ingredient history for 3-day cooldown (populated by pipeline) |
| `generation_pipeline_log` | Per-stage debug log: model, tokens, duration, output JSON |
| `organizations` | Org accounts |
| `organization_clients` | Coach ↔ client relationships |
| `shared_menus` | Menus shared from org to client |
| `custom_menus` | User-built menus outside the AI pipeline |

## User Preferences Schema (user_profiles)

All preferences stored on the `user_profiles` table. Key fields:

| Field | Type | Notes |
|---|---|---|
| `calorie_goal` | INT | 500–5000 |
| `macro_protein/carbs/fat` | INT | Percentages, should sum to 100 |
| `diet_type` | TEXT | "Mixed", "Vegan", "Vegetarian", "Keto", "Paleo" |
| `dietary_restrictions` | TEXT | Comma-separated string |
| `disliked_ingredients` | TEXT | Comma-separated string |
| `meal_times` | JSONB | `{breakfast: bool, lunch: bool, dinner: bool, snacks: bool}` |
| `preferred_proteins` | JSONB | Nested by category: meat/seafood/vegetarian_vegan/other |
| `time_constraints` | JSONB | `{weekday-breakfast: mins, weekday-lunch: mins, ...}` |
| `recipe_type` | TEXT | Comma-separated cuisine list |
| `flavor_preferences` | JSONB | `{creamy: bool, spicy: bool, ...}` |
| `appliances` | JSONB | `{airFryer: bool, instapot: bool, crockpot: bool}` |
| `prep_complexity` | INT | 0–100 → minimal/easy/standard/complex |
| `carb_cycling_enabled` | BOOLEAN | Feature toggle |
| `carb_cycling_config` | JSONB | pattern, weekly_schedule, carb_ranges, goals |
| `snacks_per_day` | INT | 0–3 |
| `servings_per_meal` | INT | 1–10 |

**Important:** `menu.py` SQL SELECT must include `carb_cycling_enabled`, `carb_cycling_config`, and `diet_type` — these were missing from the original query and were added as part of the pipeline refactor.

## Carb Cycling

Stored in `carb_cycling_config` JSONB. Patterns: `3-1-3`, `2-2-3`, `4-0-3`, `5-0-2`, `custom`. Weekly schedule maps day names → tier (`high`, `moderate`, `low`, `no_carb`). The skeleton agent reads this to assign per-day carb targets; the recipe agent enforces them per meal. Keto users get `<50g carbs/day` hard-enforced in recipe_agent.

## AI Pipeline Environment Variables

```
USE_AGENT_PIPELINE=true          # Enable 3-stage pipeline (false = legacy monolith)
SKELETON_MODEL=gpt-3.5-turbo
RECIPE_MODEL=gpt-4
VALIDATOR_MODEL=gpt-3.5-turbo
MAX_PARALLEL_DAYS=3              # asyncio semaphore for parallel day generation
PIPELINE_LOG_ENABLED=true        # Write to generation_pipeline_log table
```

## Grocery List Flow

1. `grocery_aggregator.py` — pure Python, consolidates ingredients from meal plan JSON, normalizes units (tbsp→cup, oz→lb), strips descriptors (diced, chopped, fresh)
2. `grocery_list.py` — makes one GPT-4 call to categorize, add healthy alternatives, shopping tips, bulk buy flags
3. Store routers — Kroger/Walmart/Instacart map ingredients to product IDs and push to cart

## Common Tasks

### Running Locally
```bash
# Backend
cd apps/smart-meal-planner-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd apps/smart-meal-planner-web
npm install
npm start  # port 3000
```

### Adding a new preference field
1. Add column to `user_profiles` via a migration function in `migrations.py`
2. Add field to `PreferencesUpdate` model in `models/user.py`
3. Add to the `UPDATE` query in `preferences.py`
4. Add to the `SELECT` in `menu.py` (both the single-request and `_run_agent_pipeline` queries)
5. Add to `build_global_constraints()` in `pipeline_orchestrator.py` if it affects generation

### Adding a new route
Register it in `app/main.py` — both the import and the `app.include_router()` call.

## Important Notes

- **Raw SQL only** — no SQLAlchemy ORM, no Alembic. Migrations are Python functions in `migrations.py` called at startup via `run_migrations()`.
- **openai v0.x** — `ChatCompletion.create()` not `client.chat.completions.create()`. Do not mix syntax.
- **menu.py is 4100+ lines** — the monolithic generation functions (`generate_meal_plan_single_request`, `generate_meal_plan_legacy`) are kept as fallback while the new pipeline is validated. Plan to split into `menu_jobs.py` and `menu_legacy.py`.
- **recipe_matcher SQL** uses a JOIN on `recipe_ingredients` for protein matching — if the ingredients table is sparse for some recipes, match rate will be lower.
- **DB cursor context manager** — always use `with get_db_cursor(dict_cursor=True) as (cursor, conn):`. The `dict_cursor=True` flag returns rows as dicts. Autocommit is off by default — call `conn.commit()` explicitly.
- **Railway logging** — all levels show (unlike the AI coach project). Use `logger.warning()` for operationally important pipeline stats so they're easy to grep.
- **Node.js 24.x** — frontend package.json engines field. Build script uses `CI=false` to suppress warnings as errors.
- **Duplicate alt/debug routers** — several routers have `_alt`, `_debug`, `_backup`, `_fixed` variants (e.g. `saved_recipes_alt.py`, `recipe_ratings_fixed.py`). These are legacy — prefer the primary file.
- **Organization scope** — when `for_client_id` is set on a request, preferences and menu history are fetched for that client ID, not the requesting coach's user ID.
- **Ingredient cooldown** — `ingredient_usage_log` table tracks ingredients used in the last 14 days (pruned on each pipeline run). Skeleton agent queries last 3 days as blocklist.
