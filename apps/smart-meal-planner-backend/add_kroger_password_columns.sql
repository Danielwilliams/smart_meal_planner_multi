-- Add columns for hashed Kroger passwords
-- This script adds the necessary columns to store hashed passwords and salts

-- Add kroger_password_hash column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND table_schema = 'public'
        AND column_name = 'kroger_password_hash'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN kroger_password_hash VARCHAR(255);
        RAISE NOTICE 'Added kroger_password_hash column';
    ELSE
        RAISE NOTICE 'Column kroger_password_hash already exists';
    END IF;
END $$;

-- Add kroger_password_salt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND table_schema = 'public'
        AND column_name = 'kroger_password_salt'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN kroger_password_salt VARCHAR(255);
        RAISE NOTICE 'Added kroger_password_salt column';
    ELSE
        RAISE NOTICE 'Column kroger_password_salt already exists';
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_kroger_password_hash 
    ON user_profiles(kroger_password_hash) 
    WHERE kroger_password_hash IS NOT NULL;

-- Add a comment to document the migration
COMMENT ON COLUMN user_profiles.kroger_password_hash IS 'Hashed Kroger password using PBKDF2-HMAC-SHA256';
COMMENT ON COLUMN user_profiles.kroger_password_salt IS 'Salt used for hashing Kroger password';

-- Show current state
SELECT 
    COUNT(*) as total_users,
    COUNT(kroger_username) as users_with_kroger_username,
    COUNT(kroger_password) as users_with_kroger_password,
    COUNT(kroger_password_hash) as users_with_hashed_password
FROM user_profiles;