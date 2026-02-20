"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Pagination from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api";
import { NotificationItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { SkeletonGrid } from "@/components/shared/Skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  XCircle,
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

type NotificationsResponse = {
  items: NotificationItem[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isFetching } = useQuery<NotificationsResponse>({
    queryKey: ["admin-notifications", afterCursor, beforeCursor, limit],
    queryFn: () =>
      apiFetch<NotificationsResponse>(
        `/notifications?limit=${limit}${afterCursor ? `&after=${afterCursor}` : ""}${beforeCursor ? `&before=${beforeCursor}` : ""}`,
      ),
    refetchInterval: 30_000,
    placeholderData: (previousData) => previousData,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/notifications/mark-all-read", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "header-unread-count"],
      });
      toast({
        title: "Notifications cleared",
        description: "All alerts marked as read.",
        variant: "success",
        action: <ToastAction altText="Undo">UNDO</ToastAction>,
      });
    },
  });

  const items = data?.items ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  const handleClick = async (item: NotificationItem) => {
    queryClient.setQueriesData<NotificationsResponse | undefined>(
      { queryKey: ["admin-notifications"] },
      (old) =>
        old
          ? {
              ...old,
              items: old.items.map((n) =>
                n.id === item.id ? { ...n, isRead: true } : n,
              ),
            }
          : old,
    );

    queryClient.invalidateQueries({
      queryKey: ["notifications", "header-unread-count"],
    });

    try {
      await apiFetch(`/notifications/${item.id}/mark-read`, { method: "POST" });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "header-unread-count"],
      });
    }

    if (item.bookingId) {
      router.push("/admin/bookings");
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
          <>
            {items.map((item) => (
              <Card
                key={item.id}
                className={`flex flex-col gap-2 transition-colors ${
                  !item.isRead ? "bg-green-50" : "opacity-75"
                } ${item.bookingId ? "cursor-pointer hover:shadow-md" : ""}`}
                onClick={() => handleClick(item)}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    {levelIcon[item.level]}
                    <h3 className="truncate text-lg font-semibold">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.bookingId && (
                      <ExternalLink className="h-3.5 w-3.5 text-[color:var(--muted)]" />
                    )}
                    <Badge variant={levelVariant[item.level]}>
                      {item.level}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-[color:var(--muted)]">
                  {item.message}
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </Card>
            ))}

            <Pagination
              nextCursor={data?.nextCursor ?? null}
              prevCursor={data?.prevCursor ?? null}
              onNext={() => {
                setAfterCursor(data?.nextCursor ?? null);
                setBeforeCursor(null);
              }}
              onPrev={() => {
                setBeforeCursor(data?.prevCursor ?? null);
                setAfterCursor(null);
              }}
              limit={limit}
              onLimitChange={(n) => {
                setLimit(n);
                setAfterCursor(null);
                setBeforeCursor(null);
              }}
              loading={isFetching}
            />
          </>
        ) : (
          <Card className="p-8 text-center text-[color:var(--muted)]">
            <p className="text-lg">No notifications yet.</p>
            <p className="mt-1 text-sm">
              You&apos;ll receive updates when bookings are created, drivers
              assigned, pickups completed, and more.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
