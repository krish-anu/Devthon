"use client";

import Link from "next/link";
import { LogOut, Home as HomeIcon, User as UserIcon, Settings as SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth/auth-provider";

export function UserMenu({ onlySettings }: { onlySettings?: boolean }) {
  const { user, logout } = useAuth();
  const avatarSrc = (user as any)?.avatarUrl ?? (user as any)?.avatar ?? null;

  // Resolve a sensible settings/profile link depending on role
  const settingsHref =
    user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
      ? "/admin/settings"
      : user?.role === "DRIVER"
      ? "/driver/settings"
      : "/users/profile";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none"> 
          <Avatar src={avatarSrc} alt={user?.fullName ?? "User"} className="h-10 w-10" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <div className="px-3 py-2">
          <div className="text-sm font-semibold">{user?.fullName ?? "User"}</div>
          {user?.email && <div className="text-sm text-(--muted)">{user.email}</div>}
        </div>
        <div className="border-t border-(--border)" />
        {!onlySettings && (
          <DropdownMenuItem asChild>
            <Link href="/" className="flex items-center gap-2">
              <HomeIcon className="h-4 w-4" /> Home
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()} className="text-red-600">
          <LogOut className="h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
