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

## Database — Tables

51 tables in `public` schema (49 base + 3 views). Verified against live Railway DB.

### Auth & Users

| Table | Purpose |
|---|---|
| `user_profiles` | **The real users table.** Auth + all preferences (~64 columns). JSONB: `meal_times`, `appliances` (json, not jsonb), `flavor_preferences`, `carb_cycling_config`, `preferred_proteins`, `other_proteins`, `recipe_type_preferences`, `meal_time_preferences`, `time_constraints`, `prep_preferences`. Most FKs across the DB point here. |
| `users` | **Vestigial.** 5 columns, 1 row. Only `user_management_logs` references it. Don't use for new code. |
| `user_tokens` | JWT/session tokens — `(user_id, token, expires_at)` |
| `password_reset_requests` | Reset token + expiry |
| `user_management_logs` | Admin actions audit log (action, performed_by, ip_address, metadata) |
| `user_model_preferences` | Per-user AI model selection override |

### Menus & Generation

| Table | Purpose |
|---|---|
| `menus` | Generated meal plans. Columns: `id, user_id, total_cost, duration_days, meal_times (TEXT — JSON-encoded), snacks_per_day, meal_plan_json (jsonb), created_at, nickname, created_by, shared_with_organization, for_client_id, ai_model_used, pipeline_version`. **No `grocery_list` column** — grocery list is computed at request time. |
| `menu_generation_jobs` | Async job tracking. PK is `job_id` (varchar UUID). Holds `request_data`, `result_data`, `progress`, `status`. |
| `menu_ratings` | Per-user menu ratings — `(user_id, menu_id)` unique, includes variety/practicality/family_approval scores |
| `custom_menus` | User-built menus outside the AI pipeline |
| `generation_pipeline_log` | Per-stage debug log — model, tokens, duration, stage_input/output JSONB. PK is uuid. |
| `ingredient_usage_log` | Per-user ingredient history (used by skeleton agent's 3-day cooldown — pruned at 14 days) |
| `recommendation_metrics` | Track which recommendation source led to a menu selection |
| `shared_menus` | Menus shared from coach → client |

### Recipe Library (scraped)

| Table | Purpose |
|---|---|
| `scraped_recipes` | ~1000 real recipes — title, cuisine, complexity, instructions (jsonb), `diet_tags` (jsonb), `flavor_profile` (jsonb), appliances (jsonb), categories (jsonb), metadata (jsonb) |
| `recipe_ingredients` | Normalized ingredient rows per recipe — `(recipe_id, name, amount, unit, category, is_main_ingredient)`. **`unit` lives on this table** — recipe_matcher reads it directly into the meal dict. |
| `recipe_nutrition` | Calories, macros, micronutrients per recipe (cal, protein, carbs, fat, fiber, sugar, sodium, etc.) |
| `recipe_tags` | `(recipe_id, tag)` rows for tagging |
| `recipe_components` | Recipe broken into reusable components (sauce, base, protein, etc.) |
| `component_compatibility` | Compatibility scores between two component IDs |
| `recipe_interactions` | User ratings on scraped recipes — `rating_score (1–5)`, `made_recipe`, `would_make_again`, `difficulty_rating`, `time_accuracy` |
| `saved_recipes` | User bookmarks. **Footgun:** column literally named `"recipe_identifier "` (trailing space) with a unique index on it. Also has a unique-on-`recipe_id` constraint that works only because the app constructs `recipe_id` as `"{menu_id}-{day}-{meal_time}"`. |
| `shared_recipes` | Recipes shared between orgs/users |

### User-Created Recipes

| Table | Purpose |
|---|---|
| `user_recipes` | User-authored recipes (separate from `scraped_recipes`) — title, cuisine, macros, is_public |
| `user_recipe_ingredients` | Ingredients per user recipe |
| `user_recipe_steps` | Ordered instruction steps per user recipe |

### Organizations / Coach Features

| Table | Purpose |
|---|---|
| `organizations` | Org accounts — `(id, name, owner_id → user_profiles, subscription_id)` |
| `organization_clients` | Coach ↔ client relationships (status, role) |
| `organization_settings` | Per-org config — JSONB `branding_settings`, `default_client_preferences`, contact info |
| `organization_menu_defaults` | Org-level default planning period, meals per day, serving sizes, nutritional targets |
| `organization_nutritional_standards` | Named macro/calorie standards an org can apply to clients |
| `organization_recipes` | Org's curated recipe library (joins `scraped_recipes` or `user_recipes`) with approval workflow |
| `organization_recipe_categories` | Org-defined recipe categories (color, sort_order) |
| `client_invitations` | Pending invite tokens (email, organization_id, expires_at) |
| `client_notes` | Coach notes about clients (priority, tags jsonb, archived flag) |
| `client_note_templates` | Reusable note templates per org |
| `onboarding_forms` | Org-defined intake forms — `form_fields` jsonb |
| `onboarding_responses` | Client responses to onboarding forms |

### Subscriptions / Billing

| Table | Purpose |
|---|---|
| `subscriptions` | Active subs (Stripe + PayPal both supported) — `unique` on `user_id` AND on `organization_id` |
| `subscription_events` | Webhook event log per subscription |
| `invoices` | Invoice records linked to a subscription |
| `payment_methods` | Stripe/PayPal payment methods |
| `orders` | Store cart orders (Kroger/Walmart/Instacart) |

### AI / ML

| Table | Purpose |
|---|---|
| `ai_models` | Available AI models registry (model_name, model_type, model_path, is_active, version) |
| `model_training_state` | Tracks recipe-recommendation model training runs |

### Store Integration

| Table | Purpose |
|---|---|
| `store_products` | Cached store product lookups (Kroger/Walmart) — ingredient_name → product_id, price |
| `grocery_items` | Generic grocery item catalogue (name, price, store) |
| `temp_kroger_tokens` | Short-lived OAuth token handoff during Kroger auth flow |

### Misc

| Table | Purpose |
|---|---|
| `applied_migrations` | Run-on-startup migration log (migration_name unique, status, error_message) |
| `recipe_preferences_backup` | **Backup table** — do not write to it |

### Views

| View | Purpose |
|---|---|
| `menu_ratings_summary` | Aggregated stats per menu (total ratings, averages, reuse %) |
| `recipe_ratings_summary` | Aggregated stats per recipe (total, avg, distribution by score) |
| `user_rating_preferences` | Per-user rating profile (avg rating, variance, remake_ratio, feedback patterns) |

### Schema notes / footguns

- **`menus.meal_times` is TEXT (JSON-encoded string), but `user_profiles.meal_times` is JSONB.** Don't pass the former into a JSONB op without a cast.
- **`user_profiles.appliances` is `json`, not `jsonb`** (column 36). The other JSON-ish columns on this table are `jsonb`.
- `user_profiles` has gaps in `ordinal_position` (31, 32, 48, 49 dropped) — `SELECT *` works, but column count varies between dumps and live schema.
- `saved_recipes` column **`"recipe_identifier "`** has a trailing space (column 10, type `character(1)`). Unique index quotes the trailing space. Treat as legacy — prefer the `(user_id, menu_id, recipe_id, meal_time)` composite unique key.
- Most FKs use `ON DELETE NO ACTION`; a handful use `CASCADE` (organization-scoped child tables, recipe sub-rows) or `SET NULL` (`menu_generation_jobs.client_id`, `organization_recipes.category_id`, `user_profiles.organization_id`).
- `recipe_preferences_backup` exists from a migration — don't reference it in app code.

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
