-- Introductions never expire admin setting
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS introductions_never_expire BOOLEAN NOT NULL DEFAULT false;
