-- ============================================================
-- Migration: Restructure User / Role System
-- ============================================================
-- Transforms the monolithic User table into a separated
-- auth-identity + role-specific profile architecture.
--
-- Summary of changes
-- ──────────────────
--   • User  → auth-only (id, email, passwordHash, refreshTokenHash, role)
--   • NEW Customer table  (profile for CUSTOMER role)
--   • NEW Admin table     (profile for ADMIN / SUPER_ADMIN role)
--   • Driver table linked to User via FK; renamed columns
--   • NEW Permission + UserPermission  (RBAC)
--   • NEW RoleChangeLog  (audit / rollback support)
--   • Role enum: USER→CUSTOMER, adds SUPER_ADMIN
--   • Triggers  – role-switch, prevent-delete, driver-assignment
--   • Rollback functions using audit log
-- ============================================================


-- ============================================================
-- 1. CREATE NEW ENUMS
-- ============================================================

-- New Role values (CUSTOMER replaces USER; SUPER_ADMIN is new)
CREATE TYPE "Role_new" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER');

CREATE TYPE "CustomerType"   AS ENUM ('HOUSEHOLD', 'BUSINESS');
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');


-- ============================================================
-- 2. DROP AFFECTED FOREIGN KEYS
-- ============================================================

ALTER TABLE "Booking"      DROP CONSTRAINT IF EXISTS "Booking_driverId_fkey";
ALTER TABLE "Booking"      DROP CONSTRAINT IF EXISTS "Booking_userId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";


-- ============================================================
-- 3. CREATE NEW TABLES
-- ============================================================

