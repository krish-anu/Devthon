"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { UserRole } from "@/lib/types";

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(user.role)) {
      // Don't force-navigation away while the user is actively on their profile page
      // (e.g. after saving profile updates) — allow staying on `/users/profile` or `/driver/profile`.
      if (
        pathname &&
        (pathname.startsWith("/users/profile") ||
          pathname.startsWith("/driver/profile"))
      )
        return;
      router.replace(
        user.role === "ADMIN"
          ? "/admin/dashboard"
          : user.role === "DRIVER"
            ? "/driver/dashboard"
            : "/users/dashboard",
      );
    }
  }, [user, loading, roles, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] text-[color:var(--foreground)]">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-4 text-sm text-[color:var(--muted)]">
          Checking access...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
