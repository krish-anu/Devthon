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
        user.role === "ADMIN" || user.role === "SUPER_ADMIN"
          ? "/admin/dashboard"
          : user.role === "DRIVER"
            ? "/driver/dashboard"
            : "/users/dashboard",
      );
    }
  }, [user, loading, roles, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center w-28 h-28">
            <span
              className="absolute inset-0 m-auto rounded-full border opacity-30 lag-spin-lag"
              style={{ width: 112, height: 112, borderWidth: 4, borderColor: 'rgba(0,0,0,0.08)' }}
              aria-hidden
            />

            <img
              src="/favicon.svg"
              alt="Trash2Treasure logo"
              width={80}
              height={80}
              className="relative z-10 lag-spin"
            />
          </div>

          <div className="text-sm text-(--muted)">Checking access...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