-- Customer profile
DROP TABLE IF EXISTS "Customer" CASCADE;
CREATE TABLE "Customer" (
    "id"        TEXT NOT NULL,
    "fullName"  TEXT NOT NULL,
    "phone"     TEXT NOT NULL,
    "address"   TEXT,
    "type"      "CustomerType"   NOT NULL DEFAULT 'HOUSEHOLD',
    "status"    "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Admin profile
DROP TABLE IF EXISTS "Admin" CASCADE;
CREATE TABLE "Admin" (
    "id"       TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone"    TEXT NOT NULL,
    "address"  TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- RBAC permission
DROP TABLE IF EXISTS "Permission" CASCADE;
CREATE TABLE "Permission" (
    "id"   TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- User ↔ Permission junction
DROP TABLE IF EXISTS "UserPermission" CASCADE;
CREATE TABLE "UserPermission" (
    "userId"       TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId", "permissionId")
);

-- Audit log for role changes (powers rollback functions)
DROP TABLE IF EXISTS "RoleChangeLog" CASCADE;
CREATE TABLE "RoleChangeLog" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"         TEXT NOT NULL,
    "oldRole"        TEXT NOT NULL,
    "newRole"        TEXT NOT NULL,
    "oldProfileData" JSONB,
    "changedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleChangeLog_pkey" PRIMARY KEY ("id")
);

-- Unique index on permission name
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");


-- ============================================================
-- 4. MIGRATE EXISTING DATA
-- ============================================================

-- 4a. Customer profiles ← Users with role = 'USER' (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Customer')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN

    INSERT INTO "Customer" ("id", "fullName", "phone", "address", "type", "status", "createdAt")
    SELECT "id", "fullName", "phone", "address",
           CASE WHEN "type"::text = 'HOUSEHOLD'
                THEN 'HOUSEHOLD'::"CustomerType"
                ELSE 'BUSINESS'::"CustomerType" END,
           CASE WHEN "status"::text = 'ACTIVE'
                THEN 'ACTIVE'::"CustomerStatus"
                ELSE 'INACTIVE'::"CustomerStatus" END,
           "createdAt"
    FROM "User"
    WHERE "role"::text = 'USER';

  ELSE
    RAISE NOTICE 'Skipping Customer migration: required table(s) missing';
  END IF;
END
$$; 

-- 4b. Admin profiles ← Users with role = 'ADMIN' (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Admin')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN

    INSERT INTO "Admin" ("id", "fullName", "phone", "address", "approved")
    SELECT "id", "fullName", "phone", "address", true
    FROM "User"
    WHERE "role"::text = 'ADMIN';

  ELSE
    RAISE NOTICE 'Skipping Admin migration: required table(s) missing';
  END IF;
END
$$; 

-- 4c. Create User auth records for existing Drivers that lack one (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Driver')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN

    INSERT INTO "User" (
        "id", "fullName", "email", "phone", "passwordHash",
        "role", "type", "status", "createdAt"
    )
    SELECT
        d."id",
        d."name",
        LOWER(REPLACE(d."name", ' ', '.')) || '@driver.trash2cash.lk',
        d."phone",
        '$2b$10$placeholder_hash_needs_reset',
        'DRIVER'::"Role",
        'HOUSEHOLD'::"UserType",
        'ACTIVE'::"UserStatus",
        d."createdAt"
    FROM "Driver" d
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = d."id");

  ELSE
    RAISE NOTICE 'Skipping Driver→User auth creation: required table(s) missing';
  END IF;
END
$$; 


-- ============================================================
-- 5. TRANSFORM User TABLE → AUTH-ONLY
-- ============================================================

-- Convert role column to new enum and remove profile columns (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN

    -- Remove existing default first to avoid casting errors when changing enum type
    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "User"
        ALTER COLUMN "role" TYPE "Role_new"
        USING (
            CASE "role"::text
                WHEN 'USER'   THEN 'CUSTOMER'::"Role_new"
                WHEN 'ADMIN'  THEN 'ADMIN'::"Role_new"
                WHEN 'DRIVER' THEN 'DRIVER'::"Role_new"
                ELSE 'CUSTOMER'::"Role_new"
            END
        );

    -- Set the new default after type conversion
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

    -- Swap enum types safely
    DROP TYPE IF EXISTS "Role";
    ALTER TYPE "Role_new" RENAME TO "Role";

    -- Remove profile columns (now live in Customer / Admin / Driver)
    ALTER TABLE "User" DROP COLUMN IF EXISTS "fullName";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "address";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "type";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "status";

    -- Drop obsolete enums
    DROP TYPE IF EXISTS "UserType";
    DROP TYPE IF EXISTS "UserStatus";

    -- Make passwordHash optional (Supabase Auth handles passwords)
    ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

  ELSE
    RAISE NOTICE 'Skipping User enum/column transformations: "User" table not found';
  END IF;
END
$$; 


-- ============================================================
-- 6. TRANSFORM Driver TABLE
-- ============================================================

-- Rename columns to match new schema (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Driver') THEN
    ALTER TABLE "Driver" RENAME COLUMN "name"        TO "fullName";
    ALTER TABLE "Driver" RENAME COLUMN "vehicleType" TO "vehicle";

    -- Default rating 0 (was 4.6)
    ALTER TABLE "Driver" ALTER COLUMN "rating" SET DEFAULT 0;
  ELSE
    RAISE NOTICE 'Skipping Driver transformations: "Driver" table not found';
  END IF;
END
$$; 


-- ============================================================
-- 7. REBUILD FOREIGN KEYS
-- ============================================================

-- Profile tables → User (cascade delete) (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Customer')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN
    EXECUTE 'ALTER TABLE "Customer" ADD CONSTRAINT "Customer_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping Customer → User FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Admin')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN
    EXECUTE 'ALTER TABLE "Admin" ADD CONSTRAINT "Admin_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping Admin → User FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Driver')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN
    EXECUTE 'ALTER TABLE "Driver" ADD CONSTRAINT "Driver_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping Driver → User FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'UserPermission')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN
    EXECUTE 'ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping UserPermission → User FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'UserPermission')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Permission') THEN
    EXECUTE 'ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping UserPermission → Permission FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Booking')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN
    EXECUTE 'ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping Booking → User FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Booking')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Driver') THEN
    EXECUTE 'ALTER TABLE "Booking" ADD CONSTRAINT "Booking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping Booking → Driver FK: required table(s) missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Notification')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN
    EXECUTE 'ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  ELSE
    RAISE NOTICE 'Skipping Notification → User FK: required table(s) missing';
  END IF;
END
$$;


-- ============================================================
-- 8. TRIGGER FUNCTIONS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 8a. ROLE SWITCH
--     When User.role is updated the old profile row is saved
--     to RoleChangeLog (as JSONB), deleted, and a new default
--     row is created in the target profile table.
--     Common fields (fullName, phone, address) are carried over.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_handle_role_switch()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name  TEXT    := '';
    v_phone      TEXT    := '';
    v_address    TEXT    := NULL;
    v_old_profile JSONB  := NULL;
BEGIN
    -- Nothing to do if the role did not change
    IF OLD.role = NEW.role THEN
        RETURN NEW;
    END IF;

    -- ── Capture & remove old profile ──────────────────────
    IF OLD.role = 'CUSTOMER' THEN
        SELECT jsonb_build_object(
                   'fullName',  c."fullName",
                   'phone',     c."phone",
                   'address',   c."address",
                   'type',      c."type"::text,
                   'status',    c."status"::text,
                   'createdAt', c."createdAt"
               ),
               c."fullName", c."phone", c."address"
          INTO v_old_profile, v_full_name, v_phone, v_address
          FROM "Customer" c
         WHERE c."id" = OLD.id;

        DELETE FROM "Customer" WHERE "id" = OLD.id;

    ELSIF OLD.role IN ('ADMIN', 'SUPER_ADMIN') THEN
        SELECT jsonb_build_object(
                   'fullName', a."fullName",
                   'phone',    a."phone",
                   'address',  a."address",
                   'approved', a."approved"
               ),
               a."fullName", a."phone", a."address"
          INTO v_old_profile, v_full_name, v_phone, v_address
          FROM "Admin" a
         WHERE a."id" = OLD.id;

        DELETE FROM "Admin" WHERE "id" = OLD.id;

    ELSIF OLD.role = 'DRIVER' THEN
        SELECT jsonb_build_object(
                   'fullName',    d."fullName",
                   'phone',       d."phone",
                   'rating',      d."rating",
                   'pickupCount', d."pickupCount",
                   'vehicle',     d."vehicle",
                   'status',      d."status"::text,
                   'createdAt',   d."createdAt"
               ),
               d."fullName", d."phone"
          INTO v_old_profile, v_full_name, v_phone
          FROM "Driver" d
         WHERE d."id" = OLD.id;

        DELETE FROM "Driver" WHERE "id" = OLD.id;
    END IF;

    -- ── Audit log (for rollback) ─────────────────────────
    INSERT INTO "RoleChangeLog" ("userId", "oldRole", "newRole", "oldProfileData")
    VALUES (OLD.id, OLD.role::text, NEW.role::text, v_old_profile);

    -- ── Create new profile with carried-over data ────────
    IF NEW.role = 'CUSTOMER' THEN
        INSERT INTO "Customer" ("id", "fullName", "phone", "address",
                                "type", "status", "createdAt")
        VALUES (NEW.id,
                COALESCE(v_full_name, ''),
                COALESCE(v_phone, ''),
                v_address,
                'HOUSEHOLD', 'ACTIVE', NOW());

    ELSIF NEW.role IN ('ADMIN', 'SUPER_ADMIN') THEN
        INSERT INTO "Admin" ("id", "fullName", "phone", "address", "approved")
        VALUES (NEW.id,
                COALESCE(v_full_name, ''),
                COALESCE(v_phone, ''),
                v_address,
                CASE WHEN NEW.role = 'SUPER_ADMIN' THEN true ELSE false END);

        -- If promoted to SUPER_ADMIN, grant all existing permissions
        IF NEW.role = 'SUPER_ADMIN' THEN
            INSERT INTO "UserPermission" ("userId", "permissionId")
            SELECT NEW.id, p."id" FROM "Permission" p
            ON CONFLICT DO NOTHING;
        END IF;

    ELSIF NEW.role = 'DRIVER' THEN
        INSERT INTO "Driver" ("id", "fullName", "phone",
                              "rating", "pickupCount", "vehicle",
                              "status", "createdAt")
        VALUES (NEW.id,
                COALESCE(v_full_name, ''),
                COALESCE(v_phone, ''),
                0, 0, '',
                'OFFLINE', NOW());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 8b. PREVENT DELETE with active bookings
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_prevent_delete_active_bookings()
RETURNS TRIGGER AS $$
DECLARE
    v_active_count INT;
BEGIN
    SELECT COUNT(*) INTO v_active_count
      FROM "Booking"
     WHERE "userId" = OLD.id
       AND "status" IN ('SCHEDULED', 'COLLECTED');

    IF v_active_count > 0 THEN
        RAISE EXCEPTION
            'Cannot delete user % – % active booking(s) exist. '
            'Cancel or complete them first.',
            OLD.id, v_active_count;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 8c. AUTO-UPDATE Driver status on booking changes
--     • Assigning a driver  → ON_PICKUP
--     • Completing a booking → ONLINE + pickupCount++
--     • Cancelling / refunding → ONLINE
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_driver_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Driver assigned to booking
    IF NEW."driverId" IS NOT NULL
       AND (OLD."driverId" IS NULL OR OLD."driverId" <> NEW."driverId")
    THEN
        UPDATE "Driver"
           SET "status" = 'ON_PICKUP'
         WHERE "id" = NEW."driverId";
    END IF;

    -- Booking reached a terminal state
    IF NEW."status" IN ('COMPLETED', 'CANCELLED', 'REFUNDED')
       AND OLD."status" NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED')
       AND NEW."driverId" IS NOT NULL
    THEN
        IF NEW."status" = 'COMPLETED' THEN
            UPDATE "Driver"
               SET "pickupCount" = "pickupCount" + 1,
                   "status"      = 'ONLINE'
             WHERE "id" = NEW."driverId";
        ELSE
            UPDATE "Driver"
               SET "status" = 'ONLINE'
             WHERE "id" = NEW."driverId";
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 8d. VALIDATE single profile per user
--     Ensures a user cannot manually have rows in more than
--     one profile table at a time.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_single_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT := 0;
BEGIN
    SELECT (EXISTS(SELECT 1 FROM "Customer" WHERE "id" = NEW."id"))::int
         + (EXISTS(SELECT 1 FROM "Admin"    WHERE "id" = NEW."id"))::int
         + (EXISTS(SELECT 1 FROM "Driver"   WHERE "id" = NEW."id"))::int
      INTO v_count;

    -- Allow 1 (the one being inserted now). Block if another already exists.
    IF v_count > 0 THEN
        RAISE EXCEPTION
            'User % already has a profile in another role table. '
            'Change the role on the User table instead (trigger handles the swap).',
            NEW."id";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 9. ROLLBACK SUPPORT FUNCTIONS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 9a. Rollback a specific role change by audit-log id
--     Restores the old profile from the saved JSONB snapshot,
--     reverts User.role, and cleans up.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rollback_role_change(p_log_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_log RECORD;
BEGIN
    SELECT * INTO v_log FROM "RoleChangeLog" WHERE "id" = p_log_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Role-change log entry % not found.', p_log_id;
    END IF;

    -- Temporarily disable the role-switch trigger to do a manual restore
    ALTER TABLE "User" DISABLE TRIGGER trg_role_switch;

    -- Remove the profile the trigger created for newRole
    IF v_log."newRole" = 'CUSTOMER' THEN
        DELETE FROM "Customer" WHERE "id" = v_log."userId";
    ELSIF v_log."newRole" IN ('ADMIN', 'SUPER_ADMIN') THEN
        DELETE FROM "Admin" WHERE "id" = v_log."userId";
    ELSIF v_log."newRole" = 'DRIVER' THEN
        DELETE FROM "Driver" WHERE "id" = v_log."userId";
    END IF;

    -- Restore old profile from the JSONB snapshot
    IF v_log."oldProfileData" IS NOT NULL THEN
        IF v_log."oldRole" = 'CUSTOMER' THEN
            INSERT INTO "Customer" ("id", "fullName", "phone", "address",
                                    "type", "status", "createdAt")
            VALUES (
                v_log."userId",
                COALESCE(v_log."oldProfileData"->>'fullName', ''),
                COALESCE(v_log."oldProfileData"->>'phone', ''),
                v_log."oldProfileData"->>'address',
                COALESCE(v_log."oldProfileData"->>'type',   'HOUSEHOLD')::"CustomerType",
                COALESCE(v_log."oldProfileData"->>'status', 'ACTIVE')::"CustomerStatus",
                COALESCE((v_log."oldProfileData"->>'createdAt')::timestamp, NOW())
            );

        ELSIF v_log."oldRole" IN ('ADMIN', 'SUPER_ADMIN') THEN
            INSERT INTO "Admin" ("id", "fullName", "phone", "address", "approved")
            VALUES (
                v_log."userId",
                COALESCE(v_log."oldProfileData"->>'fullName', ''),
                COALESCE(v_log."oldProfileData"->>'phone', ''),
                v_log."oldProfileData"->>'address',
                COALESCE((v_log."oldProfileData"->>'approved')::boolean, false)
            );

        ELSIF v_log."oldRole" = 'DRIVER' THEN
            INSERT INTO "Driver" ("id", "fullName", "phone", "rating",
                                  "pickupCount", "vehicle", "status", "createdAt")
            VALUES (
                v_log."userId",
                COALESCE(v_log."oldProfileData"->>'fullName', ''),
                COALESCE(v_log."oldProfileData"->>'phone', ''),
                COALESCE((v_log."oldProfileData"->>'rating')::double precision, 0),
                COALESCE((v_log."oldProfileData"->>'pickupCount')::int, 0),
                COALESCE(v_log."oldProfileData"->>'vehicle', ''),
                COALESCE(v_log."oldProfileData"->>'status', 'OFFLINE')::"DriverStatus",
                COALESCE((v_log."oldProfileData"->>'createdAt')::timestamp, NOW())
            );
        END IF;
    END IF;

    -- Revert the role on the User row
    UPDATE "User" SET "role" = v_log."oldRole"::"Role" WHERE "id" = v_log."userId";

    -- Re-enable the trigger
    ALTER TABLE "User" ENABLE TRIGGER trg_role_switch;

    -- Remove processed log entry
    DELETE FROM "RoleChangeLog" WHERE "id" = p_log_id;

    RAISE NOTICE 'Rolled back role change for user %  (% → %)',
        v_log."userId", v_log."newRole", v_log."oldRole";
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 9b. Convenience: rollback the LATEST role change for a user
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rollback_latest_role_change(p_user_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_log_id TEXT;
BEGIN
    SELECT "id" INTO v_log_id
      FROM "RoleChangeLog"
     WHERE "userId" = p_user_id
     ORDER BY "changedAt" DESC
     LIMIT 1;

    IF v_log_id IS NULL THEN
        RAISE EXCEPTION 'No role-change history found for user %.', p_user_id;
    END IF;

    PERFORM fn_rollback_role_change(v_log_id);
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 10. CREATE TRIGGERS
-- ============================================================

-- Role switch (fires BEFORE UPDATE so the new role is written)
DROP TRIGGER IF EXISTS trg_role_switch ON "User";
CREATE TRIGGER trg_role_switch
    BEFORE UPDATE OF "role" ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION fn_handle_role_switch();

-- Prevent deletion of users with active bookings
DROP TRIGGER IF EXISTS trg_prevent_delete_active_bookings ON "User";
CREATE TRIGGER trg_prevent_delete_active_bookings
    BEFORE DELETE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_delete_active_bookings();

-- Auto-update driver status on booking lifecycle changes
DROP TRIGGER IF EXISTS trg_driver_assignment ON "Booking";
CREATE TRIGGER trg_driver_assignment
    AFTER UPDATE ON "Booking"
    FOR EACH ROW
    EXECUTE FUNCTION fn_driver_assignment_status();

-- Validate single profile per user (one trigger per profile table)
DROP TRIGGER IF EXISTS trg_validate_customer_profile ON "Customer";
CREATE TRIGGER trg_validate_customer_profile
    BEFORE INSERT ON "Customer"
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_single_profile();

DROP TRIGGER IF EXISTS trg_validate_admin_profile ON "Admin";
CREATE TRIGGER trg_validate_admin_profile
    BEFORE INSERT ON "Admin"
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_single_profile();

DROP TRIGGER IF EXISTS trg_validate_driver_profile ON "Driver";
CREATE TRIGGER trg_validate_driver_profile
    BEFORE INSERT ON "Driver"
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_single_profile();


-- ============================================================
-- 11. SEED DEFAULT PERMISSIONS
-- ============================================================

INSERT INTO "Permission" ("id", "name") VALUES
    (gen_random_uuid(), 'manage_users'),
    (gen_random_uuid(), 'manage_bookings'),
    (gen_random_uuid(), 'manage_drivers'),
    (gen_random_uuid(), 'manage_pricing'),
    (gen_random_uuid(), 'view_reports'),
    (gen_random_uuid(), 'manage_permissions'),
    (gen_random_uuid(), 'send_notifications'),
    (gen_random_uuid(), 'manage_waste_categories');

-- Grant all existing permissions to any SUPER_ADMIN users (if any)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'UserPermission')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'Permission')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'User') THEN

    INSERT INTO "UserPermission" ("userId", "permissionId")
    SELECT u."id", p."id"
    FROM "User" u
    CROSS JOIN "Permission" p
    WHERE u."role"::text = 'SUPER_ADMIN'
    ON CONFLICT DO NOTHING;

  ELSE
    RAISE NOTICE 'Skipping grant-to-super-admins: required table(s) missing';
  END IF;
