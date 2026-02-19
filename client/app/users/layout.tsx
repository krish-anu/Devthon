"use client";

import {
  LayoutGrid,
  Plus,
  History,
  Truck,
  Bell,
  Settings,
  Trophy,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { UserMenu } from "@/components/layout/user-menu";
import NotificationNavButton from "@/components/shared/NotificationNavButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    {
      label: "Dashboard",
      href: "/users/dashboard",
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      label: "Book a pickup",
      href: "/users/bookings/new",
      icon: <Plus className="h-4 w-4" />,
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
      label: "Rewards",
      href: "/users/rewards",
      icon: <Trophy className="h-4 w-4" />,
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
        header={<Header title="User Portal" right={<><NotificationNavButton /><UserMenu /></>} showThemeToggle />}
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}
