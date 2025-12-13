-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('SIGN_IN', 'SIGN_UP', 'SIGN_OUT', 'SIGN_IN_FAILED');

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "event_type" "AuthEventType" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_events_created_at_idx" ON "auth_events"("created_at");

-- CreateIndex
CREATE INDEX "auth_events_event_type_created_at_idx" ON "auth_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "auth_events_user_id_idx" ON "auth_events"("user_id");

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
