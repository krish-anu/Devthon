"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/components/auth/auth-provider";

export function Header({
  title,
  showLogout = true,
  showThemeToggle = true,
  right,
}: {
  title: string;
  showLogout?: boolean;
  showThemeToggle?: boolean;
  right?: React.ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center justify-between w-full gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">{title}</p>
        <h2 className="text-lg font-semibold">Welcome, {user?.fullName ?? "Admin"}</h2>
      </div>

      <div className="flex items-center gap-2 right">
        {showThemeToggle && <ThemeToggle />}
        {right ? (
          right
        ) : (
          showLogout && (
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export default Header;
