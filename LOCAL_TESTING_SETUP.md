# Local Testing Setup for Shopping List Fixes

This guide will help you set up a local development environment to test the shopping list quantity and categorization fixes before deploying.

## Prerequisites

- **Node.js 18.x** (for React frontend)
- **Python 3.8+** (for FastAPI backend)
- **PostgreSQL** (for database)
- **Git** (for version control)

## Quick Setup

### 1. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd apps/smart-meal-planner-backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies (Note: requirements.txt has encoding issues, so install manually)
pip install fastapi uvicorn psycopg2-binary python-dotenv pydantic openai sqlalchemy

# Set environment variables (create .env file)
# You'll need these variables:
# DATABASE_URL=postgresql://username:password@localhost:5432/meal_planner
# OPENAI_API_KEY=your_openai_key_here

# Run the backend server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup (React)

```bash
# Navigate to frontend directory  
cd apps/smart-meal-planner-web

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will run on `http://localhost:3000` and proxy API calls to the backend on `http://localhost:8000`.

## Testing the Fixes

### Test Case: Shopping List Quantities and Categorization

1. **Login/Create Account** at `http://localhost:3000`
2. **Generate a Menu** (or use existing menu ID 409 from your example)
3. **Navigate to Shopping List** for that menu
4. **Verify the fixes:**

   ✅ **Quantities are displayed properly:**
   - Should see "Beef Sirloin: 1 lb" not just "Beef Sirloin"
   - Should see "Bell Peppers: 6 medium" not just "Bell Peppers"

   ✅ **No double colons:**
   - Should see "Beef: 48 oz" not "Beef:: 48 oz"

   ✅ **No duplicate text:**
   - Should see "Bacon: 8 slices" not "Bacon: 8 Slice: 8 slices"
   - Should see "Tomato Sauce: 1 can" not "Tomato Sauce: 1 Can: 1 can"

   ✅ **Proper categorization:**
   - **Flank Steak** should be under "meat-seafood", not "beverages"
   - **Tomato Sauce** should be under "produce"
   - **Olive Oil** should be under "condiments"

   ✅ **All ingredients present:**
   - Should see ~50+ ingredients from the 7-day menu, not just 15

## Test Data

Use menu ID **409** which contains the 7-day meal plan with ingredients like:
- Beef (ground), Chicken Breast, Flank Steak
- Taco seasoning, Italian seasoning
- Bell peppers, Onions, Garlic
- Corn tortillas, Gluten-free pasta
- And many more...

## API Endpoints to Test

- `GET /menu/{menu_id}/grocery-list` - Basic grocery list
- `GET /menu/{menu_id}` - Menu details

## Debugging

### Backend Logs
```bash
# Check backend logs for ingredient processing
tail -f backend_logs.txt
```

### Frontend Console
- Open browser DevTools → Console
- Look for debug logs showing:
  - "Grocery list already in category format"
  - "Categorized items for display"

### Common Issues

1. **Empty Shopping List**: Check if menu ID 409 exists in your local database
2. **CORS Errors**: Make sure frontend is proxying to correct backend URL
3. **Missing Dependencies**: Manually install Python packages if requirements.txt has encoding issues

## Manual Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] Can load shopping list page
- [ ] Quantities are displayed with items
- [ ] No double colons (::) in item names
- [ ] No duplicate text in quantities
- [ ] Flank Steak categorized under meat-seafood
- [ ] All ~50+ ingredients show up (not just 15)
- [ ] Categories are logically organized

## Deploy When Ready

Once all tests pass locally:
```bash
git add .
git commit -m "Fix shopping list quantities and categorization"
git push
```

This ensures the fixes work before pushing to production!