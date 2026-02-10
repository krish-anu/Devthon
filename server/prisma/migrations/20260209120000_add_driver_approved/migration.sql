-- AlterTable: Add "approved" column to Driver with default false
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;
