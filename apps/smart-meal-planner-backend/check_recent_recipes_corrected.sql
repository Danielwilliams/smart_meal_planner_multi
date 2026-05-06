-- Check for recently added recipes in the database (corrected for actual schema)

-- Check total count of recipes
SELECT COUNT(*) as total_recipes FROM scraped_recipes;

-- Check most recent recipes by ID (assuming ID is auto-incrementing)
SELECT 
    id, 
    title, 
    source,
    source_url,
    cuisine,
    cooking_method,
    complexity
FROM scraped_recipes 
ORDER BY id DESC 
LIMIT 20;

-- Check for specific recipe titles that were mentioned in the scraper logs
SELECT 
    id, 
    title, 
    source,
    source_url,
    cuisine
FROM scraped_recipes 
WHERE title ILIKE '%Mexican Street Corn Nachos%'
   OR title ILIKE '%Copycat Olive Garden Salad%'
   OR title ILIKE '%Thai Noodle Salad%'
   OR title ILIKE '%Coconut Cupcakes%'
   OR title ILIKE '%Rasta Pasta%'
   OR title ILIKE '%Red Flannel Hash%'
   OR title ILIKE '%Caipirinha%'
   OR title ILIKE '%Goetta%'
ORDER BY id DESC;

-- Check what sources we have
SELECT source, COUNT(*) as recipe_count 
FROM scraped_recipes 
GROUP BY source 
ORDER BY recipe_count DESC;