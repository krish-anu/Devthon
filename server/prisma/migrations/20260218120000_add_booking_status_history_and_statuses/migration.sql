-- Add new booking status values
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

-- Booking status history table
CREATE TABLE IF NOT EXISTS "BookingStatusHistory" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
    "bookingId"     TEXT NOT NULL,
    "fromStatus"    "BookingStatus" NOT NULL,
    "toStatus"      "BookingStatus" NOT NULL,
    "changedById"   TEXT NOT NULL,
    "changedByRole" "Role" NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingStatusHistory_bookingId_createdAt_idx"
  ON "BookingStatusHistory"("bookingId", "createdAt");

ALTER TABLE "BookingStatusHistory"
  ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
