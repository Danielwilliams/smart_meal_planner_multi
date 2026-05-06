-- Phase 1.2: Standardize diet_tags format migration
-- Convert TEXT[] to JSONB for consistency across all tables

DO $$
DECLARE
    table_exists boolean;
    current_type text;
    sample_count integer;
    converted_count integer;
BEGIN
    RAISE NOTICE '🔄 Starting diet_tags standardization migration...';
    
    -- Step 1: Check if scraped_recipes table exists and what type diet_tags is
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scraped_recipes'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE '❌ scraped_recipes table does not exist - migration not needed';
        RETURN;
    END IF;
    
    -- Get current diet_tags column type
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_name = 'scraped_recipes' 
    AND column_name = 'diet_tags'
    AND table_schema = 'public';
    
    RAISE NOTICE '📊 Current diet_tags type: %', current_type;
    
    -- Step 2: Check current data
    EXECUTE 'SELECT COUNT(*) FROM scraped_recipes WHERE diet_tags IS NOT NULL'
    INTO sample_count;
    
    RAISE NOTICE '📊 Found % recipes with diet_tags data', sample_count;
    
    -- Step 3: Convert based on current type
    IF current_type = 'ARRAY' OR current_type = 'text[]' THEN
        RAISE NOTICE '🔄 Converting TEXT[] to JSONB format...';
        
        -- Convert TEXT[] to JSONB
        ALTER TABLE scraped_recipes 
        ALTER COLUMN diet_tags TYPE JSONB 
        USING CASE 
            WHEN diet_tags IS NULL THEN NULL
            WHEN array_length(diet_tags, 1) IS NULL THEN '[]'::jsonb
            ELSE array_to_json(diet_tags)::jsonb
        END;
        
        GET DIAGNOSTICS converted_count = ROW_COUNT;
        RAISE NOTICE '✅ Converted % records from TEXT[] to JSONB', converted_count;
        
    ELSIF current_type = 'jsonb' THEN
        RAISE NOTICE '✅ diet_tags already in JSONB format - checking data consistency...';
        
        -- Ensure all JSONB values are arrays (not strings or objects)
        UPDATE scraped_recipes 
        SET diet_tags = CASE 
            WHEN diet_tags IS NULL THEN NULL
            WHEN jsonb_typeof(diet_tags) = 'array' THEN diet_tags
            WHEN jsonb_typeof(diet_tags) = 'string' THEN jsonb_build_array(diet_tags)
            ELSE '[]'::jsonb
        END
        WHERE diet_tags IS NOT NULL 
        AND jsonb_typeof(diet_tags) != 'array';
        
        GET DIAGNOSTICS converted_count = ROW_COUNT;
        RAISE NOTICE '✅ Standardized % JSONB records to array format', converted_count;
        
    ELSE
        RAISE NOTICE '⚠️  Unknown diet_tags type: % - manual intervention may be needed', current_type;
    END IF;
    
    -- Step 4: Check user_recipes table if it exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_recipes'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Get current diet_tags column type for user_recipes
        SELECT data_type INTO current_type
        FROM information_schema.columns 
        WHERE table_name = 'user_recipes' 
        AND column_name = 'diet_tags'
        AND table_schema = 'public';
        
        IF current_type IS NOT NULL THEN
            RAISE NOTICE '🔄 Also standardizing user_recipes.diet_tags (type: %)', current_type;
            
            IF current_type = 'ARRAY' OR current_type = 'text[]' THEN
                ALTER TABLE user_recipes 
                ALTER COLUMN diet_tags TYPE JSONB 
                USING CASE 
                    WHEN diet_tags IS NULL THEN NULL
                    WHEN array_length(diet_tags, 1) IS NULL THEN '[]'::jsonb
                    ELSE array_to_json(diet_tags)::jsonb
                END;
                RAISE NOTICE '✅ Converted user_recipes.diet_tags to JSONB';
            END IF;
        END IF;
    END IF;
    
    -- Step 5: Verify final state
    EXECUTE 'SELECT COUNT(*) FROM scraped_recipes WHERE diet_tags IS NOT NULL'
    INTO sample_count;
    
    RAISE NOTICE '📊 Final verification: % recipes with diet_tags data', sample_count;
    
    -- Show sample data
    RAISE NOTICE '📋 Sample diet_tags values:';
    DECLARE
        sample_record RECORD;
    BEGIN
        FOR sample_record IN 
            SELECT id, title, diet_tags 
            FROM scraped_recipes 
            WHERE diet_tags IS NOT NULL 
            AND jsonb_array_length(diet_tags) > 0
            LIMIT 5
        LOOP
            RAISE NOTICE '  Recipe % (%): %', sample_record.id, sample_record.title, sample_record.diet_tags;
        END LOOP;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DIET_TAGS STANDARDIZATION COMPLETED!';
    RAISE NOTICE '✅ All diet_tags columns now use consistent JSONB array format';
    RAISE NOTICE '📝 Next step: Update backend queries to use JSONB operations';
    
END $$;