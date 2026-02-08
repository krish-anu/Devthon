"use client";

import {
  LayoutGrid,
  History,
  Truck,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Header } from "@/components/layout/header";
import { UserMenu } from "@/components/layout/user-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navItems = [
    {
      label: "Dashboard",
      href: "/users/dashboard",
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      label: "Booking History",
      href: "/users/bookings",
      icon: <History className="h-4 w-4" />,
    },
    {
      label: "Pending Pickups",
      href: "/users/pending-pickups",
      icon: <Truck className="h-4 w-4" />,
    },
    {
      label: "Notifications",
      href: "/users/notifications",
      icon: <Bell className="h-4 w-4" />,
    },
    {
      label: "Profile Settings",
      href: "/users/profile",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <RequireAuth roles={["CUSTOMER", "ADMIN", "SUPER_ADMIN"]}>
      <AppShell
        sidebar={<Sidebar title="User Portal" items={navItems} />}
        header={<Header title="User Portal" right={<UserMenu />} showThemeToggle />}
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}
