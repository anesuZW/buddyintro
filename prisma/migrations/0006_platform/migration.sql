-- 0006_platform: Background jobs platform
-- Generated from schema.prisma via prisma migrate diff

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'pending',
    "priority" "JobPriority" NOT NULL DEFAULT 'normal',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "background_jobs_status_run_at_idx" ON "background_jobs"("status", "run_at");


-- CreateIndex
CREATE INDEX "background_jobs_status_priority_run_at_idx" ON "background_jobs"("status", "priority", "run_at");


-- CreateIndex
CREATE INDEX "background_jobs_queue_status_idx" ON "background_jobs"("queue", "status");


-- CreateIndex
CREATE INDEX "background_jobs_job_type_created_at_idx" ON "background_jobs"("job_type", "created_at");

