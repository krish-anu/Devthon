"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { NotificationItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

const levelVariant = {
  INFO: "info",
  SUCCESS: "default",
  WARNING: "warning",
  ERROR: "danger",
} as const;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationItem[]>("/notifications"),
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/notifications/mark-all-read", { method: "POST" }),
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

  return (
    <div className="notifications-page space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notifications</h2>
        <Button variant="outline" onClick={() => mutation.mutate()}>
          Mark all as read
        </Button>
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <Badge variant={levelVariant[item.level]}>{item.level}</Badge>
            </div>
            <p className="text-sm text-[color:var(--muted)]">{item.message}</p>
            <p className="text-xs text-[color:var(--muted)]">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </Card>
        ))}
        {!items.length && <Card>No notifications yet.</Card>}
      </div>
    </div>
  );
}
