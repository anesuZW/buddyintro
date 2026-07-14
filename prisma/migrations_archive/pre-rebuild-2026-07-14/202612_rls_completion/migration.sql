-- Platform hardening: RBAC, audit logs, security events, trust risk, job priority

DO $$ BEGIN
  CREATE TYPE "TrustRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SecurityEventSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JobPriority" AS ENUM ('low', 'normal', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_risk_score INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_risk_level "TrustRiskLevel" NOT NULL DEFAULT 'low';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_risk_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_risk_false_positive BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_trust_risk_level_idx ON users(trust_risk_level);
CREATE INDEX IF NOT EXISTS users_trust_risk_score_idx ON users(trust_risk_score);

ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS priority "JobPriority" NOT NULL DEFAULT 'normal';
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS background_jobs_status_priority_run_at_idx ON background_jobs(status, priority DESC, run_at);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles(role_id);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs(target_type, target_id);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity "SecurityEventSeverity" NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON security_events(severity);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events(created_at);
CREATE INDEX IF NOT EXISTS security_events_user_id_created_at_idx ON security_events(user_id, created_at);

-- Seed system roles
INSERT INTO roles (name, description, is_system) VALUES
  ('SuperAdmin', 'Full platform access', true),
  ('Admin', 'Platform administration', true),
  ('Moderator', 'Content moderation', true),
  ('Support', 'User support operations', true),
  ('Analyst', 'Read-only analytics access', true)
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO permissions (key, description) VALUES
  ('users.view', 'View user records'),
  ('users.suspend', 'Suspend users'),
  ('users.ban', 'Ban users'),
  ('users.verify', 'Grant verification'),
  ('analytics.view', 'View analytics'),
  ('analytics.export', 'Export analytics'),
  ('settings.manage', 'Manage platform settings'),
  ('categories.manage', 'Manage introduction categories'),
  ('announcements.send', 'Send announcements'),
  ('trust.manage', 'Manage trust scores and risk'),
  ('roles.manage', 'Assign and revoke roles'),
  ('audit.view', 'View audit logs'),
  ('jobs.view', 'View background jobs'),
  ('jobs.manage', 'Manage background jobs'),
  ('security.view', 'View security events'),
  ('reports.moderate', 'Moderate content reports')
ON CONFLICT (key) DO NOTHING;

-- SuperAdmin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'SuperAdmin'
ON CONFLICT DO NOTHING;

-- Admin role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
  'users.view','users.suspend','users.verify','analytics.view','settings.manage',
  'categories.manage','announcements.send','trust.manage','audit.view','jobs.view','security.view','reports.moderate'
) WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Moderator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
  'users.view','users.suspend','reports.moderate','security.view','trust.manage'
) WHERE r.name = 'Moderator'
ON CONFLICT DO NOTHING;

-- Support
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
  'users.view','users.verify','audit.view'
) WHERE r.name = 'Support'
ON CONFLICT DO NOTHING;

-- Analyst
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
  'analytics.view','analytics.export','security.view','audit.view','jobs.view'
) WHERE r.name = 'Analyst'
ON CONFLICT DO NOTHING;
