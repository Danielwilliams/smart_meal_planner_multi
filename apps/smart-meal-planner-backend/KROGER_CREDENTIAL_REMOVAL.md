# Kroger Credential Removal Migration Guide

This document provides instructions for executing the Kroger credential removal migration (011_remove_kroger_credentials) which removes unused Kroger username and password fields from the database.

## Overview

The migration:
- Removes the following columns from the `user_profiles` table:
  - `kroger_username`
  - `kroger_password`
  - `kroger_password_hash`
  - `kroger_password_salt`
- Drops any related indexes
- Includes rollback capability (downgrade function)

## Migration Execution Options

### Option 1: Automatic Migration on Server Startup

The migration will run automatically on server startup if the following environment variables are set:

```bash
# Development/Staging
ENVIRONMENT=development
AUTO_MIGRATE_ON_STARTUP=true

# Production (requires additional variable)
ENVIRONMENT=production
AUTO_MIGRATE_ON_STARTUP=true
ENABLE_PROD_MIGRATIONS=true
```

### Option 2: Running Migration Directly

To run the migration manually:

```bash
# Navigate to the backend directory
cd apps/smart-meal-planner-backend

# Make sure dependencies are installed
pip install -r requirements.txt

# Run the migration script directly
python -m app.migrations.versions.011_remove_kroger_credentials
```

### Option 3: Running via Railway Admin Commands

If deployed on Railway, you can run the migration using the Railway CLI:

```bash
railway run python -m app.migrations.versions.011_remove_kroger_credentials
```

### Option 4: SQL Execution

If you prefer to run the SQL directly, use:

```sql
-- Verify the current state
SELECT 
    COUNT(*) as total_users,
    COUNT(kroger_username) as users_with_username,
    COUNT(kroger_password) as users_with_plaintext_password,
    COUNT(kroger_password_hash) as users_with_hashed_password,
    COUNT(kroger_password_salt) as users_with_salt
FROM user_profiles;

-- Drop columns
ALTER TABLE user_profiles DROP COLUMN IF EXISTS kroger_username;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS kroger_password;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS kroger_password_hash;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS kroger_password_salt;

-- Drop related indexes
DROP INDEX IF EXISTS idx_user_profiles_kroger_password_hash;
```

## Verification

After running the migration, verify that the columns have been removed:

```sql
-- Check that columns are gone
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND table_schema = 'public'
  AND column_name IN ('kroger_username', 'kroger_password', 'kroger_password_hash', 'kroger_password_salt');

-- Check that indexes are gone
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'user_profiles' 
  AND indexname LIKE '%kroger_password%';
```

## Rolling Back (If Needed)

If you need to roll back the migration:

### Using Migration System

Set the following environment variables and restart the server:

```bash
ROLLBACK_MIGRATION=011_remove_kroger_credentials
AUTO_MIGRATE_ON_STARTUP=true
```

### Manual SQL Rollback

```sql
-- Add back columns
ALTER TABLE user_profiles ADD COLUMN kroger_username VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN kroger_password VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN kroger_password_hash VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN kroger_password_salt VARCHAR(255);

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_user_profiles_kroger_password_hash 
ON user_profiles(kroger_password_hash) 
WHERE kroger_password_hash IS NOT NULL;
```

## Important Notes

1. This migration is **non-destructive** in the sense that it only removes columns, but it **is destructive** to the data in those columns.

2. Make a database backup before running this migration in production.

3. The backend code has already been updated to not use these fields, so there should be no functionality impact.

4. Kroger integration now uses OAuth exclusively and no longer stores credentials.

5. If you've made custom modifications to the Kroger authentication system, review those changes before applying this migration.

6. After running this migration, verify that all Kroger-related functionality (store selection, product search, etc.) still works as expected.

7. If you're running in a multi-server environment, make sure to run this migration during a maintenance window to ensure all servers are using the updated schema.