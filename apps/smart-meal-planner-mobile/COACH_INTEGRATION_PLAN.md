# Coach / Organization Mobile Integration Plan

## Current State Summary

| Feature | Web | Mobile | Backend |
|---|---|---|---|
| Org dashboard (tabbed) | ✅ Full | ❌ Fragmented | ✅ |
| Client list + status | ✅ | ⚠️ Basic (manual create only) | ✅ |
| Email invitations | ✅ | ❌ | ✅ |
| Client notes | ✅ Full CRUD | ❌ Missing | ✅ |
| Client meal plan creation | ✅ | ⚠️ Exists, limited | ✅ |
| Sharing menus to clients | ✅ | ⚠️ View only | ✅ |
| Onboarding forms (builder) | ✅ | ❌ Missing | ✅ |
| Onboarding forms (submission) | ✅ | ❌ Missing | ✅ |
| Organization recipes | ✅ Full CRUD | ❌ Read-only client view | ✅ |
| Organization branding | ✅ | ❌ Missing | ✅ |
| Client preferences (advanced) | ✅ Web edit link | ⚠️ Banner → web | ✅ |

---

## Phased Implementation Plan

### Phase 1 — High Value, Low Risk (1–2 weeks)

These are self-contained additions that unblock daily coach workflows.

#### 1.1 Email Invitations (replace manual account creation)

**Problem:** `organization_clients_screen.dart` currently creates client accounts with a hardcoded password. Real coaches use email invitations so clients set their own credentials.

**What to build:**
- Replace the "Add Client" form with an invite form (name + email only)
- Call `POST /api/organization-clients/invite` (or `/api/invitations`)
- Show pending invitations in the client list with a "Pending" badge
- Add resend invitation button

**API:** `POST /api/invitations` → `{ email, name, organization_id }`

**Files:** `organization_clients_screen.dart`, `api_service.dart`

---

#### 1.2 Share Menu to Client

**Problem:** `client_menus_screen.dart` shows existing menus read-only. Coaches cannot push a menu to a client from mobile.

**What to build:**
- Add a "Share to Client" button on each menu card in `client_menus_screen.dart`
- Confirm dialog: "Share [menu title] with [client name]?"
- On confirm, call `POST /api/menus/share/{menu_id}/client/{client_id}`
- Show success SnackBar with the client name

**API:** `POST /api/menus/share/{menu_id}/client/{client_id}`

**Files:** `client_menus_screen.dart`, `api_service.dart`

---

#### 1.3 Client Status Display

**Problem:** Mobile client list has no status indicator — coaches can't tell active from inactive clients at a glance.

**What to build:**
- Add `status` field (active/inactive/pending) to client list items
- Color-coded chip on each card (green = active, grey = inactive, amber = pending)
- Toggle active/inactive via long-press context menu

**API:** `GET /api/organization-clients` already returns status; `PUT /api/organization-clients/{client_id}` to update

**Files:** `organization_clients_screen.dart`

---

### Phase 2 — Core Coach Features (2–3 weeks)

Daily-use features that significantly expand mobile utility for coaches.

#### 2.1 Client Notes

**Problem:** No client notes on mobile at all. This is a primary day-to-day coaching tool.

**What to build:** New screen `client_notes_screen.dart`
- List of notes per client (title, type badge, priority indicator, timestamp)
- Create note: title, body, type (general/consultation/preference/goal/observation), priority (low/normal/high/urgent)
- Edit and delete notes
- Archive toggle
- Navigate from each client card in `organization_clients_screen.dart`

**API:**
- `GET /api/client-notes/{org_id}?client_id={id}` — list notes for a client
- `POST /api/client-notes/{org_id}` — create note
- `PUT /api/client-notes/{org_id}/notes/{note_id}` — update
- `DELETE /api/client-notes/{org_id}/notes/{note_id}` — delete

**Files:** New `client_notes_screen.dart`, update `organization_clients_screen.dart` to add "Notes" nav entry, `api_service.dart`

**Data shape:**
```dart
{
  'client_id': int,
  'title': String,
  'content': String,
  'note_type': 'general' | 'consultation' | 'preference' | 'goal' | 'observation',
  'priority': 'low' | 'normal' | 'high' | 'urgent',
  'is_archived': bool,
}
```

---

#### 2.2 Onboarding Form Submission (client-side)

**Problem:** When a coach creates an onboarding form on web, clients can't fill it in on mobile.

**What to build:** New screen `onboarding_form_screen.dart`
- Fetch form definition from `GET /api/onboarding-forms/{org_id}/{form_id}`
- Render fields dynamically: text, textarea, number, date, select, radio, checkbox
- Submit via `POST /api/onboarding-forms/{org_id}/{form_id}/submit`
- Show in client dashboard / org screen when a pending form exists

