-- Check for recently added recipes (using correct column names)

-- Check total count of recipes
SELECT COUNT(*) as total_recipes FROM scraped_recipes;

-- Check most recent recipes by date_scraped
SELECT 
    id, 
    title, 
    source,
    date_scraped,
    date_processed
FROM scraped_recipes 
WHERE date_scraped >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY date_scraped DESC 
LIMIT 20;

-- Check most recent recipes by ID (in case date_scraped isn't being set properly)
SELECT 
    id, 
    title, 
    source,
    source_url,
    date_scraped
FROM scraped_recipes 
ORDER BY id DESC 
LIMIT 20;

-- Check for specific recipe titles that were mentioned in the scraper logs
SELECT 
    id, 
    title, 
    source,
    source_url,
    date_scraped
FROM scraped_recipes 
WHERE title ILIKE '%Mexican Street Corn Nachos%'
   OR title ILIKE '%Copycat Olive Garden Salad%'
   OR title ILIKE '%Thai Noodle Salad%'
   OR title ILIKE '%Coconut Cupcakes%'
   OR title ILIKE '%Rasta Pasta%'
   OR title ILIKE '%Red Flannel Hash%'
   OR title ILIKE '%Caipirinha%'
   OR title ILIKE '%Goetta%'
   OR title ILIKE '%Horchata%'
   OR title ILIKE '%Baked Ground Beef Tacos%'
ORDER BY id DESC;

-- Check what sources we have and when they were last updated
SELECT 
    source, 
    COUNT(*) as recipe_count,
    MAX(date_scraped) as last_scraped,
    MAX(id) as highest_id
FROM scraped_recipes 
GROUP BY source 
ORDER BY last_scraped DESC;