-- Add lifetime points tracking on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalPoints" INTEGER NOT NULL DEFAULT 0;

-- Track when a booking is confirmed/completed for points logic
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

-- Points transactions for rewards (idempotent per booking)
CREATE TABLE IF NOT EXISTS "PointsTransaction" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"        TEXT NOT NULL,
    "bookingId"     TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "basePoints"    INTEGER NOT NULL,
    "bonusPoints"   INTEGER NOT NULL,
    "multiplier"    DOUBLE PRECISION NOT NULL,
    "reason"        JSONB,
    "awardedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PointsTransaction_bookingId_key" ON "PointsTransaction"("bookingId");
CREATE INDEX IF NOT EXISTS "PointsTransaction_userId_awardedAt_idx" ON "PointsTransaction"("userId", "awardedAt");
CREATE INDEX IF NOT EXISTS "PointsTransaction_awardedAt_idx" ON "PointsTransaction"("awardedAt");

ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
