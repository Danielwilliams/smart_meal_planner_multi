-- Check current scraped_recipes table structure
-- This will help us see what columns already exist vs what we need to add

-- Check all columns in scraped_recipes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'scraped_recipes' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if recipe_preferences table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'recipe_preferences'
) as recipe_preferences_exists;

-- If recipe_preferences exists, show its structure
DO $$
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'recipe_preferences'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'recipe_preferences table exists - showing structure:';
        -- This will be shown in the next query
    ELSE
        RAISE NOTICE 'recipe_preferences table does not exist';
    END IF;
END $$;

-- Show recipe_preferences structure if it exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'recipe_preferences' 
AND table_schema = 'public'
ORDER BY ordinal_position;