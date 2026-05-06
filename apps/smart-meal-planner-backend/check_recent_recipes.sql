-- Check for recently added recipes in the database
-- This will help determine if the scraper is actually inserting data

-- Check total count of recipes
SELECT COUNT(*) as total_recipes FROM scraped_recipes;

-- Check most recent recipes by date_scraped
SELECT 
    id, 
    title, 
    source,
    date_scraped,
    date_processed,
    created_at
FROM scraped_recipes 
WHERE date_scraped >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY date_scraped DESC 
LIMIT 20;

-- Check most recent recipes by ID (if date_scraped is not set)
SELECT 
    id, 
    title, 
    source,
    date_scraped,
    date_processed
FROM scraped_recipes 
ORDER BY id DESC 
LIMIT 20;

-- Check for specific recipe titles that were mentioned in the logs
SELECT 
    id, 
    title, 
    source,
    date_scraped
FROM scraped_recipes 
WHERE title ILIKE '%Mexican Street Corn Nachos%'
   OR title ILIKE '%Copycat Olive Garden Salad%'
   OR title ILIKE '%Thai Noodle Salad%'
   OR title ILIKE '%Coconut Cupcakes%'
   OR title ILIKE '%Rasta Pasta%'
ORDER BY id DESC;