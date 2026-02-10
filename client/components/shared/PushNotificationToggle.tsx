"use client";

import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe, vapidMissing, sessionExpired } =
    usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) {
        toast({
          title: "Push notifications disabled",
          description: "You will no longer receive browser notifications.",
        });
      } else if (sessionExpired) {
        toast({
          title: "Session expired",
          description:
            "Your session expired while updating subscriptions. Please sign in again to manage notifications.",
          variant: "warning",
        });
      } else {
        toast({
          title: "Could not disable",
          description: "Failed to disable push notifications. Try again or check the console.",
          variant: "error",
        });
      }
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({
          title: "Push notifications enabled 🔔",
          description: "You'll now receive booking updates in real-time.",
          variant: "success",
        });
      } else if (permission === "denied") {
        toast({
          title: "Notifications blocked",
          description:
            "Please enable notifications in your browser settings.",
          variant: "error",
        });      } else if (vapidMissing) {
        toast({
          title: "Push unavailable",
          description:
            "Push notifications are not configured on the server (VAPID keys missing). Ask an admin to set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
          variant: "warning",
        });
      } else {
        toast({
          title: "Subscription failed",
          description: "Could not enable push notifications. Try again or check developer console for details.",
          variant: "error",
        });
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isLoading}
      title={isSubscribed ? "Disable push notifications" : "Enable push notifications"}
      className="relative"
    >
      {isSubscribed ? (
        <Bell className="h-4 w-4 text-green-500" />
      ) : (
        <BellOff className="h-4 w-4 text-(--muted)" />
      )}
      {isSubscribed && (
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500" />
      )}
    </Button>
  );
}
