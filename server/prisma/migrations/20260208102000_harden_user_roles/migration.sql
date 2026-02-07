-- ============================================================
-- Migration: Harden user/role migration (idempotent fixes + RLS)
-- Date: 2026-02-08
-- Purpose: Add idempotent guards, clear placeholder password hashes,
--          ensure Role enum includes SUPER_ADMIN and enable RLS policies
-- ============================================================

-- ============================================================
-- 1. Ensure enums & values exist (idempotent)
-- ============================================================

DO $$
BEGIN
  -- Try to create Role type, ignore if it already exists (race-safe)
  BEGIN
    CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'DRIVER');
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Type "Role" already exists, skipping create';
  END;

  -- Add SUPER_ADMIN value if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'role' AND e.enumlabel = 'SUPER_ADMIN'
  ) THEN
    BEGIN
      ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Enum value SUPER_ADMIN already exists, skipping';
    END;
  END IF;

  -- Create CustomerType if missing (race-safe)
  BEGIN
    CREATE TYPE "CustomerType" AS ENUM ('HOUSEHOLD', 'BUSINESS');
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Type "CustomerType" already exists, skipping create';
  END;

  -- Create CustomerStatus if missing (race-safe)
  BEGIN
    CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Type "CustomerStatus" already exists, skipping create';
  END;
END
$$;


-- ============================================================
-- 2. Ensure unique index on Permission.name exists (idempotent)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Permission_name_key') THEN
    CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");
  END IF;
END
$$;


-- ============================================================
-- 3. Clear placeholder password hashes (force password reset)
-- ============================================================

DO $$
DECLARE v_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'passwordHash') THEN
    UPDATE "User"
    SET "passwordHash" = NULL
    WHERE "passwordHash" = '$2b$10$placeholder_hash_needs_reset';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Cleared % placeholder passwordHash rows', v_count;
  ELSE
    RAISE NOTICE 'Skipping placeholder hash cleanup: "User.passwordHash" column missing';
  END IF;
END
$$;


-- ============================================================
-- 4. Re-grant permissions to SUPER_ADMIN users (idempotent)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Permission')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserPermission') THEN

    INSERT INTO "UserPermission" ("userId", "permissionId")
    SELECT u."id", p."id"
    FROM "User" u
    CROSS JOIN "Permission" p
    WHERE u."role"::text = 'SUPER_ADMIN'
    ON CONFLICT DO NOTHING;
  ELSE
    RAISE NOTICE 'Skipping grant-to-super-admins (tables missing)';
  END IF;
END
$$;


-- ============================================================
-- 5. Enable Row Level Security and create policies (if auth.uid() available)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'uid' AND n.nspname = 'auth'
  ) THEN

    -- Customer
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Customer') THEN
      EXECUTE 'ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'customer_self_policy' AND polrelid = '"Customer"'::regclass) THEN
        EXECUTE 'CREATE POLICY customer_self_policy ON "Customer" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;
    END IF;

    -- Admin
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Admin') THEN
      EXECUTE 'ALTER TABLE "Admin" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'admin_self_policy' AND polrelid = '"Admin"'::regclass) THEN
        EXECUTE 'CREATE POLICY admin_self_policy ON "Admin" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;
    END IF;

    -- Driver
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Driver') THEN
      EXECUTE 'ALTER TABLE "Driver" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'driver_self_policy' AND polrelid = '"Driver"'::regclass) THEN
        EXECUTE 'CREATE POLICY driver_self_policy ON "Driver" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;
    END IF;

    -- Permission (admins only)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Permission') THEN
      EXECUTE 'ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'permission_admins_policy' AND polrelid = '"Permission"'::regclass) THEN
        EXECUTE $pol$CREATE POLICY permission_admins_policy ON "Permission" FOR ALL USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN'))) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN')));$pol$;
      END IF;
    END IF;

    -- UserPermission (admins only)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserPermission') THEN
      EXECUTE 'ALTER TABLE "UserPermission" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'userpermission_admins_policy' AND polrelid = '"UserPermission"'::regclass) THEN
        EXECUTE $pol$CREATE POLICY userpermission_admins_policy ON "UserPermission" FOR ALL USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN'))) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN')));$pol$;
      END IF;
    END IF;

  ELSE
    RAISE NOTICE 'Skipping RLS policies: auth.uid() not available';
  END IF;
END
$$;
