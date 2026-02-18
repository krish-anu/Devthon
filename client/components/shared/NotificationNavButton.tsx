"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Header bell that navigates to the appropriate notifications page for the
 * current user role. Shows a small unread-dot when there are unread items.
 */
export default function NotificationNavButton() {
  const router = useRouter();
  const { user } = useAuth();

  // derive target path from role (fallback to users)
  const target =
    user?.role === "DRIVER"
      ? "/driver/notifications"
      : "/users/notifications"; // fallback to users notifications for Admin/other roles (no admin notifications page)

  // lightweight unread count for badge (do not poll aggressively)
  const { data } = useQuery({
    queryKey: ["notifications", "header-unread-count"],
    queryFn: () => apiFetch<any[]>("/notifications?limit=5"),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const unread = (data ?? []).filter((n) => !n.isRead).length;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.push(target)}
      title="Open notifications"
      className="relative"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500" />
      )}
    </Button>
  );
}
