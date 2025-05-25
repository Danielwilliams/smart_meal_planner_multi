# Smart Meal Planner Backend - Deployment Guide

## Overview
This guide covers deploying the Smart Meal Planner backend with automatic Kroger password hashing migrations that run on server startup.

## Migration System Features

### ✅ Automatic Startup Migrations
- Migrations run automatically when the server starts
- Only pending migrations are executed
- Migration status is tracked in the database
- Environment-specific configuration controls

### ✅ Production Safety
- Production requires explicit enablement
- Environment-based configuration
- Comprehensive logging and error handling
- Non-destructive migrations (backward compatible)

### ✅ Migration Tracking
- `applied_migrations` table tracks all executed migrations
- Prevents duplicate execution
- Records execution time and status
- Detailed error logging

## Environment Variables

### Required for All Environments
```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Basic App Configuration  
ENVIRONMENT=development|staging|production
```

### Migration Control Variables
```bash
# Auto-migrate on startup (default: true for dev/staging, false for production)
AUTO_MIGRATE_ON_STARTUP=true|false

# Production migration enablement (required for production)
ENABLE_PROD_MIGRATIONS=true|false

# Require confirmation for migrations (default: true for production)
MIGRATION_REQUIRE_CONFIRMATION=true|false

# Backup before migrations (default: true for production)
MIGRATION_BACKUP_BEFORE=true|false
```

## Deployment Scenarios

### 1. Development Deployment
```bash
# Environment variables
ENVIRONMENT=development
AUTO_MIGRATE_ON_STARTUP=true

# Start server - migrations run automatically
python -m uvicorn app.main:app --reload
```

**Behavior:**
- ✅ Migrations run automatically on startup
- ✅ Server continues even if migrations fail
- ✅ Detailed logging for debugging

### 2. Staging Deployment
```bash
# Environment variables
ENVIRONMENT=staging
AUTO_MIGRATE_ON_STARTUP=true

# Deploy and start
git pull origin main
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Behavior:**
- ✅ Migrations run automatically
- ✅ Production-like environment for testing
- ✅ Migration failures logged but don't stop server

### 3. Production Deployment
```bash
# Environment variables (REQUIRED)
ENVIRONMENT=production
ENABLE_PROD_MIGRATIONS=true
AUTO_MIGRATE_ON_STARTUP=true

# Optional production settings
MIGRATION_BACKUP_BEFORE=true
MIGRATION_REQUIRE_CONFIRMATION=false  # Set to true for manual confirmation

# Deploy process
git pull origin main
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Behavior:**
- ⚠️ Requires `ENABLE_PROD_MIGRATIONS=true`
- ✅ Enhanced logging and error tracking
- ✅ Migration failures may stop server startup
- ✅ Comprehensive safety checks

## File Structure

```
apps/smart-meal-planner-backend/
├── app/
│   ├── migrations/
│   │   ├── __init__.py
│   │   ├── migration_runner.py          # Main migration system
│   │   └── versions/
│   │       ├── __init__.py
│   │       └── 001_hash_kroger_passwords.py  # Kroger password hashing
│   ├── config/
│   │   ├── __init__.py
│   │   └── migration_config.py          # Environment-based configuration
│   ├── utils/
│   │   └── password_utils.py            # Password hashing utilities
│   └── main.py                          # Updated with migration startup
├── migrate_kroger_passwords.py         # Standalone migration script
├── add_kroger_password_columns.sql     # Manual SQL script
└── DEPLOYMENT_GUIDE.md                 # This file
```

## Migration Details

### Migration: 001_hash_kroger_passwords
**Purpose:** Securely hash existing plain text Kroger passwords

**Changes:**
1. Adds `kroger_password_hash` column to `user_profiles`
2. Adds `kroger_password_salt` column to `user_profiles`
3. Hashes all existing plain text passwords
4. Maintains backward compatibility during transition

**Safety:**
- ✅ Non-destructive (keeps original passwords during migration)
- ✅ Can run multiple times safely
- ✅ Comprehensive error handling
- ✅ Detailed logging

## Deployment Steps

### Step 1: Pre-Deployment Checklist
```bash
# 1. Backup production database
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Verify environment variables
echo $ENVIRONMENT
echo $ENABLE_PROD_MIGRATIONS
echo $DATABASE_URL

# 3. Test migration in staging first
```

### Step 2: Deploy Code
```bash
# Pull latest code
git pull origin main

# Install dependencies if needed
pip install -r requirements.txt

# Verify migration files are present
ls -la app/migrations/versions/
```

### Step 3: Configure Environment
```bash
# Set production environment variables
export ENVIRONMENT=production
export ENABLE_PROD_MIGRATIONS=true
export AUTO_MIGRATE_ON_STARTUP=true

# Optional: Enable additional safety features
export MIGRATION_BACKUP_BEFORE=true
```