END
$$;

-- Create trigger to grant new permissions to all super-admins
CREATE OR REPLACE FUNCTION fn_grant_permission_to_super_admins()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "UserPermission" ("userId", "permissionId")
  SELECT u."id", NEW."id"
  FROM "User" u
  WHERE u."role"::text = 'SUPER_ADMIN'
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grant_permission_to_super_admins ON "Permission";
CREATE TRIGGER trg_grant_permission_to_super_admins
    AFTER INSERT ON "Permission"
    FOR EACH ROW
    EXECUTE FUNCTION fn_grant_permission_to_super_admins();

-- If there are Admins but no SUPER_ADMIN user, promote the oldest Admin to SUPER_ADMIN and grant all permissions
DO $$
DECLARE
  v_candidate TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "Admin") THEN
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE "role"::text = 'SUPER_ADMIN') THEN
      SELECT u."id" INTO v_candidate
      FROM "User" u
      JOIN "Admin" a ON a."id" = u."id"
      ORDER BY u."createdAt" ASC
      LIMIT 1;

      IF v_candidate IS NOT NULL THEN
        UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "id" = v_candidate;
        UPDATE "Admin" SET "approved" = true WHERE "id" = v_candidate;

        INSERT INTO "UserPermission" ("userId", "permissionId")
        SELECT v_candidate, p."id" FROM "Permission" p
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Promoted Admin % to SUPER_ADMIN and granted all permissions', v_candidate;
      END IF;
    END IF;
  END IF;
END
$$;
