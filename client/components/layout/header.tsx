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
    <div className="flex items-center justify-between w-full gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-(--brand) truncate">
          {title}
        </p>
        <h2 className="text-base sm:text-lg font-semibold truncate">
          Welcome, {user?.fullName?.split(" ")[0] ?? "Admin"}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {showThemeToggle && <ThemeToggle />}
        {right
          ? right
          : showLogout && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="text-xs sm:text-sm"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}
      </div>
    </div>
  );
}

export default Header;
