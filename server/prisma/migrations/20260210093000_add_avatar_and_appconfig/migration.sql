-- Add avatarUrl columns if missing
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- Create AppConfig table for simple key/value application configuration
CREATE TABLE IF NOT EXISTS "AppConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppConfig_key_key" ON "AppConfig"("key");