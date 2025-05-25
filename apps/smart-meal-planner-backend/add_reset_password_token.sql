-- Add reset_password_token column to user_profiles table
-- This column will store the JWT token for password reset functionality

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS reset_password_token TEXT;

-- Add index for performance on reset_password_token lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_reset_token 
ON user_profiles(reset_password_token) 
WHERE reset_password_token IS NOT NULL;