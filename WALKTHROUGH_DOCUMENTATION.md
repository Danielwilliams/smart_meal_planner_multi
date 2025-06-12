# Walkthrough Feature Documentation

## Overview
The walkthrough feature provides an onboarding experience for new users to guide them through setting up their preferences, generating their first meal plan, and creating a shopping list.

## Database Schema Changes

### Migration 013_add_walkthrough_progress.py
Added the following columns to `user_profiles` table:
- `walkthrough_preferences_completed` (BOOLEAN DEFAULT FALSE) - Tracks if user completed preferences step
- `walkthrough_menu_completed` (BOOLEAN DEFAULT FALSE) - Tracks if user generated their first menu
- `walkthrough_shopping_completed` (BOOLEAN DEFAULT FALSE) - Tracks if user created their first shopping list
- `walkthrough_completed` (BOOLEAN DEFAULT FALSE) - Tracks if entire walkthrough is complete
- `walkthrough_started_at` (TIMESTAMP) - When user started the walkthrough
- `walkthrough_completed_at` (TIMESTAMP) - When user completed the walkthrough

Also created index: `idx_user_profiles_walkthrough_completed` on (walkthrough_completed, walkthrough_completed_at)

## Backend API Changes

### Auth Router (/app/routers/auth.py)
1. **Login endpoint** now returns walkthrough progress fields:
   - `walkthrough_preferences_completed`
   - `walkthrough_menu_completed`
   - `walkthrough_shopping_completed`
   - `walkthrough_completed`

2. **Update Progress endpoint** (`PUT /auth/progress`):
   - Accepts progress updates for walkthrough fields
   - Automatically sets `walkthrough_started_at` on first interaction
   - Sets `walkthrough_completed_at` when walkthrough_completed is set to true

## Frontend Components

### OnboardingWalkthrough.jsx
A React component using react-joyride library that provides:
- Step-by-step guided tour
- Different step sequences for each page (preferences, menu, shopping list)
- Custom styling and tooltips
- Navigation between pages during the walkthrough
- Progress tracking and API updates

#### Walkthrough Steps:
1. **Preferences Page**:
   - Welcome message
   - Diet types selection
   - Recipe types selection
   - Preferred proteins
   - Meal schedule
   - Disliked ingredients
   - Save preferences

2. **Menu Generation Page**:
   - Menu settings explanation
   - Generate menu button
   - Menu customization options

3. **Shopping List Page**:
   - Shopping list overview
   - Store selection
   - List organization

### TestWalkthroughPage.jsx
A test page for developers to:
- Reset walkthrough progress
- Test individual walkthrough steps
- Debug walkthrough functionality

## Implementation Notes

1. The walkthrough uses `react-joyride` for the guided tour functionality
2. Progress is tracked both locally (localStorage) and in the database
3. Users can skip the walkthrough at any time
4. The walkthrough automatically progresses between pages
5. Existing users who have already completed these steps are marked as having completed the walkthrough

## Files Modified/Added
- `/app/migrations/versions/013_add_walkthrough_progress.py` - Database migration
- `/app/routers/auth.py` - API endpoints for progress tracking
- `/src/components/OnboardingWalkthrough.jsx` - Main walkthrough component
- `/src/pages/TestWalkthroughPage.jsx` - Testing page
- Various other frontend files to integrate the walkthrough component

## Rollback Considerations
When rolling back:
1. The database columns will remain (they won't break anything)
2. The migration can be kept to preserve the schema
3. Frontend walkthrough code can be removed or disabled
4. API endpoints will ignore walkthrough fields if not present in requests