-- Phase 1.3: Merge Recipe Preferences into Scraped Recipes
-- This eliminates the recipe_preferences table by consolidating into scraped_recipes

DO $$
DECLARE
    preferences_exists boolean;
    scraped_recipes_exists boolean;
    preferences_count integer;
    column_exists boolean;
    migrated_count integer;
BEGIN
    RAISE NOTICE '🔄 Starting Phase 1.3: Recipe Preferences Migration...';
    
    -- Step 1: Check if tables exist
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'recipe_preferences'
    ) INTO preferences_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scraped_recipes'
    ) INTO scraped_recipes_exists;
    
    IF NOT scraped_recipes_exists THEN
        RAISE EXCEPTION '❌ scraped_recipes table does not exist!';
    END IF;
    
    IF NOT preferences_exists THEN
        RAISE NOTICE '✅ recipe_preferences table does not exist - migration not needed';
        RETURN;
    END IF;
    
    -- Step 2: Check current data in recipe_preferences
    EXECUTE 'SELECT COUNT(*) FROM recipe_preferences' INTO preferences_count;
    RAISE NOTICE '📊 Found % records in recipe_preferences table', preferences_count;
    
    -- Step 3: Add missing columns to scraped_recipes if they don't exist
    
    -- Check and add spice_level column
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scraped_recipes' 
        AND column_name = 'spice_level'
        AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE scraped_recipes ADD COLUMN spice_level VARCHAR(20);
        RAISE NOTICE '✅ Added spice_level column to scraped_recipes';
    ELSE
        RAISE NOTICE '✅ spice_level column already exists in scraped_recipes';
    END IF;
    
    -- Check and add diet_type column
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scraped_recipes' 
        AND column_name = 'diet_type'
        AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE scraped_recipes ADD COLUMN diet_type VARCHAR(50);
        RAISE NOTICE '✅ Added diet_type column to scraped_recipes';
    ELSE
        RAISE NOTICE '✅ diet_type column already exists in scraped_recipes';
    END IF;
    
    -- Check and add meal_prep_type column (maps to meal_part)
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scraped_recipes' 
        AND column_name = 'meal_prep_type'
        AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE scraped_recipes ADD COLUMN meal_prep_type VARCHAR(50);
        RAISE NOTICE '✅ Added meal_prep_type column to scraped_recipes';
    ELSE
        RAISE NOTICE '✅ meal_prep_type column already exists in scraped_recipes';
    END IF;
    
    -- Check and add appliances column
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scraped_recipes' 
        AND column_name = 'appliances'
        AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE scraped_recipes ADD COLUMN appliances JSONB DEFAULT '[]';
        RAISE NOTICE '✅ Added appliances column to scraped_recipes';
    ELSE
        RAISE NOTICE '✅ appliances column already exists in scraped_recipes';
    END IF;
    
    -- Step 4: Migrate data from recipe_preferences to scraped_recipes
    RAISE NOTICE '🔄 Migrating preference data to scraped_recipes...';
    
    -- Update scraped_recipes with data from recipe_preferences
    UPDATE scraped_recipes sr
    SET 
        cuisine = COALESCE(sr.cuisine, rp.preferences->>'cuisine'),
        cooking_method = COALESCE(sr.cooking_method, rp.preferences->>'recipe_format'),
        meal_prep_type = COALESCE(sr.meal_prep_type, rp.preferences->>'meal_prep_type'),
        spice_level = COALESCE(sr.spice_level, rp.preferences->>'spice_level'),
        complexity = COALESCE(sr.complexity, (rp.preferences->>'prep_complexity')::VARCHAR),
        diet_type = COALESCE(sr.diet_type, rp.preferences->>'diet_type'),
        appliances = COALESCE(sr.appliances, 
            CASE 
                WHEN rp.preferences ? 'appliances' THEN rp.preferences->'appliances'
                ELSE '[]'::jsonb
            END
        )
    FROM recipe_preferences rp
    WHERE sr.id = rp.recipe_id;
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE '✅ Updated % recipes with preference data', migrated_count;
    
    -- Step 5: Verify data integrity before dropping table
    DECLARE
        orphaned_count integer;
        preference_sample RECORD;
    BEGIN
        -- Check for recipe_preferences that couldn't be migrated
        SELECT COUNT(*) INTO orphaned_count
        FROM recipe_preferences rp
        LEFT JOIN scraped_recipes sr ON rp.recipe_id = sr.id
        WHERE sr.id IS NULL;
        
        IF orphaned_count > 0 THEN
            RAISE WARNING '⚠️  Found % recipe_preferences with no matching scraped_recipe', orphaned_count;
            
            -- Log some examples
            FOR preference_sample IN
                SELECT rp.id, rp.recipe_id, rp.preferences
                FROM recipe_preferences rp
                LEFT JOIN scraped_recipes sr ON rp.recipe_id = sr.id
                WHERE sr.id IS NULL
                LIMIT 5
            LOOP
                RAISE WARNING '  Orphaned preference ID % for recipe_id %', preference_sample.id, preference_sample.recipe_id;
            END LOOP;
        ELSE
            RAISE NOTICE '✅ All recipe_preferences successfully linked to scraped_recipes';
        END IF;
    END;
    
    -- Step 6: Show sample of migrated data
    RAISE NOTICE '📋 Sample of migrated preference data:';
    DECLARE
        sample_recipe RECORD;
    BEGIN
        FOR sample_recipe IN
            SELECT id, title, cuisine, spice_level, diet_type, complexity
            FROM scraped_recipes
            WHERE spice_level IS NOT NULL OR diet_type IS NOT NULL
            LIMIT 5
        LOOP
            RAISE NOTICE '  Recipe % (%): cuisine=%, spice=%, diet=%, complexity=%', 
                sample_recipe.id, sample_recipe.title, sample_recipe.cuisine, 
                sample_recipe.spice_level, sample_recipe.diet_type, sample_recipe.complexity;
        END LOOP;
    END;
    
    -- Step 7: Create backup table before dropping (optional safety measure)
    RAISE NOTICE '🔄 Creating backup of recipe_preferences before dropping...';
    CREATE TABLE recipe_preferences_backup AS SELECT * FROM recipe_preferences;
    RAISE NOTICE '✅ Created recipe_preferences_backup table';
    
    -- Step 8: Drop the original recipe_preferences table
    RAISE NOTICE '🗑️ Dropping recipe_preferences table...';
    DROP TABLE recipe_preferences CASCADE;
    RAISE NOTICE '✅ Dropped recipe_preferences table';
    
    -- Step 9: Verify final state
    DECLARE
        final_count integer;
    BEGIN
        SELECT COUNT(*) INTO final_count
        FROM scraped_recipes
        WHERE spice_level IS NOT NULL 
           OR diet_type IS NOT NULL 
           OR meal_prep_type IS NOT NULL;
        
        RAISE NOTICE '📊 Final verification: % recipes now have preference data in scraped_recipes', final_count;
    END;
    
    -- Step 10: Record the migration
    CREATE TABLE IF NOT EXISTS applied_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        execution_time_seconds FLOAT
    );
    
    INSERT INTO applied_migrations (migration_name, status) 
    VALUES ('011_merge_recipe_preferences', 'success')
    ON CONFLICT (migration_name) DO UPDATE SET 
        status = 'success',
        applied_at = CURRENT_TIMESTAMP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 PHASE 1.3 MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '✅ Recipe preferences consolidated into scraped_recipes';
    RAISE NOTICE '🗑️  recipe_preferences table eliminated';  
    RAISE NOTICE '💾 Backup created as recipe_preferences_backup';
    RAISE NOTICE '📝 Next step: Update backend APIs to use scraped_recipes directly';
    
END $$;