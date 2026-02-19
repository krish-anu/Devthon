"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { NotificationItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { SkeletonGrid } from "@/components/shared/Skeleton";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from "lucide-react";

const levelVariant = {
  INFO: "info",
  SUCCESS: "default",
  WARNING: "warning",
  ERROR: "danger",
} as const;

const levelIcon = {
  INFO: <Info className="h-5 w-5 text-blue-500" />,
  SUCCESS: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  WARNING: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  ERROR: <XCircle className="h-5 w-5 text-red-500" />,
} as const;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationItem[]>("/users/notifications"),
    refetchInterval: 30_000, // Poll every 30s for new notifications
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/users/notifications/mark-all-read", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({
        title: "Notifications cleared",
        description: "All alerts marked as read.",
        variant: "success",
        action: <ToastAction altText="Undo">UNDO</ToastAction>,
      });
    },
  });

  const items = data ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  const handleClick = async (item: NotificationItem) => {
    // optimistic UI update
    queryClient.setQueryData<NotificationItem[] | undefined>(["notifications"], (old) =>
      (old ?? []).map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
    );

    // ensure header badge refreshes
    queryClient.invalidateQueries({ queryKey: ["notifications", "header-unread-count"] });

    try {
      await apiFetch(`/notifications/${item.id}/mark-read`, { method: "POST" });
    } catch (err) {
      // revert / refresh on error
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "header-unread-count"] });
    }

    if (item.bookingId) {
      router.push(`/users/bookings/${item.bookingId}`);
    }
  };

  return (
    <div className="notifications-page space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="default" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => mutation.mutate()}
            disabled={unreadCount === 0}
            className="w-full sm:w-auto"
          >
            Mark all as read
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card className="p-6">
              <SkeletonGrid count={3} cardClass="h-24" />
            </Card>
          ) : items.length ? (
          items.map((item) => (
            <Card
              key={item.id}
              className={`flex flex-col gap-2 transition-colors ${
                !item.isRead
                  ? "bg-green-50"
                  : "opacity-75"
              } ${item.bookingId ? "cursor-pointer hover:shadow-md" : ""}`}
              onClick={() => handleClick(item)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  {levelIcon[item.level]}
                  <h3 className="truncate text-lg font-semibold">{item.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {item.bookingId && (
                    <ExternalLink className="h-3.5 w-3.5 text-[color:var(--muted)]" />
                  )}
                  <Badge variant={levelVariant[item.level]}>{item.level}</Badge>
                </div>
              </div>
              <p className="text-sm text-[color:var(--muted)]">{item.message}</p>
              <p className="text-xs text-[color:var(--muted)]">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-[color:var(--muted)]">
            <p className="text-lg">No notifications yet.</p>
            <p className="text-sm mt-1">
              You&apos;ll receive updates when bookings are created, drivers
              assigned, pickups completed, and more.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
