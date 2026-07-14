-- 0007_security_rbac: RBAC, audit logs, security events
-- Generated from schema.prisma via prisma migrate diff

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);


-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "granted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");


-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");


-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");


-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");


-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");


-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");


-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");


-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");


-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");


-- CreateIndex
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");


-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");


-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");


-- CreateIndex
CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");


-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- RBAC seed data for 0007_security_rbac migration

INSERT INTO "roles" ("id", "name", "description", "is_system") VALUES
  (gen_random_uuid(), 'SuperAdmin', 'Full platform access', true),
  (gen_random_uuid(), 'Admin', 'Platform administration', true),
  (gen_random_uuid(), 'Moderator', 'Content moderation', true),
  (gen_random_uuid(), 'Support', 'User support operations', true),
  (gen_random_uuid(), 'Analyst', 'Read-only analytics access', true)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'users.view', 'View user records'),
  (gen_random_uuid(), 'users.suspend', 'Suspend users'),
  (gen_random_uuid(), 'users.ban', 'Ban users'),
  (gen_random_uuid(), 'users.verify', 'Grant verification'),
  (gen_random_uuid(), 'analytics.view', 'View analytics'),
  (gen_random_uuid(), 'analytics.export', 'Export analytics'),
  (gen_random_uuid(), 'settings.manage', 'Manage platform settings'),
  (gen_random_uuid(), 'categories.manage', 'Manage introduction categories'),
  (gen_random_uuid(), 'announcements.send', 'Send announcements'),
  (gen_random_uuid(), 'trust.manage', 'Manage trust scores and risk'),
  (gen_random_uuid(), 'roles.manage', 'Assign and revoke roles'),
  (gen_random_uuid(), 'audit.view', 'View audit logs'),
  (gen_random_uuid(), 'jobs.view', 'View background jobs'),
  (gen_random_uuid(), 'jobs.manage', 'Manage background jobs'),
  (gen_random_uuid(), 'security.view', 'View security events'),
  (gen_random_uuid(), 'reports.moderate', 'Moderate content reports')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p WHERE r.name = 'SuperAdmin'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r JOIN "permissions" p ON p.key IN (
  'users.view','users.suspend','users.verify','analytics.view','settings.manage',
  'categories.manage','announcements.send','trust.manage','audit.view','jobs.view','security.view','reports.moderate'
) WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r JOIN "permissions" p ON p.key IN (
  'users.view','users.suspend','reports.moderate','security.view','trust.manage'
) WHERE r.name = 'Moderator'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r JOIN "permissions" p ON p.key IN (
  'users.view','users.verify','audit.view'
) WHERE r.name = 'Support'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r JOIN "permissions" p ON p.key IN (
  'analytics.view','analytics.export','security.view','audit.view','jobs.view'
) WHERE r.name = 'Analyst'
ON CONFLICT DO NOTHING;

