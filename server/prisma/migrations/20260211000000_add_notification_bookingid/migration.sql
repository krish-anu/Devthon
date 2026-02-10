-- Add bookingId column to Notification
ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "bookingId" TEXT;

-- Add foreign key to Booking (safe: skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_bookingId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;