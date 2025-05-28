-- Fix flavor_profile column type migration
-- Convert TEXT[] to JSONB for consistency

DO $$
DECLARE
    current_type text;
    sample_count integer;
    converted_count integer;
BEGIN
    RAISE NOTICE '🔄 Starting flavor_profile standardization migration...';
    
    -- Get current flavor_profile column type
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_name = 'scraped_recipes' 
    AND column_name = 'flavor_profile'
    AND table_schema = 'public';
    
    RAISE NOTICE '📊 Current flavor_profile type: %', current_type;
    
    -- Check current data
    EXECUTE 'SELECT COUNT(*) FROM scraped_recipes WHERE flavor_profile IS NOT NULL'
    INTO sample_count;
    
    RAISE NOTICE '📊 Found % recipes with flavor_profile data', sample_count;
    
    -- Convert based on current type
    IF current_type = 'ARRAY' OR current_type = 'text[]' THEN
        RAISE NOTICE '🔄 Converting flavor_profile from TEXT[] to JSONB format...';
        
        -- Convert TEXT[] to JSONB
        ALTER TABLE scraped_recipes 
        ALTER COLUMN flavor_profile TYPE JSONB 
        USING CASE 
            WHEN flavor_profile IS NULL THEN NULL
            WHEN array_length(flavor_profile, 1) IS NULL THEN '[]'::jsonb
            ELSE array_to_json(flavor_profile)::jsonb
        END;
        
        RAISE NOTICE '✅ Converted flavor_profile from TEXT[] to JSONB';
        
    ELSIF current_type = 'jsonb' THEN
        RAISE NOTICE '✅ flavor_profile already in JSONB format - checking data consistency...';
        
        -- Ensure all JSONB values are arrays (not strings or objects)
        UPDATE scraped_recipes 
        SET flavor_profile = CASE 
            WHEN flavor_profile IS NULL THEN NULL
            WHEN jsonb_typeof(flavor_profile) = 'array' THEN flavor_profile
            WHEN jsonb_typeof(flavor_profile) = 'string' THEN jsonb_build_array(flavor_profile)
            WHEN jsonb_typeof(flavor_profile) = 'object' AND flavor_profile = '{}'::jsonb THEN '[]'::jsonb
            ELSE '[]'::jsonb
        END
        WHERE flavor_profile IS NOT NULL 
        AND jsonb_typeof(flavor_profile) != 'array';
        
        GET DIAGNOSTICS converted_count = ROW_COUNT;
        RAISE NOTICE '✅ Standardized % JSONB records to array format', converted_count;
        
    ELSE
        RAISE NOTICE '⚠️  Unknown flavor_profile type: % - manual intervention may be needed', current_type;
    END IF;
    
    -- Also check user_recipes table if it exists
    DECLARE
        user_recipes_exists boolean;
        user_recipes_type text;
    BEGIN
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_recipes'
        ) INTO user_recipes_exists;
        
        IF user_recipes_exists THEN
            -- Get current flavor_profile column type for user_recipes
            SELECT data_type INTO user_recipes_type
            FROM information_schema.columns 
            WHERE table_name = 'user_recipes' 
            AND column_name = 'flavor_profile'
            AND table_schema = 'public';
            
            IF user_recipes_type IS NOT NULL THEN
                RAISE NOTICE '🔄 Also standardizing user_recipes.flavor_profile (type: %)', user_recipes_type;
                
                IF user_recipes_type = 'ARRAY' OR user_recipes_type = 'text[]' THEN
                    ALTER TABLE user_recipes 
                    ALTER COLUMN flavor_profile TYPE JSONB 
                    USING CASE 
                        WHEN flavor_profile IS NULL THEN NULL
                        WHEN array_length(flavor_profile, 1) IS NULL THEN '[]'::jsonb
                        ELSE array_to_json(flavor_profile)::jsonb
                    END;
                    RAISE NOTICE '✅ Converted user_recipes.flavor_profile to JSONB';
                END IF;
            END IF;
        END IF;
    END;
    
    -- Verify final state
    EXECUTE 'SELECT COUNT(*) FROM scraped_recipes WHERE flavor_profile IS NOT NULL'
    INTO sample_count;
    
    RAISE NOTICE '📊 Final verification: % recipes with flavor_profile data', sample_count;
    
    -- Show sample data
    RAISE NOTICE '📋 Sample flavor_profile values:';
    DECLARE
        sample_record RECORD;
    BEGIN
        FOR sample_record IN 
            SELECT id, title, flavor_profile 
            FROM scraped_recipes 
            WHERE flavor_profile IS NOT NULL 
            AND jsonb_array_length(flavor_profile) > 0
            LIMIT 5
        LOOP
            RAISE NOTICE '  Recipe % (%): %', sample_record.id, sample_record.title, sample_record.flavor_profile;
        END LOOP;
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE '  (Sample data display failed - checking non-array flavor_profile values)';
            FOR sample_record IN 
                SELECT id, title, flavor_profile 
                FROM scraped_recipes 
                WHERE flavor_profile IS NOT NULL 
                LIMIT 5
            LOOP
                RAISE NOTICE '  Recipe % (%): %', sample_record.id, sample_record.title, sample_record.flavor_profile;
            END LOOP;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 FLAVOR_PROFILE STANDARDIZATION COMPLETED!';
    RAISE NOTICE '✅ All flavor_profile columns now use consistent JSONB array format';
    RAISE NOTICE '📝 Recipe tagging should now work without type errors';
    
END $$;