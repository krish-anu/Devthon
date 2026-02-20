"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PhoneInput from "@/components/ui/phone-input";
import { toast } from "@/components/ui/use-toast";
import { PushNotificationToggle } from "@/components/shared/PushNotificationToggle";
import { apiFetch } from "@/lib/api";
import { isValidSriLankaPhone } from "@/lib/phone";

const profileSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters"),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().refine((value) => isValidSriLankaPhone(value), {
    message: "Invalid Sri Lanka phone number",
  }),
  address: z.string().trim().min(3, "Address must be at least 3 characters"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

type AdminNotificationSettings = {
  emailReports: boolean;
  systemAlerts: boolean;
  newUserAlerts: boolean;
};

const defaultNotificationSettings: AdminNotificationSettings = {
  emailReports: true,
  systemAlerts: true,
  newUserAlerts: false,
};

const adminSettingsStorageKey = "t2c-admin-settings";
const browserNotificationsStorageKey = "t2c-admin-browser-notify-enabled";

function loadStoredNotificationSettings(): AdminNotificationSettings {
  if (typeof window === "undefined") return defaultNotificationSettings;

  try {
    const stored = localStorage.getItem(adminSettingsStorageKey);
    if (!stored) return defaultNotificationSettings;
    const parsed = JSON.parse(stored) as Partial<AdminNotificationSettings>;
    return { ...defaultNotificationSettings, ...parsed };
  } catch {
    return defaultNotificationSettings;
  }
}

function loadBrowserNotificationStatus() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(browserNotificationsStorageKey) === "1";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function AdminSettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [notificationSettings, setNotificationSettings] =
    useState<AdminNotificationSettings>(loadStoredNotificationSettings);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(loadBrowserNotificationStatus);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      adminSettingsStorageKey,
      JSON.stringify(notificationSettings),
    );
  }, [notificationSettings]);

  const nameParts = useMemo(
    () =>
      (user?.fullName ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    [user?.fullName],
  );

  const profileDefaults = useMemo<ProfileFormValues>(
    () => ({
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" ") ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      address: user?.address ?? "",
    }),
    [nameParts, user?.email, user?.phone, user?.address],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaults,
  });

  useEffect(() => {
    reset(profileDefaults);
  }, [profileDefaults, reset]);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors, isSubmitting: isChangingPassword },
    reset: resetPassword,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const saveProfile = async (values: ProfileFormValues) => {
    try {
      await apiFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: `${values.firstName} ${values.lastName}`.trim(),
          email: values.email,
          phone: values.phone,
          address: values.address,
        }),
      });

      await refreshProfile();
      toast({
        title: "Profile updated",
        description: "Changes saved successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: getErrorMessage(error, "Unable to update profile"),
        variant: "error",
      });
    }
  };

  const changePassword = async (values: PasswordFormValues) => {
    try {
      await apiFetch("/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      toast({
        title: "Password changed",
        description: "Your account password was updated.",
        variant: "success",
      });
      resetPassword();
    } catch (error) {
      toast({
        title: "Change failed",
        description: getErrorMessage(error, "Unable to change password"),
        variant: "error",
      });
    }
  };

  const setPreference = (key: keyof AdminNotificationSettings, value: boolean) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const enableBrowserNotifications = async () => {
    if (typeof window === "undefined") return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({
          title: "Permission required",
          description: "Allow notifications in your browser settings.",
          variant: "warning",
        });
        return;
      }

      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/notification-sw.js");
        } catch {
          // The direct Notification API still works without service worker registration.
        }
      }

      localStorage.setItem(browserNotificationsStorageKey, "1");
      setBrowserNotificationsEnabled(true);
      toast({
        title: "Notifications enabled",
        description: "Browser notifications are now active.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Enable failed",
        description: getErrorMessage(error, "Could not enable notifications"),
        variant: "error",
      });
    }
  };

  const disableBrowserNotifications = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(browserNotificationsStorageKey);
    setBrowserNotificationsEnabled(false);
    toast({
      title: "Notifications disabled",
      description: "Browser notifications turned off.",
      variant: "default",
    });
  };

  const sendTestNotification = () => {
    if (typeof window === "undefined") return;

    if (Notification.permission !== "granted") {
      toast({
        title: "Cannot show notification",
        description: "Enable browser notifications first.",
        variant: "warning",
      });
      return;
    }

    try {
      new Notification("Admin test notification", {
        body: "This is a test from Admin Settings.",
      });
      toast({
        title: "Test sent",
        description: "Notification displayed successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Test failed",
        description: getErrorMessage(error, "Could not send test notification"),
        variant: "error",
      });
    }
  };

  const displayName = user?.fullName ?? "Admin";
  const avatarFromProfile =
    user && "avatarUrl" in user
      ? (user as { avatarUrl?: string | null }).avatarUrl
      : null;
  const avatarSrc = avatarFromProfile ?? user?.avatar ?? null;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "--";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-(--muted)">
          Manage your admin profile, account security, and notifications.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-4">
        <Avatar src={avatarSrc} alt={displayName} className="h-16 w-16" />
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">{displayName}</h3>
          <p className="text-sm text-(--muted)">{user?.email ?? "--"}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{user?.role ?? "ADMIN"}</Badge>
            <Badge variant={user?.approved === false ? "warning" : "default"}>
              {user?.approved === false ? "Pending approval" : "Approved"}
            </Badge>
          </div>
          <p className="text-xs text-(--muted)">Member since {memberSince}</p>
        </div>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="personal">Personal info</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={handleSubmit(saveProfile)}
            >
              <div className="space-y-2">
                <Label htmlFor="admin-first-name">First name</Label>
                <Input id="admin-first-name" {...register("firstName")} />
                {errors.firstName && (
                  <p className="text-xs text-rose-400">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-last-name">Last name</Label>
                <Input id="admin-last-name" {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-xs text-rose-400">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-rose-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-phone">Phone</Label>
                <PhoneInput id="admin-phone" {...register("phone")} />
                {errors.phone && (
                  <p className="text-xs text-rose-400">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="admin-address">Address</Label>
                <Input id="admin-address" {...register("address")} />
                {errors.address && (
                  <p className="text-xs text-rose-400">{errors.address.message}</p>
                )}
              </div>

              <div className="flex gap-3 md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset(profileDefaults)}
                >
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Change password</h3>
              <p className="text-xs text-(--muted)">
                Use a strong password with at least 6 characters.
              </p>
            </div>

            <form className="grid gap-3" onSubmit={handlePasswordSubmit(changePassword)}>
              <div className="space-y-2">
                <Label htmlFor="admin-current-password">Current password</Label>
                <Input
                  id="admin-current-password"
                  type="password"
                  {...registerPassword("currentPassword")}
                />
                {passwordErrors.currentPassword && (
                  <p className="text-xs text-rose-400">
                    {passwordErrors.currentPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-new-password">New password</Label>
                <Input
                  id="admin-new-password"
                  type="password"
                  {...registerPassword("newPassword")}
                />
                {passwordErrors.newPassword && (
                  <p className="text-xs text-rose-400">
                    {passwordErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirm password</Label>
                <Input
                  id="admin-confirm-password"
                  type="password"
                  {...registerPassword("confirmPassword")}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-xs text-rose-400">
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isChangingPassword}>
                  Change password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetPassword()}
                >
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Admin alerts</h3>
                <p className="text-xs text-(--muted)">
                  These preferences are saved locally for this browser.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="admin-email-reports"
                    checked={notificationSettings.emailReports}
                    onCheckedChange={(checked) =>
                      setPreference("emailReports", Boolean(checked))
                    }
                  />
                  <div>
                    <Label htmlFor="admin-email-reports">Email reports</Label>
                    <p className="text-xs text-(--muted)">
                      Receive daily revenue and pickup summaries by email.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="admin-system-alerts"
                    checked={notificationSettings.systemAlerts}
                    onCheckedChange={(checked) =>
                      setPreference("systemAlerts", Boolean(checked))
                    }
                  />
                  <div>
                    <Label htmlFor="admin-system-alerts">System alerts</Label>
                    <p className="text-xs text-(--muted)">
                      Receive critical platform status notifications.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="admin-new-user-alerts"
                    checked={notificationSettings.newUserAlerts}
                    onCheckedChange={(checked) =>
                      setPreference("newUserAlerts", Boolean(checked))
                    }
                  />
                  <div>
                    <Label htmlFor="admin-new-user-alerts">New user alerts</Label>
                    <p className="text-xs text-(--muted)">
                      Get notified when new users register.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-(--border) pt-4">
                <h3 className="text-sm font-semibold">Browser notifications</h3>
                <p className="mb-3 text-xs text-(--muted)">
                  Allow notification popups while working in the admin console.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={enableBrowserNotifications}>
                    Enable
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={disableBrowserNotifications}
                  >
                    Disable
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={sendTestNotification}
                  >
                    Send test
                  </Button>
                </div>
                <p className="mt-2 text-xs text-(--muted)">
                  Status: {browserNotificationsEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>

              <div className="border-t border-(--border) pt-4">
                <h3 className="text-sm font-semibold">Push subscriptions</h3>
                <p className="mb-2 text-xs text-(--muted)">
                  Manage server-delivered push notifications for this browser.
                </p>
                <PushNotificationToggle />
              </div>

              <div className="border-t border-(--border) pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setNotificationSettings(defaultNotificationSettings)
                  }
                >
                  Reset alert preferences
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
