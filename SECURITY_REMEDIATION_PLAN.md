# Security Remediation Plan — Smart Meal Planner
**Created:** 2026-05-04  
**Priority:** Critical items must be completed before next production deploy

---

## Table of Contents
1. [Immediate Actions (Do Now)](#1-immediate-actions-do-now)
2. [Environment Variables](#2-environment-variables)
3. [Phase 1 — Core Auth Fix](#3-phase-1--core-auth-fix-get_user_from_token)
4. [Phase 2 — Credential Exposure Fixes](#4-phase-2--credential-exposure-fixes)
5. [Phase 3 — Endpoint Auth Guards](#5-phase-3--endpoint-auth-guards)
6. [Phase 4 — Admin Endpoint Lockdown](#6-phase-4--admin-endpoint-lockdown)
7. [Phase 5 — Data Exposure Cleanup](#7-phase-5--data-exposure-cleanup)
8. [Database Changes](#8-database-changes)
9. [Functionality Risk & Fallbacks](#9-functionality-risk--fallbacks)
10. [Testing Checklist](#10-testing-checklist)
11. [Implementation Order](#11-implementation-order)

---

## 1. Immediate Actions (Do Now)

These must happen before anything else — they are live credential exposures.

### 1a. Rotate SMTP Password
The password `.*+~?00D7y;,bV1t` is committed in `app/config.py:67` and is now in git history.

**Steps:**
1. Log in to mboxhosting.com and change the password for `signup@smartmealplannerio.com`
2. Update the `SMTP_PASSWORD` environment variable in Railway to the new password
3. Remove the hardcoded default from `config.py` (covered in Phase 2)

### 1b. Rotate Instacart API Key
The full Instacart API key is returned in the live `/instacart/status` API response (`instacart_status.py:94`). Any authenticated user can call this endpoint and harvest the key.

**Steps:**
1. Generate a new Instacart Connect API key in the Instacart developer portal
2. Update the `INSTACART_API_KEY` environment variable in Railway
3. Remove the key from the response (covered in Phase 2)

### 1c. Verify JWT_SECRET Is Set in Railway
Confirm `JWT_SECRET` is explicitly set in Railway environment variables. If it is not set, the server is using the hardcoded default `"VeryStrongDevelopmentSecretKeyDoNotUseInProduction2025"` which is now publicly visible in this repository.

**Steps:**
1. Check Railway → Smart Meal Planner Backend → Variables → confirm `JWT_SECRET` exists
2. If missing: generate a strong random secret (`openssl rand -hex 64`) and add it
3. If already set: no action needed on this item

---

## 2. Environment Variables

### Required — Must Exist or App Should Refuse to Start

| Variable | Where Used | Current State | Action |
|---|---|---|---|
| `JWT_SECRET` | `config.py:44`, all auth | Has dangerous default | Remove default, add to startup validation |
| `SMTP_PASSWORD` | `config.py:67`, email sending | **HARDCODED DEFAULT** | Rotate credential, remove default |
| `OPENAI_API_KEY` | Menu generation | Logs warning, continues | Add to startup validation (generation will fail without it) |
| `DATABASE_URL` | DB connection | Required, no default | Already validated indirectly |
| `INSTACART_API_KEY` | Instacart integration | Used, needs rotation | Rotate after removing from API response |

### Recommended — Add to Railway if Missing

| Variable | Purpose | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Subscription billing | Already likely set; confirm |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Required for Stripe events |
| `AWS_ACCESS_KEY_ID` | S3 storage | Optional feature but no default |
| `AWS_SECRET_ACCESS_KEY` | S3 storage | Optional feature but no default |
| `RECAPTCHA_SECRET_KEY` | Signup protection | Empty default currently |

### Changes to `config.py`

**File:** `apps/smart-meal-planner-backend/app/config.py`

```python
# BEFORE (line 44):
JWT_SECRET = os.getenv("JWT_SECRET", "VeryStrongDevelopmentSecretKeyDoNotUseInProduction2025")

# AFTER:
JWT_SECRET = os.getenv("JWT_SECRET")  # No default — must be set explicitly

# BEFORE (line 67):
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", ".*+~?00D7y;,bV1t")

# AFTER:
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # No default — must be set explicitly
```

**Add to `validate_environment()` function:**
```python
def validate_environment():
    critical_vars = ["JWT_SECRET", "SMTP_PASSWORD", "DATABASE_URL"]
    missing = [v for v in critical_vars if not os.getenv(v)]
    if missing:
        raise RuntimeError(f"Missing critical environment variables: {missing}")
```

**Risk:** If Railway does not have these variables set, the app will refuse to start. This is intentional — silent fallback to a known credential is worse than a startup failure.

---

## 3. Phase 1 — Core Auth Fix (`get_user_from_token`)

**File:** `apps/smart-meal-planner-backend/app/utils/auth_utils.py`

This is the most systemic fix. The current implementation returns `None` on any auth failure instead of raising HTTP 401. Every endpoint that uses this dependency but doesn't explicitly check for `None` silently runs unauthenticated.

### What to Change

```python
# CURRENT (broken) — lines 57-64:
except jwt.PyJWTError as e:
    return None
except Exception as e:
    return None

# FIXED:
except jwt.ExpiredSignatureError:
    raise HTTPException(status_code=401, detail="Token has expired")
except jwt.PyJWTError as e:
    raise HTTPException(status_code=401, detail="Invalid token")
except Exception as e:
    logger.error(f"Unexpected auth error: {str(e)}")
    raise HTTPException(status_code=401, detail="Authentication failed")
```

Also fix the missing Authorization header case:
```python
# CURRENT (line 26-28):
if not authorization:
    return None

# FIXED:
if not authorization:
    raise HTTPException(status_code=401, detail="Authorization header required")
```

### Create Optional Variant for Truly Public Endpoints

Some endpoints legitimately need to work both authenticated and anonymous (e.g., public recipe browsing). For those, create a separate dependency:

```python
async def get_optional_user_from_token(request: Request) -> Optional[dict]:
    """Use this only for endpoints that intentionally support anonymous access."""
    try:
        return await get_user_from_token(request)
    except HTTPException:
        return None
```

### Endpoints That Currently Rely on `None` Return (Will Break)

These endpoints use `get_user_from_token` but check `if not user` themselves — they will continue to work correctly after this change because they explicitly handle auth:
- `cancel_menu_generation_job` (menu.py:1009) — already raises 401 if None ✓
- `delete_menu` (menu.py:2536) — already raises 401 if None ✓
- Admin user management endpoints (auth.py:734) — already raises 403 if None ✓

**Endpoints that use `get_user_from_token` via `Optional` parameter:**
- `validate_discount` (subscriptions.py:127) — needs review, intentionally optional
- `get_instacart_status` (instacart_status.py) — uses `get_current_user` alias, may need optional variant

---

## 4. Phase 2 — Credential Exposure Fixes

### 4a. Remove API Key from Instacart Status Response

**File:** `apps/smart-meal-planner-backend/app/routers/instacart_status.py`

```python
# FIND (line ~94) and REMOVE this entire key:
"api_key": api_key,   # ONLY FOR DEBUGGING  ← DELETE THIS LINE

# Also remove from expected_headers dict if it includes the raw key:
"Instacart-Connect-Api-Key": api_key  ← REMOVE or replace with masked version
```

**Replacement:** Only return the masked key:
```python
masked = f"{api_key[:8]}...{api_key[-4:]}" if api_key and len(api_key) > 12 else "***"
# Return only: "masked_key": masked
```

**Functionality Risk:** The `/instacart/status` debug page in the frontend reads this response to show connection status. Removing `api_key` from the response will not break the connection status display — only the raw key display, which should never be shown in the UI anyway.

### 4b. Remove Hardcoded Defaults from config.py

Already covered in Section 2. Also remove:

```python
# Line 67 — remove default entirely:
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# Line 44 — remove default entirely:
JWT_SECRET = os.getenv("JWT_SECRET")
```

---

## 5. Phase 3 — Endpoint Auth Guards

### 5a. Preferences Router

**File:** `apps/smart-meal-planner-backend/app/routers/preferences.py`

Both endpoints need the same fix pattern:

```python
# ADD import at top if not present:
from ..utils.auth_utils import get_user_from_token

# GET endpoint (line 16):
@router.get("/{id}")
def get_user_preferences(
    id: int,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    if current_user["user_id"] != id:                  # ADD
        raise HTTPException(status_code=403, detail="Access denied")

# PUT endpoint (line 425):
@router.put("/{id}")
async def update_preferences(
    id: int,
    preferences: PreferencesUpdate,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    if current_user["user_id"] != id:                  # ADD
        raise HTTPException(status_code=403, detail="Access denied")
```

**Functionality Risk:** The frontend calls `GET /preferences/${userId}` and `PUT /preferences/${userId}` with the user's own ID (from `apiService.js:223, 239`). After this fix, requests will need a valid auth token. The frontend already sends the token for these calls via `axiosInstance` (which has an auth interceptor). **No frontend changes needed.**

**Edge Case:** Organization owners reading client preferences. Check if `client_resources.py` calls `/preferences/{client_id}` on behalf of org users. If so, add an org-owner bypass:
```python
if current_user["user_id"] != id and current_user.get("account_type") != "organization":
    raise HTTPException(status_code=403, detail="Access denied")
```

### 5b. Menu Router — Read Endpoints

**File:** `apps/smart-meal-planner-backend/app/routers/menu.py`

Confirm `get_user_from_token` is imported (it is at line 31). Add auth to each endpoint:

#### `GET /menu/latest/{user_id}` (line 1122)
```python
@router.get("/latest/{user_id}")
def get_latest_menu(
    user_id: int,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
```

#### `GET /menu/history/{user_id}` (line 1155)
Same pattern as above.

#### `PATCH /menu/{menu_id}/nickname` (line 1193)
```python
@router.patch("/{menu_id}/nickname")
async def update_menu_nickname(
    menu_id: int,
    nickname: str = Body(..., embed=True),
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    # Verify ownership:
    # SELECT user_id FROM menus WHERE id = menu_id
    # if menu["user_id"] != current_user["user_id"]: raise 403
```

#### `GET /menu/{menu_id}/grocery-list` (line 1218)
```python
@router.get("/{menu_id}/grocery-list")
def get_grocery_list(
    menu_id: int,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    # Verify ownership or shared access before returning
```

#### `GET /menu/latest/{user_id}/grocery-list` (line 1473)
Same pattern as `/latest/{user_id}`.

#### `GET /menu/{menu_id}` (line 1504)
```python
@router.get("/{menu_id}")
def get_menu_details(
    menu_id: int,
    user_id: int = Query(None),
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    # Verify: menu.user_id == current_user["user_id"]
    # OR menu is in shared_menus for current_user
```

#### `GET /menu/shared` and `GET /menu/shared/{user_id}` (lines 1568, 1598)
```python
# Also fix the duplicate route definition here — FastAPI uses first match.
# Keep only the path-param version:
@router.get("/shared/{user_id}")
async def get_shared_menus(
    user_id: int,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
```

### 5c. Menu Router — Generation Endpoints

#### `POST /menu/generate-async` (line 855)
```python
@router.post("/generate-async")
async def start_menu_generation_async(
    req: GenerateMealPlanRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    # Override user_id from token, never trust request body:
    req.user_id = current_user["user_id"]
```

**Functionality Risk:** The frontend sends `user_id` in the request body (`apiService.js:845`). After this fix, the server will override it with the token's `user_id`. **Behavior is the same for legitimate users.** No frontend changes needed.

#### `GET /menu/job-status/{job_id}` (line 902)
```python
@router.get("/job-status/{job_id}")
async def get_menu_generation_status(
    job_id: str,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    # After fetching job from cache, verify:
    if status.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
```

**Functionality Risk:** The frontend polls this endpoint while waiting for menu generation. It already sends the auth token via `axiosInstance`. **No frontend changes needed.**

#### `GET /menu/active-jobs/{user_id}` (line 938)
```python
@router.get("/active-jobs/{user_id}")
async def get_active_jobs_for_user(
    user_id: int,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
```

### 5d. Auth Router — Progress Update

**File:** `apps/smart-meal-planner-backend/app/routers/auth.py`

```python
@router.patch("/{user_id}/progress")
async def update_user_progress(
    user_id: int,
    progress: UserProgress,
    current_user: dict = Depends(get_user_from_token)  # ADD
):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
```

**Functionality Risk:** The onboarding walkthrough calls this endpoint after each step to mark progress. It uses `apiService` with the user's token. **No frontend changes needed.**

---

## 6. Phase 4 — Admin Endpoint Lockdown

### 6a. Admin Endpoints in `main.py`

**File:** `apps/smart-meal-planner-backend/app/main.py`

All admin endpoints need the same guard. There is already an `admin_required` dependency in `auth_utils.py` — use it:

```python
from app.utils.auth_utils import get_user_from_token

def admin_required(current_user: dict = Depends(get_user_from_token)):
    if not current_user or current_user.get("account_type") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

Apply to each endpoint:
```python
@app.post("/admin/reset-connections")
async def reset_db_connections(admin = Depends(admin_required)):   # ADD

@app.get("/admin/db-stats")
async def get_db_stats(admin = Depends(admin_required)):           # ADD

@app.post("/admin/run-migrations")
async def run_migrations(admin = Depends(admin_required)):         # ADD

@app.get("/check-s3-vars")
async def check_s3_vars(admin = Depends(admin_required)):          # ADD

@app.get("/verify-password-hashing")
async def verify_password_hashing(admin = Depends(admin_required)): # ADD

@app.post("/clear-plaintext-passwords")
async def clear_passwords(admin = Depends(admin_required)):         # ADD
```

**Functionality Risk:** These endpoints were likely only ever called manually by you during development/debugging. No frontend pages call them. Locking them to admin-only has zero user-facing impact. After Phase 1's auth fix, ensure you have a valid admin account to call these.

### 6b. Debug Endpoints in `menu.py`

```python
@router.get("/db-stats")
async def get_database_connection_stats(admin = Depends(admin_required)):  # ADD

@router.get("/debug/concurrency")
async def get_concurrency_debug_info(admin = Depends(admin_required)):     # ADD
```

### 6c. Fix Duplicate Route in `menu.py`

Lines 1568 and 1598 define `get_shared_menus` twice with slightly different signatures. FastAPI uses the first match. Remove one:
- Keep the path-param version `GET /shared/{user_id}` (line 1598)
- Remove or redirect the query-param version `GET /shared?user_id=X` (line 1568)

---

## 7. Phase 5 — Data Exposure Cleanup

### 7a. Remove `user_id` from Public Recipe Ratings

**File:** `apps/smart-meal-planner-backend/app/routers/recipe_ratings.py` (lines 380–393)

```sql
-- BEFORE:
SELECT rating_score, feedback_text, made_recipe, would_make_again, updated_at, user_id

-- AFTER (remove user_id):
SELECT rating_score, feedback_text, made_recipe, would_make_again, updated_at
```

**Functionality Risk:** The frontend recipe rating display only shows the score and feedback text — it does not display `user_id`. Removing it has no visible impact.

### 7b. Make Discount Validation Require Auth

**File:** `apps/smart-meal-planner-backend/app/routers/subscriptions.py` (line 127)

```python
# BEFORE:
async def validate_discount_code(
    request: DiscountCodeRequest,
    user: Optional[Dict] = Depends(get_user_from_token)
):

# AFTER:
async def validate_discount_code(
    request: DiscountCodeRequest,
    user: dict = Depends(get_user_from_token)  # Required, not Optional
):
```

**Functionality Risk:** The discount code input appears on the subscription/checkout page, which is only accessible to logged-in users. **No functional impact.**

### 7c. Clean Up Multiple Instacart Service Files

The frontend has multiple versions of the Instacart service file:
- `final_instacartBackendService.js`
- `instacartBackendService.js`
- `NEW_instacartBackendService.js`
- `updated_instacartBackendService.js`
- `proxy_instacartBackendService.js`

Only one should be active. The others should be deleted to reduce confusion and attack surface. Identify which one is imported in production components and remove the rest.

---

## 8. Database Changes

**No schema migrations are required for any of the security fixes.** All changes are in application code only:
- Auth guards are added in Python/FastAPI
- Credential defaults are removed from config
- API response fields are removed
- Duplicate route is removed

The only DB-adjacent change is the ownership verification queries added to menu endpoints — these are `SELECT user_id FROM menus WHERE id = %s` checks that use existing columns and indexes.

---

## 9. Functionality Risk & Fallbacks

### Risk Matrix

| Fix | Endpoints Affected | Frontend Impact | Risk Level | Fallback |
|---|---|---|---|---|
| `get_user_from_token` raises 401 | All authenticated endpoints | None — frontend already sends tokens | **Medium** | Deploy during low-traffic window; monitor 401 error rate in logs |
| Preferences auth guard | `GET/PUT /preferences/{id}` | None — token already sent | Low | If org client access breaks, add org-owner bypass |
| Menu read auth guards | `/latest/`, `/history/`, `/shared/` etc. | None — token already sent | Low | Test meal plan loading flow end-to-end |
| `generate-async` auth + user_id override | Menu generation | None — token already sent | Low | Monitor generation success rate after deploy |
| `job-status` auth guard | Menu polling | None — token already sent | **Medium** | If polling breaks, check token refresh timing |
| Admin endpoint lockdown | `/admin/*` in main.py | None — no frontend calls these | Low | Manually verify admin account works before locking |
| Remove SMTP default | Email sending | None if env var is set | **High if var missing** | Confirm Railway has `SMTP_PASSWORD` set BEFORE deploying |
| Remove JWT_SECRET default | All auth | Breaks entire app if var missing | **Critical if var missing** | Confirm Railway has `JWT_SECRET` set BEFORE deploying |
| Instacart API key rotation | Instacart cart integration | Requires updating env var in Railway | Medium | Update Railway var before rotating the key |
| Remove `user_id` from ratings | Public recipe ratings | None — UI doesn't display it | Low | None needed |

### Specific Scenarios to Watch

**1. Token Expiry During Polling**
`job-status` is polled every few seconds during menu generation. If the user's token expires mid-generation (unlikely but possible), the polling will now get 401 instead of silently working. The frontend should handle 401 by redirecting to login. Verify `MenuDisplayPage.jsx` handles 401 responses from `job-status`.

**2. Organization Clients Accessing Member Preferences**
`client_resources.py` may call preferences on behalf of org members. After adding the auth guard to `/preferences/{id}`, organization accounts must be allowed to read their clients' preferences. Check `client_resources.py` and add the org-owner bypass if needed.

**3. Shared Menu Access**
`GET /menu/{menu_id}` will now verify ownership. Users who have had menus shared with them need a path through. The existing `shared_menus` table should be used for the secondary check:
```python
# Check ownership OR shared access:
is_owner = menu["user_id"] == current_user["user_id"]
is_shared = check_shared_access(menu_id, current_user["user_id"])
if not is_owner and not is_shared:
    raise HTTPException(status_code=403, detail="Access denied")
```

**4. Guest/Preview Features**
If any publicly-accessible pages (landing page, example meal plans) call protected endpoints, they will break. Audit `LandingPage.jsx` and `ExampleMealPlansPage.jsx` to confirm they don't call `/menu/`, `/preferences/`, or `/ratings/` with a user ID.

---

## 10. Testing Checklist

After each phase deploy, verify:

### Phase 1 (Auth Fix)
- [ ] Valid token: requests succeed normally
- [ ] No token: returns 401 (not 200 or 500)
- [ ] Expired token: returns 401 with "Token has expired"
- [ ] Malformed token: returns 401 with "Invalid token"
- [ ] Login flow still works end-to-end
- [ ] Menu generation (full flow) still works

### Phase 2 (Credentials)
- [ ] Email sending works (password reset, verification)
- [ ] JWT auth still works (secret correctly picked up from env)
- [ ] Instacart connection status shows (without raw key in response)

### Phase 3 (Endpoint Auth)
- [ ] User can load their own meal plan history
- [ ] User can load their own preferences
- [ ] User CANNOT load another user's preferences (test with two accounts)
- [ ] Meal generation starts and completes
- [ ] Job status polling works throughout generation
- [ ] Org user can still access client preferences

### Phase 4 (Admin)
- [ ] Admin account can call `/admin/db-stats`
- [ ] Non-admin receives 403 on admin endpoints
- [ ] Unauthenticated caller receives 401 on admin endpoints

### Phase 5 (Data Cleanup)
- [ ] Recipe ratings display correctly without user IDs
- [ ] Discount code validation works on subscription page
- [ ] Instacart integration works after API key rotation

---

## 11. Implementation Order

```
Day 1 — No code changes needed:
  ✓ Rotate SMTP password in mboxhosting.com
  ✓ Update SMTP_PASSWORD in Railway
  ✓ Confirm JWT_SECRET is set in Railway
  ✓ Rotate Instacart API key
  ✓ Update INSTACART_API_KEY in Railway

Day 2 — Phase 1 + 2 (Foundation):
  1. Fix get_user_from_token to raise 401 (auth_utils.py)
  2. Add get_optional_user_from_token variant
  3. Remove JWT_SECRET and SMTP_PASSWORD hardcoded defaults (config.py)
  4. Add JWT_SECRET and SMTP_PASSWORD to validate_environment()
  5. Remove api_key from instacart_status.py response
  → Deploy and monitor error rates

Day 3 — Phase 3 (Endpoint Guards):
  6. Add auth to preferences GET and PUT
  7. Add auth to menu read endpoints (latest, history, grocery-list, shared)
  8. Add auth to menu/{menu_id} with ownership check
  9. Add auth to generate-async (override user_id from token)
  10. Add auth to job-status with user verification
  11. Add auth to active-jobs
  12. Add auth to PATCH nickname with ownership check
  13. Add auth to PATCH /{user_id}/progress in auth.py
  → Deploy and run full end-to-end test

Day 4 — Phase 4 + 5 (Cleanup):
  14. Add admin_required to all /admin/* endpoints in main.py
  15. Add admin_required to /db-stats and /debug/concurrency in menu.py
  16. Fix duplicate /shared route in menu.py
  17. Remove user_id from public recipe ratings response
  18. Make validate-discount require auth
  19. Delete unused instacart service files
  → Deploy and verify
```

---

## Files Modified Summary

| File | Changes |
|---|---|
| `app/config.py` | Remove 2 hardcoded defaults, add to validate_environment() |
| `app/utils/auth_utils.py` | Raise 401 instead of returning None, add optional variant |
| `app/routers/preferences.py` | Add auth + ownership check to GET and PUT |
| `app/routers/menu.py` | Add auth to 9 endpoints, fix duplicate route, add ownership checks |
| `app/routers/auth.py` | Add auth to PATCH /{user_id}/progress |
| `app/routers/instacart_status.py` | Remove raw api_key from response |
| `app/routers/subscriptions.py` | Make validate-discount require auth |
| `app/routers/recipe_ratings.py` | Remove user_id from public ratings SELECT |
| `app/main.py` | Add admin_required to 6 admin/debug endpoints |
| `apps/smart-meal-planner-web/src/services/` | Delete unused instacart service files |
