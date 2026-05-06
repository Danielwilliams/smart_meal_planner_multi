-- Add notes column to scraped_recipes table
-- This allows storing recipe notes from scrapers and manual entry in recipe admin

DO $$
DECLARE
    column_exists boolean;
BEGIN
    RAISE NOTICE '🔄 Adding notes column to scraped_recipes table...';
    
    -- Check if notes column already exists
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scraped_recipes' 
        AND column_name = 'notes'
        AND table_schema = 'public'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✅ notes column already exists in scraped_recipes table';
    ELSE
        -- Add the notes column
        ALTER TABLE scraped_recipes ADD COLUMN notes TEXT;
        
        RAISE NOTICE '✅ Added notes column to scraped_recipes table';
        
        -- Create index for notes text search (optional, for performance)
        CREATE INDEX IF NOT EXISTS idx_scraped_recipes_notes_search 
        ON scraped_recipes USING gin(to_tsvector('english', notes));
        
        RAISE NOTICE '✅ Added full-text search index on notes column';
    END IF;
    
    -- Check final state
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scraped_recipes' 
        AND column_name = 'notes'
        AND table_schema = 'public'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '📝 notes column is now available for storing recipe notes';
        RAISE NOTICE '💡 This enables:';
        RAISE NOTICE '   - Recipe scrapers to capture notes from source websites';
        RAISE NOTICE '   - Manual note entry in the recipe admin panel';
        RAISE NOTICE '   - Full-text search across recipe notes';
    ELSE
        RAISE EXCEPTION '❌ Failed to add notes column';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 NOTES COLUMN MIGRATION COMPLETED!';
    
END $$;