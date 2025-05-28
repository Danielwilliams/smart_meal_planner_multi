# Recipe Scraper Database Issues - Debugging Guide

## Problem
Scraper is successfully extracting recipes but they're not appearing in the database.

**Evidence:**
- Scraper logs show successful recipe extraction (Mexican Street Corn Nachos, etc.)
- Last SimplyRecipes in DB: April 13th, 2025 (ID: 1185)
- Current scrape: May 28th, 2025 - no new recipes in DB

## Most Likely Causes

### 1. Database Connection Issues
**Symptoms:** Scraper appears to work but no data inserted
**Possible causes:**
- Scraper connecting to different database than web app
- Environment variables mismatch
- Database credentials changed

**Quick Check:**
```bash
# Check your scraper's database configuration
echo $DATABASE_URL  # or whatever env var your scraper uses
```

### 2. Schema Compatibility Issues
**Recent changes that could break scraper:**
- `diet_tags` changed from TEXT[] to JSONB
- `flavor_profile` changed from TEXT[] to JSONB  
- New columns added: `spice_level`, `diet_type`, `meal_prep_type`, `appliances`

**Possible scraper errors:**
- Trying to insert TEXT[] into JSONB columns
- Missing required columns
- Constraint violations

### 3. Transaction Rollbacks
**Symptoms:** No error reported but no data persisted
**Possible causes:**
- Database constraint violations
- Invalid data format
- Transaction not committed

## Debugging Steps

### Step 1: Check Scraper Database Config
Make sure your scraper is using the same database as your web app.

### Step 2: Check for JSONB Format Issues
Your scraper might be trying to insert arrays like this:
```python
# OLD (broken after migration)
diet_tags = ['vegetarian', 'healthy']  # TEXT[] format

# NEW (required after migration)  
diet_tags = json.dumps(['vegetarian', 'healthy'])  # JSONB format
```

### Step 3: Check Error Handling
Look for silent failures in your scraper's database insertion code.

### Step 4: Test Manual Insert
Try manually inserting a recipe to see if there are constraint issues:

```sql
INSERT INTO scraped_recipes (
    title, source, source_url, instructions, 
    date_scraped, date_processed, complexity,
    diet_tags, flavor_profile, appliances
) VALUES (
    'Test Recipe', 
    'SimplyRecipes', 
    'https://test.com',
    '[]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, 
    'medium',
    '["vegetarian"]'::jsonb,  -- Note: JSONB format
    '["savory"]'::jsonb,      -- Note: JSONB format  
    '[]'::jsonb               -- Note: JSONB format
);
```

## Quick Fixes

### Fix 1: Update Array Insertions
If your scraper has code like this:
```python
# Change this
cursor.execute("INSERT INTO scraped_recipes (diet_tags) VALUES (%s)", [diet_tags_list])

# To this  
cursor.execute("INSERT INTO scraped_recipes (diet_tags) VALUES (%s::jsonb)", [json.dumps(diet_tags_list)])
```

### Fix 2: Add New Columns with Defaults
```python
# Add these to your INSERT statements
appliances = json.dumps([])  # Empty array as default
diet_type = None
spice_level = None  
meal_prep_type = None
```

### Fix 3: Check Required Fields
Make sure these are not NULL:
- title (required)
- source (required) 
- instructions (required, must be JSONB)
- date_scraped (required)
- date_processed (required)