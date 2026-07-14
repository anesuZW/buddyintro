-- Discoveries UX: hero banner, expiry indicators, trust context toggles

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS enable_discoveries_hero_banner BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_discovery_expiry_indicators BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_discovery_trust_context BOOLEAN NOT NULL DEFAULT true;

-- Trust-first ephemeral default: 24h unless already configured
UPDATE admin_settings
SET discoveries_expiry_hours = 24
WHERE id = 1 AND discoveries_expiry_hours IS NULL;
