-- Align push_subscriptions.updated_at with Prisma @updatedAt (no DB default)
ALTER TABLE "push_subscriptions" ALTER COLUMN "updated_at" DROP DEFAULT;

