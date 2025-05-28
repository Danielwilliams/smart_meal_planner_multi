-- Manual Recipe Components Migration (010)
-- Run this directly in your PostgreSQL client (pgAdmin, psql, etc.)

-- Step 1: Check if recipe_components table exists
DO $$
DECLARE
    table_exists boolean;
    total_components integer;
    updated_count integer;
    orphaned_count integer;
    remaining_components integer;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'recipe_components'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE '✅ recipe_components table does not exist - migration already complete!';
        
        -- Ensure applied_migrations table exists and mark this migration as complete
        CREATE TABLE IF NOT EXISTS applied_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(50) DEFAULT 'success',
            error_message TEXT,
            execution_time_seconds FLOAT
        );
        
        INSERT INTO applied_migrations (migration_name, status) 
        VALUES ('010_consolidate_recipe_components', 'success')
        ON CONFLICT (migration_name) DO UPDATE SET 
            status = 'success',
            applied_at = CURRENT_TIMESTAMP;
            
        RAISE NOTICE '📝 Migration marked as completed in tracking table';
        RETURN;
    END IF;
    
    -- Step 2: Get current data stats
    SELECT COUNT(*) INTO total_components FROM recipe_components;
    RAISE NOTICE '📊 Found % total components in recipe_components table', total_components;
    
    -- Step 3: Copy component_type data to scraped_recipes
    RAISE NOTICE '🔄 Copying component_type data to scraped_recipes...';
    
    UPDATE scraped_recipes sr 
    SET component_type = rc.component_type
    FROM recipe_components rc 
    WHERE sr.id = rc.recipe_id 
    AND (sr.component_type IS NULL OR sr.component_type = '');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Updated % recipes with component_type', updated_count;
    
    -- Step 4: Verify no data loss
    RAISE NOTICE '🔍 Verifying data integrity...';
    
    SELECT COUNT(*) INTO orphaned_count
    FROM recipe_components rc
    LEFT JOIN scraped_recipes sr ON rc.recipe_id = sr.id
    WHERE sr.component_type IS NULL OR sr.component_type = '';
    
    IF orphaned_count > 0 THEN
        RAISE EXCEPTION '❌ DANGER: % components would lose data! Migration aborted.', orphaned_count;
    END IF;
    
    -- Step 5: Drop foreign key constraints
    RAISE NOTICE '🔗 Dropping foreign key constraints...';
    
    -- Drop constraints that reference recipe_components
    DECLARE
        constraint_record RECORD;
    BEGIN
        FOR constraint_record IN
            SELECT conname, conrelid::regclass as table_name
            FROM pg_constraint 
            WHERE confrelid = 'recipe_components'::regclass
        LOOP
            RAISE NOTICE 'Dropping constraint % on table %', constraint_record.conname, constraint_record.table_name;
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %s', constraint_record.table_name, constraint_record.conname);
        END LOOP;
    END;
    
    -- Step 6: Drop the table
    RAISE NOTICE '🗑️ Dropping recipe_components table...';
    DROP TABLE recipe_components CASCADE;
    
    -- Step 7: Final verification
    SELECT COUNT(*) INTO remaining_components
    FROM scraped_recipes 
    WHERE component_type IS NOT NULL AND component_type != '';
    
    RAISE NOTICE '✅ Final result: % recipes have component_type in scraped_recipes', remaining_components;
    
    -- Step 8: Record the migration
    CREATE TABLE IF NOT EXISTS applied_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        execution_time_seconds FLOAT
    );
    
    INSERT INTO applied_migrations (migration_name, status) 
    VALUES ('010_consolidate_recipe_components', 'success')
    ON CONFLICT (migration_name) DO UPDATE SET 
        status = 'success',
        applied_at = CURRENT_TIMESTAMP;
    
    RAISE NOTICE '📝 Migration recorded in applied_migrations table';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RECIPE COMPONENTS MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '📊 Summary: % total components migrated, recipe_components table eliminated', total_components;
    
END $$;