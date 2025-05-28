-- Mark all existing migrations as completed
-- This prevents the migration runner from trying to run them again

-- Ensure applied_migrations table exists
CREATE TABLE IF NOT EXISTS applied_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'success',
    error_message TEXT,
    execution_time_seconds FLOAT
);

-- Mark all migrations as completed (based on files in migrations/versions/)
INSERT INTO applied_migrations (migration_name, status, applied_at) VALUES
('001_hash_kroger_passwords', 'success', CURRENT_TIMESTAMP),
('002_add_reset_password_token', 'success', CURRENT_TIMESTAMP),
('003_create_organization_settings', 'success', CURRENT_TIMESTAMP),
('004_create_onboarding_forms', 'success', CURRENT_TIMESTAMP),
('005_create_client_notes', 'success', CURRENT_TIMESTAMP),
('006_create_organization_recipes', 'success', CURRENT_TIMESTAMP),
('007_create_user_recipes', 'success', CURRENT_TIMESTAMP),
('008_add_user_recipe_support', 'success', CURRENT_TIMESTAMP),
('009_add_organization_branding', 'success', CURRENT_TIMESTAMP),
('010_consolidate_recipe_components', 'success', CURRENT_TIMESTAMP)
ON CONFLICT (migration_name) DO UPDATE SET 
    status = 'success',
    applied_at = CURRENT_TIMESTAMP;

-- Show what we marked as complete
SELECT migration_name, status, applied_at 
FROM applied_migrations 
ORDER BY migration_name;