-- Fix organization_clients table to ensure client 26 is properly linked to organization 7

-- First, check if the relationship exists
SELECT * FROM organization_clients WHERE client_id = 26 AND organization_id = 7;

-- If not exists, insert it
INSERT INTO organization_clients (organization_id, client_id, status, joined_at)
SELECT 7, 26, 'active', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM organization_clients 
    WHERE organization_id = 7 AND client_id = 26
);

-- Verify the fix
SELECT * FROM organization_clients WHERE client_id = 26;

-- Also check if user 26 has the correct role
SELECT id, email, role, organization_id FROM users WHERE id = 26;

-- If user 26 doesn't have role='client', update it
UPDATE users SET role = 'client' WHERE id = 26 AND role IS NULL;