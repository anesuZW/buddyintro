-- Add invitation expiry for preview link security
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE invitations
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL;

ALTER TABLE invitations
ALTER COLUMN expires_at SET NOT NULL;
