"use client";

import { LayoutGrid, Truck, ClipboardList, Bell, LogOut } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
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
  ];

  return (
    <RequireAuth roles={["DRIVER"]}>
      <AppShell
        sidebar={<Sidebar title="Driver Console" items={navItems} />}
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">
                Driver Console
              </p>
              <h2 className="text-lg font-semibold">
                Welcome, {user?.fullName ?? "Driver"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        }
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}
