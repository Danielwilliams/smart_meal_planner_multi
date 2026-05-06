-- Create table for tracking background menu generation jobs
CREATE TABLE IF NOT EXISTS menu_generation_jobs (
    job_id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    client_id INTEGER,  -- For organization client menus
    status VARCHAR(20) DEFAULT 'started' CHECK (status IN ('started', 'generating', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    message TEXT DEFAULT 'Starting meal generation...',
    request_data JSONB,  -- Store the original menu request for debugging
    result_data JSONB,   -- Final menu data when complete
    error_message TEXT,  -- Error details if failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_menu_jobs_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_menu_jobs_client FOREIGN KEY (client_id) REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_menu_jobs_user_id ON menu_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_jobs_status ON menu_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_menu_jobs_created_at ON menu_generation_jobs(created_at);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_menu_job_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamp
DROP TRIGGER IF EXISTS trigger_update_menu_job_timestamp ON menu_generation_jobs;
CREATE TRIGGER trigger_update_menu_job_timestamp
    BEFORE UPDATE ON menu_generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_menu_job_timestamp();

-- Cleanup function to remove old completed jobs (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_menu_jobs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM menu_generation_jobs 
    WHERE status IN ('completed', 'failed') 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;