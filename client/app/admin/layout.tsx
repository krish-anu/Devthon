"use client";

import {
  LayoutGrid,
  Users,
  Truck,
  ClipboardList,
  Tag,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Header } from "@/components/layout/header";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isPublicSignup = pathname?.startsWith("/admin/signup");
  const navItems = [
    {
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      label: "Users",
      href: "/admin/users",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Drivers",
      href: "/admin/drivers",
      icon: <Truck className="h-4 w-4" />,
    },
    {
      label: "Bookings",
      href: "/admin/bookings",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      label: "Pricing",
      href: "/admin/pricing",
      icon: <Tag className="h-4 w-4" />,
    },
    {
      label: "SMS",
      href: "/admin/sms",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      label: "Settings",
      href: "/admin/settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  // Super Admin exclusive items
  const superAdminItems =
    user?.role === "SUPER_ADMIN"
      ? [
          {
            label: "Approvals",
            href: "/admin/approvals",
            icon: <ShieldCheck className="h-4 w-4" />,
          },
          {
            label: "Manage Roles",
            href: "/admin/manage-roles",
            icon: <UserCog className="h-4 w-4" />,
          },
        ]
      : [];

  const allNavItems = [...navItems, ...superAdminItems];

  if (isPublicSignup) {
    return (
      <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
        {children}
      </GoogleOAuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>
        <AppShell
          sidebar={<Sidebar title="Admin Portal" items={allNavItems} />}
          header={<Header title="Admin Console" />}
        >
          {children}
        </AppShell>
      </RequireAuth>
    </GoogleOAuthProvider>
  );
}
