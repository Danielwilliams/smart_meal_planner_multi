-- Kroger Password Security Migration SQL
-- This script helps identify and migrate plain text Kroger passwords to secure hashed storage

-- ============================================================================
-- STEP 1: Check current password status
-- ============================================================================

-- Check how many users have plain text vs hashed passwords
SELECT 
    COUNT(*) as total_users,
    COUNT(kroger_username) as users_with_username,
    COUNT(kroger_password) as users_with_plain_password,
    COUNT(kroger_password_hash) as users_with_hashed_password,
    COUNT(kroger_password_salt) as users_with_salt,
    COUNT(CASE WHEN kroger_password IS NOT NULL AND kroger_password_hash IS NOT NULL THEN 1 END) as users_with_both_formats
FROM user_profiles;

-- List users with plain text passwords that need migration
SELECT 
    id,
    kroger_username,
    LENGTH(kroger_password) as password_length,
    kroger_password_hash IS NOT NULL as has_hash,
    kroger_password_salt IS NOT NULL as has_salt,
    created_at
FROM user_profiles 
WHERE kroger_password IS NOT NULL 
AND kroger_password != ''
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 2: Ensure hash columns exist (run if needed)
-- ============================================================================

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

-- Create index for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_kroger_password_hash 
    ON user_profiles(kroger_password_hash) 
    WHERE kroger_password_hash IS NOT NULL;

-- Add column comments
COMMENT ON COLUMN user_profiles.kroger_password_hash IS 'Hashed Kroger password using PBKDF2-HMAC-SHA256';
COMMENT ON COLUMN user_profiles.kroger_password_salt IS 'Salt used for hashing Kroger password';

-- ============================================================================
-- STEP 3: Migration verification queries
-- ============================================================================

-- After running the Python migration, verify the results:

-- Check migration progress
SELECT 
    'Migration Progress' as status,
    COUNT(*) as total_kroger_users,
    COUNT(CASE WHEN kroger_password IS NOT NULL THEN 1 END) as remaining_plain_text,
    COUNT(CASE WHEN kroger_password_hash IS NOT NULL THEN 1 END) as users_with_hash,
    ROUND(
        COUNT(CASE WHEN kroger_password_hash IS NOT NULL THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN kroger_username IS NOT NULL THEN 1 END), 0), 
        2
    ) as migration_percentage
FROM user_profiles 
WHERE kroger_username IS NOT NULL;

-- ============================================================================
-- STEP 4: Security cleanup (run after successful migration)
-- ============================================================================

-- WARNING: Only run this AFTER confirming the migration worked!
-- This will permanently remove plain text passwords

-- Preview what will be cleared:
SELECT 
    id,
    kroger_username,
    'Will be cleared' as kroger_password_status,
    kroger_password_hash IS NOT NULL as has_secure_hash
FROM user_profiles 
WHERE kroger_password IS NOT NULL 
AND kroger_password_hash IS NOT NULL;

-- UNCOMMENT AND RUN ONLY AFTER MIGRATION IS VERIFIED:
-- UPDATE user_profiles 
-- SET kroger_password = NULL 
-- WHERE kroger_password IS NOT NULL 
-- AND kroger_password_hash IS NOT NULL;

-- ============================================================================
-- STEP 5: Final verification
-- ============================================================================

-- Verify security state after cleanup
SELECT 
    'Final Security Status' as check_type,
    COUNT(*) as total_users,
    COUNT(CASE WHEN kroger_password IS NOT NULL THEN 1 END) as users_with_plain_text,
    COUNT(CASE WHEN kroger_password_hash IS NOT NULL THEN 1 END) as users_with_hashed_password,
    CASE 
        WHEN COUNT(CASE WHEN kroger_password IS NOT NULL AND kroger_password_hash IS NOT NULL THEN 1 END) = 0 
        THEN '✅ SECURE - No plain text passwords found'
        ELSE '⚠️ WARNING - Plain text passwords still exist'
    END as security_status
FROM user_profiles;

-- Show any remaining security issues
SELECT 
    id,
    kroger_username,
    '⚠️ SECURITY ISSUE' as issue,
    'Plain text password exists without hash' as description
FROM user_profiles 
WHERE kroger_password IS NOT NULL 
AND kroger_password_hash IS NULL;

-- ============================================================================
-- NOTES FOR MANUAL MIGRATION (if needed)
-- ============================================================================

/*
IMPORTANT: SQL cannot directly hash passwords with PBKDF2-HMAC-SHA256.
You MUST use one of these methods to properly hash the passwords:

METHOD 1 - Use the Python migration script:
cd /path/to/your/backend
python3 migrate_kroger_passwords.py

METHOD 2 - Use the API endpoints:
POST /admin/migrate-kroger-passwords
POST /admin/clear-plain-passwords

METHOD 3 - Use the migration runner:
python3 app/migrations/versions/001_hash_kroger_passwords.py

METHOD 4 - Use psql with a custom function (advanced):
This would require creating a PostgreSQL extension or function
that can perform PBKDF2-HMAC-SHA256 hashing, which is not standard.

NEVER attempt to hash passwords using MD5, SHA1, or simple SQL functions!
These are not secure for password storage.
*/