**Note:** The form _builder_ (drag-and-drop field creation) stays web-only for now. Mobile only handles _submission_.

**API:**
- `GET /api/onboarding-forms/{org_id}` — list forms
- `GET /api/onboarding-forms/{org_id}/{form_id}` — get form definition
- `POST /api/onboarding-forms/{org_id}/{form_id}/submit` — submit response

**Files:** New `onboarding_form_screen.dart`, `api_service.dart`

---

### Phase 3 — Advanced Features (3–4 weeks)

Features that add depth but are less urgent for daily workflows.

#### 3.1 Organization Recipes

**Problem:** Coaches can't create or manage org-specific recipes from mobile. `client_recipes_screen.dart` only shows client-saved recipes.

**What to build:**
- Rename/repurpose `client_recipes_screen.dart` or add a new `org_recipes_screen.dart`
- List org recipes with cuisine, difficulty, diet tag chips
- Create/edit/delete org recipes (reuse `user_recipe_form_screen.dart` UI pattern)
- Assign category, approval status
- "Add to client's plan" action

**API:** `/api/organization-recipes/{org_id}/recipes` (GET, POST, PUT, DELETE)

**Files:** New `org_recipes_screen.dart`, update `organization_screen.dart` to add tab/nav entry, `api_service.dart`

---

#### 3.2 Onboarding Form Builder (coach-side)

**Problem:** Coaches can't create intake forms from mobile.

**What to build:**
- Form list screen — view existing forms, create new, delete
- Form builder: add/remove/reorder fields, set field type and required flag
- This is complex — consider a banner "Build forms on web" similar to the client preferences banner if timeline is tight

**Recommendation:** Defer the builder to post-Phase 3. The submission flow (Phase 2.2) is more valuable since clients need it.

---

#### 3.3 Organization Branding

**Problem:** No branding management on mobile.

**What to build:** Settings-style screen with color pickers, logo upload (image picker), custom org name/tagline.

**Recommendation:** Lowest priority — this is an admin-level feature coaches set up once on web.

---

## Navigation Architecture

The current `organization_screen.dart` has 3 tabs. Target state:

```
Organization Screen
├── Tab: Clients
│   ├── Client card → client_preferences_screen (basic)
│   ├── Client card → client_notes_screen (new Phase 2.1)
│   ├── Client card → client_menus_screen (existing + share button)
│   └── Invite button (Phase 1.1)
├── Tab: Recipes (new Phase 3.1)
│   └── org_recipes_screen
└── Tab: Settings
    ├── Onboarding Forms list (Phase 2.2)
    └── Branding → "Edit on web" banner (Phase 3.3)
```

---

## API Service Methods Needed

```dart
// Phase 1
ApiService.inviteClient(orgId, email, name, authToken)
ApiService.shareMenuWithClient(menuId, clientId, authToken)
ApiService.updateClientStatus(clientId, status, authToken)

// Phase 2
ApiService.getClientNotes(orgId, clientId, authToken)
ApiService.createClientNote(orgId, data, authToken)
ApiService.updateClientNote(orgId, noteId, data, authToken)
ApiService.deleteClientNote(orgId, noteId, authToken)
ApiService.getOnboardingForms(orgId, authToken)
ApiService.getOnboardingForm(orgId, formId, authToken)
ApiService.submitOnboardingForm(orgId, formId, responses, authToken)

// Phase 3
ApiService.getOrgRecipes(orgId, authToken)
ApiService.createOrgRecipe(orgId, data, authToken)
ApiService.updateOrgRecipe(orgId, recipeId, data, authToken)
ApiService.deleteOrgRecipe(orgId, recipeId, authToken)
```

---

## Files to Create

| File | Phase | Purpose |
|---|---|---|
| `lib/Screens/client_notes_screen.dart` | 2.1 | Notes list + create/edit/delete per client |
| `lib/Screens/onboarding_form_screen.dart` | 2.2 | Dynamic form renderer + submission |
| `lib/Screens/org_recipes_screen.dart` | 3.1 | Org recipe library management |

## Files to Modify

| File | Phase | Change |
|---|---|---|
| `organization_clients_screen.dart` | 1.1, 1.3 | Email invite, status chips, Notes nav |
| `client_menus_screen.dart` | 1.2 | Share menu button |
| `organization_screen.dart` | 3 | Add Recipes + Settings tabs |
| `api_service.dart` | All | New API methods |
| `main.dart` | 2.1, 2.2, 3.1 | New routes |

---

## Deferred (Web-only indefinitely)

- **Onboarding form builder** — drag-and-drop form creation. Complexity doesn't justify mobile build; banner → web is sufficient.
- **Organization branding** — one-time setup. Banner → web is fine.
- **Subscription management** — stays on web to avoid app store fees.
