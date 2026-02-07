-- ============================================================
-- Migration: Secure sensitive columns & enable RLS
-- Date: 2026-02-08
-- Purpose: Revoke direct access to passwordHash / refreshTokenHash
--          from anon & authenticated roles, enable Row Level Security
--          on all user-facing tables with self-access + admin policies
-- ============================================================


-- ============================================================
-- 1. Lock down sensitive columns on "User" table
--    Only service_role (your NestJS backend) can read these
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'passwordHash') THEN
    EXECUTE 'REVOKE SELECT ("passwordHash") ON "User" FROM anon, authenticated';
    RAISE NOTICE 'Revoked SELECT on User.passwordHash from anon, authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'refreshTokenHash') THEN
    EXECUTE 'REVOKE SELECT ("refreshTokenHash") ON "User" FROM anon, authenticated';
    RAISE NOTICE 'Revoked SELECT on User.refreshTokenHash from anon, authenticated';
  END IF;
END
$$;


-- ============================================================
-- 2. Enable Row Level Security and create policies
--    (only when running inside Supabase where auth.uid() exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'uid' AND n.nspname = 'auth'
  ) THEN

    -- ── User ────────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
      EXECUTE 'ALTER TABLE "User" ENABLE ROW LEVEL SECURITY';

      -- Users can read/update their own row
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_self_policy' AND polrelid = '"User"'::regclass) THEN
        EXECUTE 'CREATE POLICY user_self_policy ON "User" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;

      -- Admins can read all user rows (management dashboards)
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'user_admin_read_policy' AND polrelid = '"User"'::regclass) THEN
        EXECUTE $pol$CREATE POLICY user_admin_read_policy ON "User" FOR SELECT USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN')));$pol$;
      END IF;
    END IF;

    -- ── Customer ────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Customer') THEN
      EXECUTE 'ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'customer_self_policy' AND polrelid = '"Customer"'::regclass) THEN
        EXECUTE 'CREATE POLICY customer_self_policy ON "Customer" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;
    END IF;

    -- ── Admin ───────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Admin') THEN
      EXECUTE 'ALTER TABLE "Admin" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'admin_self_policy' AND polrelid = '"Admin"'::regclass) THEN
        EXECUTE 'CREATE POLICY admin_self_policy ON "Admin" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;
    END IF;

    -- ── Driver ──────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Driver') THEN
      EXECUTE 'ALTER TABLE "Driver" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'driver_self_policy' AND polrelid = '"Driver"'::regclass) THEN
        EXECUTE 'CREATE POLICY driver_self_policy ON "Driver" FOR ALL USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)';
      END IF;
    END IF;

    -- ── Permission (admins only) ────────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Permission') THEN
      EXECUTE 'ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'permission_admins_policy' AND polrelid = '"Permission"'::regclass) THEN
        EXECUTE $pol$CREATE POLICY permission_admins_policy ON "Permission" FOR ALL USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN'))) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN')));$pol$;
      END IF;
    END IF;

    -- ── UserPermission (admins only) ────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserPermission') THEN
      EXECUTE 'ALTER TABLE "UserPermission" ENABLE ROW LEVEL SECURITY';
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'userpermission_admins_policy' AND polrelid = '"UserPermission"'::regclass) THEN
        EXECUTE $pol$CREATE POLICY userpermission_admins_policy ON "UserPermission" FOR ALL USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN'))) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid()::text AND u.role::text IN ('ADMIN','SUPER_ADMIN')));$pol$;
      END IF;
    END IF;

  ELSE
    RAISE NOTICE 'Skipping RLS policies: auth.uid() not available (not running in Supabase)';
  END IF;
END
$$;
