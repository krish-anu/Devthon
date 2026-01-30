"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { NotificationItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { CheckCircle, CreditCard, UserPlus, WifiOff, Package, AlertTriangle, FileText, Settings } from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  "Pickup Completed": <CheckCircle className="h-5 w-5 text-emerald-500" />,
  "Payment Processed": <CreditCard className="h-5 w-5 text-emerald-500" />,
  "New User Registration": <UserPlus className="h-5 w-5 text-purple-500" />,
  "Driver Offline": <WifiOff className="h-5 w-5 text-orange-500" />,
  "High Volume Pickup": <Package className="h-5 w-5 text-blue-500" />,
  "Low Inventory Alert": <AlertTriangle className="h-5 w-5 text-amber-500" />,
  "Weekly Report": <FileText className="h-5 w-5 text-gray-500" />,
  "System Update": <Settings className="h-5 w-5 text-gray-500" />,
};

const getIconBgColor = (title: string): string => {
  if (title.includes("Completed")) return "bg-emerald-100 dark:bg-emerald-900/30";
  if (title.includes("Payment")) return "bg-emerald-100 dark:bg-emerald-900/30";
  if (title.includes("User")) return "bg-purple-100 dark:bg-purple-900/30";
  if (title.includes("Offline")) return "bg-orange-100 dark:bg-orange-900/30";
  if (title.includes("Volume")) return "bg-blue-100 dark:bg-blue-900/30";
  if (title.includes("Alert") || title.includes("Low")) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-gray-100 dark:bg-gray-900/30";
};

const getIcon = (title: string): React.ReactNode => {
  for (const [key, icon] of Object.entries(iconMap)) {
    if (title.includes(key.split(" ")[0])) return icon;
  }
  return <CheckCircle className="h-5 w-5 text-emerald-500" />;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <button 
          onClick={() => mutation.mutate()}
          className="text-sm font-medium text-emerald-500 hover:text-emerald-600 hover:underline"
        >
          Mark all as read
        </button>
      </div>

      {/* Notifications List */}
      <Card className="divide-y divide-(--border) p-0">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-4 p-4 hover:bg-(--surface-soft) transition-colors">
            {/* Icon */}
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getIconBgColor(item.title)}`}>
              {getIcon(item.title)}
            </div>
            
            {/* Content */}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-(--muted)">{item.message}</p>
            </div>

            {/* Time & Indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-(--muted)">{formatTimeAgo(new Date(item.createdAt))}</span>
              {!item.readAt && (
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="p-8 text-center text-(--muted)">
            No notifications yet.
          </div>
        )}
      </Card>
    </div>
  );
}
