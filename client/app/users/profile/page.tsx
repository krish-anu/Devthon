"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, passkeyApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import PhoneInput from "@/components/ui/phone-input";
import { isValidSriLankaPhone } from "@/lib/phone";
import { toast } from "@/components/ui/use-toast";
import supabase, { getBucketName } from "@/lib/supabase";
import ImageCropper from "@/components/ui/ImageCropper";
import { useForm as useForm2 } from "react-hook-form";
import { usePasskey } from "@/hooks/usePasskey";
import { RewardsSummary } from "@/lib/types";
import { PushNotificationToggle } from "@/components/shared/PushNotificationToggle";

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z
    .string()
    .refine((v) => isValidSriLankaPhone(v), {
      message: "Invalid Sri Lanka phone number",
    }),
  address: z.string().min(3),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, refreshProfile, logout, updateUser } = useAuth();

  // Avatar upload + cropping helpers
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null); // object URL / data URL to crop
  // Local optimistic preview shown while an upload is in progress (revoked after upload)
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);

  const handleChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic MIME/type validation
    if (!file.type.startsWith("image/") || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file",
        description: "Please choose a JPG, PNG or WebP image.",
        variant: "warning",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Size validation
    if (file.size > MAX_AVATAR_SIZE) {
      toast({
        title: "File too large",
        description: "Please choose an image smaller than 5 MB.",
        variant: "warning",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Show crop UI with an object URL — actual upload will happen after user crops
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    // leave file input value intact for now; we'll clear it after upload/cancel
  };
  const {
    supported: passkeySupported,
    loading: passkeyBusy,
    registerPasskey,
  } = usePasskey();
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const names = (user?.fullName ?? "").split(" ");
  const { data: rewards } = useQuery({
    queryKey: ["rewards", "me"],
    queryFn: () => apiFetch<RewardsSummary>("/rewards/me"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: names[0] ?? "",
      lastName: names[1] ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      address: user?.address ?? "",
    },
  });

  useEffect(() => {
    reset({
      firstName: names[0] ?? "",
      lastName: names[1] ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      address: user?.address ?? "",
    });
  }, [user, reset]);

  // Load registered passkeys
  const loadPasskeys = async () => {
    setPasskeysLoading(true);
    try {
      const list = await passkeyApi.list();
      setPasskeys(list);
    } catch {
      // User may not have any passkeys yet – that's fine
      setPasskeys([]);
    } finally {
      setPasskeysLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadPasskeys();
  }, [user]);

  const handleRegisterPasskey = async () => {
    try {
      await registerPasskey();
      await loadPasskeys(); // Refresh the list
    } catch {
      // Error already toasted by usePasskey hook
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await passkeyApi.delete(id);
      toast({ title: "Passkey removed", variant: "success" });
      await loadPasskeys();
    } catch (error: any) {
      toast({
        title: "Failed to remove passkey",
        description: error?.message,
        variant: "error",
      });
    }
  };

  const onSubmit = async (values: FormValues) => {
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
        description: "Changes saved.",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message,
        variant: "error",
      });
    }
  };

  // Upload the cropped file to Supabase and persist avatarUrl
  const handleCroppedFile = async (file: File) => {
    if (!user) return;

    // show optimistic preview while uploading
    const previewUrl = URL.createObjectURL(file);
    setLocalAvatarPreview(previewUrl);

    setUploading(true);
    try {
      const filename = `${Date.now()}_${file.name}`;
      const path = `avatars/${user?.id ?? "unknown"}/${filename}`;
      const bucket = getBucketName();
      const sb = supabase();
      if (!sb) throw new Error("Supabase not configured");

      const { data: uploadData, error: uploadErr } = await sb.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = sb.storage.from(bucket).getPublicUrl(path);
      let url = (publicData as any)?.publicUrl ?? null;
      if (!url) {
        const { data: signedData, error: signedErr } = await sb.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60 * 24);
        if (signedErr) throw signedErr;
        url = (signedData as any)?.signedUrl ?? null;
      }

      const updatedUser = await apiFetch<any>("/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: url }),
      });
      try {
        updateUser(updatedUser);
      } catch {
        await refreshProfile();
      }
      toast({ title: "Profile photo updated", variant: "success" });

      // server persisted — user context will update Avatar; clear optimistic preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setLocalAvatarPreview(null);
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message ?? "Unable to upload image", variant: "error" });
      // clear optimistic preview on failure
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setLocalAvatarPreview(null);
      }
    } finally {
      setUploading(false);
      // cleanup cropSrc + clear file input
      if (cropSrc) {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  // Change password form
  const passwordSchema = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
      confirmPassword: z.string().min(6),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  type PasswordForm = z.infer<typeof passwordSchema>;

  const {
    register: pwRegister,
    handleSubmit: pwHandleSubmit,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
    reset: resetPw,
  } = useForm2<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onChangePassword = async (vals: PasswordForm) => {
    try {
      await apiFetch("/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: vals.currentPassword,
          newPassword: vals.newPassword,
        }),
      });
      toast({
        title: "Password changed",
        description: "Your password was updated.",
        variant: "success",
      });
      resetPw();
    } catch (err: any) {
      toast({
        title: "Change failed",
        description: err?.message ?? "Unable to change password",
        variant: "error",
      });
    }
  };

  // Delete account UI state
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== user.email) {
      return toast({
        title: "Confirmation mismatch",
        description: "Please type your email to confirm.",
        variant: "warning",
      });
    }

    try {
      setDeleting(true);
      await apiFetch(`/me`, {
        method: "DELETE",
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      // log out and navigate away
      try {
        await logout();
      } catch {
        try {
          const { clearAuth } = await import("@/lib/auth");
          clearAuth();
        } catch {}
      }
      toast({
        title: "Account deleted",
        description: "Your account has been deleted.",
        variant: "success",
      });
      router.push("/");
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message ?? "Could not delete account",
        variant: "error",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      setDeletePassword("");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-4">
        <div>
          <Avatar
            src={localAvatarPreview ?? (user as any)?.avatar ?? (user as any)?.avatarUrl ?? null}
            alt={user?.fullName ?? "User"}
            className="h-16 w-16"
          />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{user?.fullName ?? "User"}</h3>
          <p className="text-sm text-(--muted)">{user?.email}</p>
          <p className="text-xs text-(--muted)">
            Member since{" "}
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : "--"}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button onClick={handleChoosePhoto} disabled={uploading}>
              {uploading ? "Uploading..." : "Change Photo"}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  const updatedUser = await apiFetch<any>("/me", {
                    method: "PATCH",
                    body: JSON.stringify({ avatarUrl: null }),
                  });
                  try {
                    updateUser(updatedUser);
                  } catch {
                    await refreshProfile();
                  }
                  toast({ title: "Profile photo removed", variant: "success" });
                } catch (err: any) {
                  toast({
                    title: "Remove failed",
                    description: err?.message,
                    variant: "error",
                  });
                }
              }}
            >
              Remove
            </Button>
          </div>
          <p className="mt-2 text-xs text-(--muted)">
            Allowed formats: JPG, PNG, WebP — max 5 MB. You can crop the image before saving.
          </p>
        </div>
      </Card>

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          aspect={1}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (localAvatarPreview) {
              URL.revokeObjectURL(localAvatarPreview);
              setLocalAvatarPreview(null);
            }
          }}
          onCrop={handleCroppedFile}
        />
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Reward Points</h3>
            <p className="text-sm text-(--muted)">
              Lifetime totals and this month&apos;s points.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-(--border) bg-(--card) px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">
              Lifetime Points
            </p>
            <p className="text-2xl font-semibold">
              {rewards?.totalPoints ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-(--border) bg-(--card) px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">
              This Month
            </p>
            <p className="text-2xl font-semibold">
              {rewards?.monthPoints ?? 0}
            </p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal info</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={handleSubmit(onSubmit)}
            >
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input {...register("firstName")} />
                {errors.firstName && (
                  <p className="text-xs text-rose-400">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-xs text-rose-400">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-rose-400">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <PhoneInput {...register("phone")} />
                {errors.phone && (
                  <p className="text-xs text-rose-400">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input {...register("address")} />
                {errors.address && (
                  <p className="text-xs text-rose-400">
                    {errors.address.message}
                  </p>
                )}
              </div>
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  Save Changes
                </Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <div className="grid gap-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Change password</h4>
                <form
                  className="grid gap-3"
                  onSubmit={pwHandleSubmit(onChangePassword)}
                >
                  <div className="space-y-2">
                    <Label>Current password</Label>
                    <Input type="password" {...pwRegister("currentPassword")} />
                    {pwErrors.currentPassword && (
                      <p className="text-xs text-rose-400">
                        {pwErrors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>New password</Label>
                    <Input type="password" {...pwRegister("newPassword")} />
                    {pwErrors.newPassword && (
                      <p className="text-xs text-rose-400">
                        {pwErrors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm new password</Label>
                    <Input type="password" {...pwRegister("confirmPassword")} />
                    {pwErrors.confirmPassword && (
                      <p className="text-xs text-rose-400">
                        {pwErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={pwSubmitting}>
                      Change password
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetPw()}
                    >
                      Reset
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </Card>

          {/* Danger zone: Delete account */}
          <Card className="mt-4 border border-rose-200/40">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Delete account</h4>
                <p className="text-xs text-(--muted)">
                  Permanently delete your account. This will remove personal
                  information from your profile and disable access. Bookings and
                  transactions will be retained for accounting purposes but will
                  be anonymized.
                </p>
              </div>
              <div>
                <Dialog
                  open={showDeleteDialog}
                  onOpenChange={(v) => setShowDeleteDialog(v)}
                >
                  <DialogTrigger asChild>
                    <Button variant="danger" size="sm">
                      Delete account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete your account</DialogTitle>
                      <DialogDescription>
                        This action is permanent. To confirm, type your email
                        below and optionally enter your password if you use a
                        local password for authentication.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label>Type your email to confirm</Label>
                        <Input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Current password (if set)</Label>
                        <Input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Delete account"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>

          {/* Passkey Management */}
          {passkeySupported && (
            <Card className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">Passkeys</h4>
                    <p className="text-xs text-(--muted)">
                      Sign in securely without a password using your
                      device&apos;s biometrics or PIN.
                    </p>
                  </div>
                  <Button
                    onClick={handleRegisterPasskey}
                    disabled={passkeyBusy}
                    size="sm"
                  >
                    {passkeyBusy ? "Registering…" : "+ Add passkey"}
                  </Button>
                </div>

                {passkeysLoading ? (
                  <p className="text-xs text-(--muted)">Loading passkeys…</p>
                ) : passkeys.length === 0 ? (
                  <p className="text-xs text-(--muted)">
                    No passkeys registered yet. Add one to enable passwordless
                    login.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {passkeys.map((pk) => (
                      <div
                        key={pk.id}
                        className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {pk.deviceName || "Passkey"}
                          </p>
                          <p className="text-xs text-(--muted)">
                            Registered{" "}
                            {new Date(pk.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-500 hover:text-rose-600"
                          onClick={() => handleDeletePasskey(pk.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Browser notifications
                </h4>
                <p className="mb-3 text-sm text-(--muted)">
                  Allow the browser to show notifications even when this tab is
                  in the background.
                </p>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm">Status</p>
                    <p className="text-xs text-(--muted)">
                      {typeof window !== "undefined" &&
                      localStorage.getItem("notifyEnabled")
                        ? "Enabled"
                        : "Disabled"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        if (typeof window === "undefined") return;
                        try {
                          const perm = await Notification.requestPermission();
                          if (perm !== "granted") {
                            toast({
                              title: "Permission required",
                              description:
                                "Please allow notifications in your browser settings.",
                              variant: "warning",
                            });
                            return;
                          }
                          if ("serviceWorker" in navigator) {
                            try {
                              await navigator.serviceWorker.register(
                                "/notification-sw.js",
                              );
                            } catch (err) {
                              // registration failed, continue
                            }
                          }
                          localStorage.setItem("notifyEnabled", "1");
                          toast({
                            title: "Notifications enabled",
                            description:
                              "You can receive notifications when the app is in background.",
                            variant: "success",
                          });
                        } catch (e: any) {
                          toast({
                            title: "Enable failed",
                            description:
                              e?.message ?? "Could not enable notifications",
                            variant: "error",
                          });
                        }
                      }}
                    >
                      Enable
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (typeof window === "undefined") return;
                        localStorage.removeItem("notifyEnabled");
                        toast({
                          title: "Notifications disabled",
                          description: "Browser notifications turned off.",
                          variant: "default",
                        });
                      }}
                    >
                      Disable
                    </Button>
                  </div>
                </div>

                {/* Push subscription / server-side push toggle (manage from settings) */}
                <div className="mt-6 border-t pt-4">
                  <h5 className="text-sm font-semibold mb-2">Push subscriptions</h5>
                  <p className="mb-3 text-sm text-(--muted)">
                    Enable or disable server-delivered push notifications (used to
                    receive updates when the app is closed). This registers a
                    subscription with the backend.
                  </p>
                  <div className="flex items-center gap-3">
                    <PushNotificationToggle />
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          if (
                            navigator.serviceWorker &&
                            navigator.serviceWorker.controller
                          ) {
                            navigator.serviceWorker.controller.postMessage({
                              type: "TEST_NOTIFICATION",
                              title: "Test push",
                              body: "Test push from settings",
                            });
                            toast({ title: "Test sent", variant: "success" });
                            return;
                          }
                        } catch (e) {
                          // ignore
                        }
                        toast({ title: "Test unavailable", variant: "warning" });
                      }}
                    >
                      Send test push
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <Button
                    onClick={async () => {
                      try {
                        if (
                          navigator.serviceWorker &&
                          navigator.serviceWorker.controller
                        ) {
                          try {
                            navigator.serviceWorker.controller.postMessage({
                              type: "TEST_NOTIFICATION",
                              title: "Test notification",
                              body: "This is a test from Trash2Treasure.",
                            });
                            toast({
                              title: "Test sent",
                              description:
                                "Test notification posted to service worker.",
                              variant: "success",
                            });
                            return;
                          } catch (err) {
                            // Ignore postMessage failures (COOP / cross-origin) and fallback below
                          }
                        }
                      } catch (e) {
                        // fallback
                      }
                      if (Notification.permission === "granted") {
                        new Notification("Test notification", {
                          body: "This is a test from Trash2Treasure.",
                        });
                        toast({
                          title: "Test shown",
                          description: "Notification displayed.",
                          variant: "success",
                        });
                      } else {
                        toast({
                          title: "Cannot show",
                          description: "Allow notifications first.",
                          variant: "warning",
                        });
                      }
                    }}
                  >
                    Send test notification
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Notification delivery
                </h4>
                <p className="text-sm text-(--muted)">
                  When enabled and a backend push subscription exists,
                  notifications can be delivered while the app is not open. This
                  enables the browser permission and registers a lightweight
                  service worker for handling notifications.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
