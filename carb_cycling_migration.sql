-- Carb Cycling Migration SQL
-- Run this in pgAdmin to add carb cycling functionality

-- Add carb cycling enabled flag
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS carb_cycling_enabled BOOLEAN DEFAULT FALSE;

-- Add carb cycling configuration JSONB column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS carb_cycling_config JSONB DEFAULT '{}';

-- Initialize default carb cycling configuration for existing users
UPDATE user_profiles 
SET carb_cycling_config = '{
    "pattern": "3-1-3",
    "high_carb_grams": 200,
    "moderate_carb_grams": 100,
    "low_carb_grams": 50,
    "no_carb_grams": 20,
    "weekly_schedule": {
        "monday": "high",
        "tuesday": "low",
        "wednesday": "high",
        "thursday": "moderate",
        "friday": "high",
        "saturday": "low",
        "sunday": "low"
    },
    "sync_with_workouts": false,
    "workout_days": [],
    "custom_pattern": false,
    "pattern_options": [
        {"name": "3-1-3", "description": "3 High, 1 Moderate, 3 Low carb days"},
        {"name": "2-2-3", "description": "2 High, 2 Moderate, 3 Low carb days"},
        {"name": "4-0-3", "description": "4 High, 0 Moderate, 3 Low carb days"},
        {"name": "5-0-2", "description": "5 High, 0 Moderate, 2 Low carb days"},
        {"name": "custom", "description": "Create your own custom pattern"}
    ],
    "carb_ranges": {
        "high": {"min": 150, "max": 300, "description": "High carb days (workout/active days)"},
        "moderate": {"min": 75, "max": 150, "description": "Moderate carb days (light activity)"},
        "low": {"min": 25, "max": 75, "description": "Low carb days (rest days)"},
        "no_carb": {"min": 0, "max": 25, "description": "Very low carb days (advanced)"}
    },
    "goals": {
        "primary": "fat_loss",
        "secondary": "maintain_muscle"
    },
    "notes": ""
}'::jsonb
WHERE carb_cycling_config = '{}'::jsonb OR carb_cycling_config IS NULL;

-- Create indexes for efficient carb cycling queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_carb_cycling_enabled 
ON user_profiles(carb_cycling_enabled);

CREATE INDEX IF NOT EXISTS idx_user_profiles_carb_cycling_config 
ON user_profiles USING gin(carb_cycling_config);

-- Verify the migration
SELECT COUNT(*) as total_users, 
       COUNT(CASE WHEN carb_cycling_enabled = FALSE THEN 1 END) as users_with_carb_cycling_disabled,
       COUNT(CASE WHEN carb_cycling_config IS NOT NULL THEN 1 END) as users_with_carb_config
FROM user_profiles;