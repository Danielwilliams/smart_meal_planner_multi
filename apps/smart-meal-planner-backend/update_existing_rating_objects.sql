-- Update existing rating database objects safely

-- 1. First, let's see what exists
SELECT 'EXISTING VIEWS' as info;
SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE '%rating%';

SELECT 'EXISTING FUNCTIONS' as info;
SELECT n.nspname, p.proname FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' AND p.proname LIKE '%recipe_interaction%';

-- 2. Drop and recreate the views with correct structure
DROP VIEW IF EXISTS recipe_ratings_summary CASCADE;
DROP VIEW IF EXISTS user_rating_preferences CASCADE;

-- 3. Create/Replace the get_or_create_recipe_interaction function
CREATE OR REPLACE FUNCTION get_or_create_recipe_interaction(
    p_user_id INTEGER,
    p_recipe_id INTEGER,
    p_interaction_type VARCHAR(20)
) RETURNS INTEGER AS $$
DECLARE
    interaction_id INTEGER;
BEGIN
    -- Try to find existing interaction
    SELECT id INTO interaction_id
    FROM recipe_interactions
    WHERE user_id = p_user_id 
        AND recipe_id = p_recipe_id 
        AND interaction_type = p_interaction_type;
    
    -- If not found, create new interaction
    IF interaction_id IS NULL THEN
        INSERT INTO recipe_interactions (user_id, recipe_id, interaction_type, timestamp)
        VALUES (p_user_id, p_recipe_id, p_interaction_type, CURRENT_TIMESTAMP)
        RETURNING id INTO interaction_id;
    END IF;
    
    RETURN interaction_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Create recipe_ratings_summary view
CREATE VIEW recipe_ratings_summary AS
SELECT 
    recipe_id,
    COUNT(*) as total_ratings,
    AVG(rating_score) as avg_rating,
    MIN(rating_score) as min_rating,
    MAX(rating_score) as max_rating,
    STDDEV(rating_score) as rating_stddev,
    COUNT(CASE WHEN made_recipe = true THEN 1 END) as made_count,
    COUNT(CASE WHEN would_make_again = true THEN 1 END) as remake_count,
    CASE 
        WHEN COUNT(CASE WHEN made_recipe = true THEN 1 END) > 0 
        THEN (COUNT(CASE WHEN would_make_again = true THEN 1 END)::float / COUNT(CASE WHEN made_recipe = true THEN 1 END) * 100)
        ELSE 0 
    END as remake_percentage,
    AVG(difficulty_rating) as avg_difficulty,
    AVG(time_accuracy) as avg_time_accuracy,
    COUNT(CASE WHEN feedback_text IS NOT NULL AND feedback_text != '' THEN 1 END) as feedback_count,
    MAX(updated_at) as last_rated,
    -- Rating distribution
    COUNT(CASE WHEN rating_score = 1 THEN 1 END) as rating_1_count,
    COUNT(CASE WHEN rating_score = 2 THEN 1 END) as rating_2_count,
    COUNT(CASE WHEN rating_score = 3 THEN 1 END) as rating_3_count,
    COUNT(CASE WHEN rating_score = 4 THEN 1 END) as rating_4_count,
    COUNT(CASE WHEN rating_score = 5 THEN 1 END) as rating_5_count
FROM recipe_interactions
WHERE rating_score IS NOT NULL
GROUP BY recipe_id;

-- 5. Create user_rating_preferences view
CREATE VIEW user_rating_preferences AS
SELECT 
    user_id,
    COUNT(*) as total_ratings,
    AVG(rating_score) as avg_rating,
    STDDEV(rating_score) as rating_variance,
    
    -- Difficulty preferences
    AVG(difficulty_rating) as preferred_difficulty,
    
    -- Aspect preferences (from rating_aspects JSONB)
    AVG((rating_aspects->>'taste')::numeric) as avg_taste_rating,
    AVG((rating_aspects->>'ease_of_preparation')::numeric) as avg_ease_rating,
    AVG((rating_aspects->>'ingredient_availability')::numeric) as avg_ingredient_rating,
    AVG((rating_aspects->>'portion_size')::numeric) as avg_portion_rating,
    AVG((rating_aspects->>'nutrition_balance')::numeric) as avg_nutrition_rating,
    AVG((rating_aspects->>'presentation')::numeric) as avg_presentation_rating,
    
    -- Behavioral patterns
    COUNT(CASE WHEN made_recipe = true THEN 1 END) as recipes_made,
    COUNT(CASE WHEN would_make_again = true THEN 1 END) as recipes_would_remake,
    CASE 
        WHEN COUNT(CASE WHEN made_recipe = true THEN 1 END) > 0 
        THEN (COUNT(CASE WHEN would_make_again = true THEN 1 END)::float / COUNT(CASE WHEN made_recipe = true THEN 1 END))
        ELSE 0 
    END as remake_ratio,
    
    -- Time and effort preferences
    AVG(time_accuracy) as avg_time_accuracy,
    COUNT(CASE WHEN time_accuracy >= 4 THEN 1 END) as accurate_time_count,
    
    -- Rating patterns
    MIN(rating_score) as min_rating_given,
    MAX(rating_score) as max_rating_given,
    MODE() WITHIN GROUP (ORDER BY rating_score) as most_common_rating,
    
    -- Engagement metrics
    COUNT(CASE WHEN feedback_text IS NOT NULL AND feedback_text != '' THEN 1 END) as feedback_count,
    AVG(LENGTH(feedback_text)) as avg_feedback_length,
    
    -- Temporal patterns
    MIN(updated_at) as first_rating,
    MAX(updated_at) as last_rating,
    EXTRACT(DAYS FROM (MAX(updated_at) - MIN(updated_at))) as rating_span_days
    
FROM recipe_interactions
WHERE rating_score IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) >= 1;

-- 6. Create indexes for better performance (IF NOT EXISTS to avoid errors)
CREATE INDEX IF NOT EXISTS idx_recipe_interactions_rating_timestamp 
ON recipe_interactions(rating_score, updated_at) 
WHERE rating_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_interactions_user_rating 
ON recipe_interactions(user_id, rating_score) 
WHERE rating_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_interactions_recipe_rating 
ON recipe_interactions(recipe_id, rating_score) 
WHERE rating_score IS NOT NULL;

-- 7. Test the objects
SELECT 'SUCCESS: Function created' as status, 'get_or_create_recipe_interaction' as object_name
WHERE EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'get_or_create_recipe_interaction'
)
UNION ALL
SELECT 'SUCCESS: View created' as status, 'recipe_ratings_summary' as object_name
WHERE EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'recipe_ratings_summary'
)
UNION ALL
SELECT 'SUCCESS: View created' as status, 'user_rating_preferences' as object_name
WHERE EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'user_rating_preferences'
);

-- 8. Test the views work
SELECT 'Testing recipe_ratings_summary' as test;
SELECT COUNT(*) as view_row_count FROM recipe_ratings_summary;

SELECT 'Testing user_rating_preferences' as test;
SELECT COUNT(*) as view_row_count FROM user_rating_preferences;