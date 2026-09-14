-- Audit columns for vote integrity (run against existing votes table)

ALTER TABLE votes ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN;
