-- Compatibility-safe booking status normalization:
-- Keep enum values, but normalize legacy rows and default writes.

ALTER TABLE "Booking"
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

UPDATE "Booking"
SET "status" = 'CREATED'
WHERE "status" = 'SCHEDULED';

UPDATE "Booking"
SET "status" = 'COLLECTED'
WHERE "status" = 'PAID';

DO $$
BEGIN
  IF to_regclass('"BookingStatusHistory"') IS NOT NULL THEN
    UPDATE "BookingStatusHistory"
    SET "fromStatus" = 'CREATED'
    WHERE "fromStatus" = 'SCHEDULED';

    UPDATE "BookingStatusHistory"
    SET "toStatus" = 'CREATED'
    WHERE "toStatus" = 'SCHEDULED';

    UPDATE "BookingStatusHistory"
    SET "fromStatus" = 'COLLECTED'
    WHERE "fromStatus" = 'PAID';

    UPDATE "BookingStatusHistory"
    SET "toStatus" = 'COLLECTED'
    WHERE "toStatus" = 'PAID';
  END IF;
END $$;