### Step 4: Start Server
```bash
# Start the server - migrations will run automatically
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Or with gunicorn for production
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Step 5: Verify Migration
```bash
# Check migration status in logs
tail -f logs/app.log | grep -i migration

# Verify in database
psql -d your_database -c "SELECT * FROM applied_migrations ORDER BY applied_at DESC LIMIT 5;"

# Check password hashing worked
psql -d your_database -c "SELECT 
    COUNT(*) as total_users,
    COUNT(kroger_password) as plain_passwords,
    COUNT(kroger_password_hash) as hashed_passwords
FROM user_profiles;"
```

## Troubleshooting

### Migration Fails to Run
```bash
# Check environment configuration
# Log output shows: "Migrations skipped based on environment configuration"

# Solution: Verify environment variables
echo $ENVIRONMENT
echo $AUTO_MIGRATE_ON_STARTUP
echo $ENABLE_PROD_MIGRATIONS  # Required for production
```

### Migration Errors
```bash
# Check migration logs
# Log output shows: "Migration 001_hash_kroger_passwords failed: ..."

# Solution: Check database permissions and connectivity
psql -d your_database -c "SELECT version();"

# Check if columns already exist
psql -d your_database -c "SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name LIKE 'kroger_password%';"
```

### Server Won't Start After Migration Failure
```bash
# Check migration status
psql -d your_database -c "SELECT * FROM applied_migrations WHERE status != 'success';"

# Option 1: Fix the migration and restart
# Option 2: Manually mark migration as applied (if manually fixed)
psql -d your_database -c "UPDATE applied_migrations 
SET status = 'success' WHERE migration_name = '001_hash_kroger_passwords';"
```

### Performance Issues
```bash
# Check if indexes were created
psql -d your_database -c "SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'user_profiles' AND indexdef LIKE '%kroger_password%';"

# If missing, add manually
psql -d your_database -c "CREATE INDEX CONCURRENTLY idx_user_profiles_kroger_password_hash 
ON user_profiles(kroger_password_hash) WHERE kroger_password_hash IS NOT NULL;"
```

## Rollback Procedures

### Emergency Rollback (If Needed)
```bash
# 1. Stop the new deployment
sudo systemctl stop your-app

# 2. Restore from backup
pg_restore backup_$(date +%Y%m%d)_*.sql

# 3. Deploy previous version
git checkout previous-version
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Partial Rollback (Migration Only)
```bash
# Mark migration as failed to prevent re-running
psql -d your_database -c "UPDATE applied_migrations 
SET status = 'failed' WHERE migration_name = '001_hash_kroger_passwords';"

# Remove hash columns if needed (NOT RECOMMENDED)
# psql -d your_database -c "ALTER TABLE user_profiles DROP COLUMN kroger_password_hash;"
# psql -d your_database -c "ALTER TABLE user_profiles DROP COLUMN kroger_password_salt;"
```

## Monitoring

### Key Metrics to Monitor
- Migration execution time
- Migration success/failure rates
- Database performance after migration
- Application startup time
- Password verification success rates

### Log Monitoring
```bash
# Monitor migration logs
tail -f logs/app.log | grep -E "(migration|Migration)"

# Monitor password verification
tail -f logs/app.log | grep -E "(password|Password)"

# Monitor startup performance
tail -f logs/app.log | grep -E "(startup|Startup)"
```

### Health Checks
```bash
# Check migration status endpoint (if added)
curl http://your-server/health

# Check database connectivity
curl http://your-server/check-db-connection

# Verify API functionality
curl http://your-server/api-test
```

## Security Considerations

### Post-Migration Security
1. **Monitor Access Logs:** Watch for unusual authentication patterns
2. **Verify Hash Quality:** Ensure all passwords are properly hashed
3. **Remove Plain Text:** Consider removing plain text passwords after verification
4. **Audit Trail:** Review migration logs for any security issues

### Ongoing Security
1. **Regular Backups:** Automated database backups
2. **Access Control:** Limit database access to necessary personnel
3. **Monitoring:** Set up alerts for failed authentication attempts
4. **Updates:** Keep password hashing library updated

## Success Criteria

### ✅ Deployment Successful If:
- Server starts without errors
- Migration `001_hash_kroger_passwords` shows as "success" in `applied_migrations`
- All existing Kroger passwords are hashed
- New password updates are automatically hashed
- Application functionality remains unchanged
- No performance degradation

### ⚠️ Investigation Needed If:
- Migration shows as "failed"
- Server startup takes significantly longer
- Authentication failures increase
- Database performance degrades

This deployment guide ensures a safe, monitored deployment of the Kroger password security upgrade with automatic migration handling.