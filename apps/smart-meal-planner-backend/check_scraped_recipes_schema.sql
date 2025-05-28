-- Check current scraped_recipes table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'scraped_recipes' 
AND table_schema = 'public'
ORDER BY ordinal_position;