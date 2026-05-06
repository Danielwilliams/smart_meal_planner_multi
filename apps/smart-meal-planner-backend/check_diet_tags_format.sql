-- Check current diet_tags format across all tables

-- Check scraped_recipes diet_tags column type
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE column_name = 'diet_tags' 
AND table_schema = 'public';

-- Sample diet_tags data from scraped_recipes
SELECT 
    id,
    title,
    diet_tags,
    pg_typeof(diet_tags) as diet_tags_type
FROM scraped_recipes 
WHERE diet_tags IS NOT NULL 
LIMIT 10;

-- Check if any other tables have diet_tags
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name LIKE '%diet%' 
AND table_schema = 'public'
ORDER BY table_name, column_name;