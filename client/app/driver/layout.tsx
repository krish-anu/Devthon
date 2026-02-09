"use client";

import {
  LayoutGrid,
  Truck,
  ClipboardList,
  Bell,
  LogOut,
  Settings,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { PushNotificationToggle } from "@/components/shared/PushNotificationToggle";
import { UserMenu } from "@/components/layout/user-menu";
import { usePathname } from "next/navigation";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isPublicSignup = pathname?.startsWith("/driver/signup");
  const navItems = [
    {
      label: "Dashboard",
      href: "/driver/dashboard",
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      label: "My Bookings",
      href: "/driver/bookings",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      label: "Notifications",
      href: "/driver/notifications",
      icon: <Bell className="h-4 w-4" />,
    },
    {
      label: "Settings",
      href: "/driver/settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  if (isPublicSignup) {
    return <>{children}</>;
  }

  const isPendingApproval = user && user.role === "DRIVER" && !user.approved;

  return (
    <RequireAuth roles={["DRIVER"]}>
      <AppShell
        sidebar={isPendingApproval ? null : <Sidebar title="Driver Console" items={navItems} />}
        header={<Header title="Driver Console" right={<>{isPendingApproval ? <UserMenu onlySettings /> : <><PushNotificationToggle /><UserMenu /></>}</>} showThemeToggle />}
      >
        {isPendingApproval ? (
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <div className="max-w-2xl text-center">
              <h2 className="text-2xl font-semibold">Account pending approval</h2>
              <p className="mt-4 text-(--muted)">Your account is pending approval by a Super Admin. Please wait for acceptance.</p>
            </div>
          </div>
        ) : (
          children
        )}
      </AppShell>
    </RequireAuth>
  );
}
