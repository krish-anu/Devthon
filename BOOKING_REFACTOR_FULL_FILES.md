# Booking Refactor Full File Dump

## client/lib/booking-status.ts

`$ext
import { BookingStatus, UserRole } from "@/lib/types";

export type CanonicalBookingStatus =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COLLECTED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

const LEGACY_STATUS_MAP: Partial<Record<BookingStatus, CanonicalBookingStatus>> = {
  SCHEDULED: "CREATED",
  PAID: "COLLECTED",
};

const USER_LABELS: Record<CanonicalBookingStatus, string> = {
  CREATED: "Scheduled",
  ASSIGNED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COLLECTED: "Payment Due",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const INTERNAL_LABELS: Record<CanonicalBookingStatus, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COLLECTED: "Collected",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function normalizeBookingStatus(status: BookingStatus): CanonicalBookingStatus {
  return LEGACY_STATUS_MAP[status] ?? (status as CanonicalBookingStatus);
}

export function getBookingStatusLabel(
  status: BookingStatus,
  viewerRole?: UserRole,
) {
  const normalized = normalizeBookingStatus(status);
  if (viewerRole === "CUSTOMER") {
    return USER_LABELS[normalized];
  }
  return INTERNAL_LABELS[normalized];
}

export function isUserPaymentDueStatus(status: BookingStatus) {
  return normalizeBookingStatus(status) === "COLLECTED";
}

export function canAdminAssign(status: BookingStatus) {
  return normalizeBookingStatus(status) === "CREATED";
}

export function canAdminComplete(status: BookingStatus) {
  return normalizeBookingStatus(status) === "COLLECTED";
}

export function canAdminCancel(status: BookingStatus) {
  return ["CREATED", "ASSIGNED", "IN_PROGRESS", "COLLECTED"].includes(
    normalizeBookingStatus(status),
  );
}

export function canAdminRefund(status: BookingStatus) {
  return normalizeBookingStatus(status) === "CANCELLED";
}

export function canDriverStart(status: BookingStatus) {
  return normalizeBookingStatus(status) === "ASSIGNED";
}

export function canDriverCollect(status: BookingStatus) {
  return ["IN_PROGRESS", "COLLECTED"].includes(normalizeBookingStatus(status));
}

export function canDriverCancel(status: BookingStatus) {
  return ["ASSIGNED", "IN_PROGRESS", "COLLECTED"].includes(
    normalizeBookingStatus(status),
  );
}
` 

## client/lib/types.ts

`$ext
export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN' | 'DRIVER';
export type CustomerType = 'HOUSEHOLD' | 'BUSINESS';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  type?: CustomerType;
  address?: string | null;
  status?: CustomerStatus;
  approved?: boolean;
  driverStatus?: 'ONLINE' | 'OFFLINE' | 'ON_PICKUP';
  createdAt: string;
  avatar?: string | null;
  totalPoints?: number;
}

export type BookingStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  // Legacy statuses are retained for compatibility-safe reads.
  | 'SCHEDULED'
  | 'PAID';

export interface WasteCategory {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface Booking {
  id: string;
  wasteCategory: WasteCategory;
  estimatedWeightRange: string;
  estimatedMinAmount: number;
  estimatedMaxAmount: number;
  addressLine1: string;
  city: string;
  postalCode: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  status: BookingStatus;
  actualWeightKg?: number | null;
  finalAmountLkr?: number | null;
  user?: {
    id?: string;
    fullName?: string | null;
    phone?: string | null;
    email?: string;
  } | null;
  driver?: {
    id: string;
    fullName: string;
    rating: number;
    phone: string;
  } | null;
  createdAt: string;
}

export interface PricingItem {
  id: string;
  minPriceLkrPerKg: number;
  maxPriceLkrPerKg: number;
  isActive: boolean;
  wasteCategory: WasteCategory;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  bookingId?: string | null;
  createdAt: string;
}

export interface RewardsSummary {
  totalPoints: number;
  monthPoints: number;
  monthRange: {
    yearMonth: string;
    start: string;
    end: string;
  };
  howToEarn: Array<{ label: string; value: string }>;
  recentPointsTransactions?: Array<{
    id: string;
    bookingId: string;
    pointsAwarded: number;
    basePoints: number;
    bonusPoints: number;
    multiplier: number;
    awardedAt: string;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  points: number;
}

export interface LeaderboardResponse {
  items: LeaderboardEntry[];
  monthRange?: {
    yearMonth: string;
    start: string;
    end: string;
  };
}
` 

## client/components/shared/status-pill.tsx

`$ext
import {
  CanonicalBookingStatus,
  getBookingStatusLabel,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { BookingStatus, UserRole } from "@/lib/types";
import { cn } from '@/lib/utils';

const statusStyle: Record<CanonicalBookingStatus, { className: string }> = {
  CREATED: { className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400' },
  ASSIGNED: { className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
  IN_PROGRESS: { className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  COLLECTED: { className: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  COMPLETED: { className: 'bg-(--brand)/10 text-(--brand-strong) dark:bg-(--brand)/20 dark:text-(--brand)' },
  CANCELLED: { className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  REFUNDED: { className: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400' },
};

const customerCollectedStyle = {
  className:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function StatusPill({
  status,
  className,
  viewerRole,
}: {
  status: BookingStatus;
  className?: string;
  viewerRole?: UserRole;
}) {
  const normalizedStatus = normalizeBookingStatus(status);
  const isCustomerPaymentDue =
    viewerRole === "CUSTOMER" && normalizedStatus === "COLLECTED";
  const style = isCustomerPaymentDue
    ? customerCollectedStyle
    : (statusStyle[normalizedStatus] ?? {
        className: "bg-gray-100 text-gray-600",
      });
  const label = getBookingStatusLabel(status, viewerRole);
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      style.className,
      className
    )}>
      {label}
    </span>
  );
}
` 

## client/app/admin/bookings/page.tsx

`$ext
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import {
  canAdminAssign,
  canAdminCancel,
  canAdminComplete,
  canAdminRefund,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { BookingStatus } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { SkeletonTableRows } from "@/components/shared/Skeleton";

const STATUS_FILTERS: BookingStatus[] = [
  "CREATED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COLLECTED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

export default function AdminBookingsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "thisMonth">("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: drivers } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: () => apiFetch<any[]>("/admin/drivers"),
    refetchInterval: 15000,
  });

  const driverOptions = useMemo(
    () => (drivers ?? []).filter((driver) => driver.approved !== false),
    [drivers],
  );

  const refreshBookings = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });

  const assignDriverMutation = useMutation({
    mutationFn: ({ bookingId, driverId }: { bookingId: string; driverId: string }) =>
      apiFetch(`/admin/bookings/${bookingId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ driverId }),
      }),
    onMutate: ({ bookingId }) => {
      setAssigningId(bookingId);
    },
    onSuccess: () => {
      toast({ title: "Driver assigned", variant: "success" });
      refreshBookings();
    },
    onError: (err: any) => {
      toast({
        title: "Assign failed",
        description: err?.message ?? "Failed to assign driver.",
        variant: "error",
      });
    },
    onSettled: () => {
      setAssigningId(null);
      refreshBookings();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: BookingStatus }) =>
      apiFetch(`/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: ({ bookingId }) => {
      setStatusUpdatingId(bookingId);
    },
    onSuccess: () => {
      toast({ title: "Booking updated", variant: "success" });
      refreshBookings();
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Failed to update booking.",
        variant: "error",
      });
    },
    onSettled: () => {
      setStatusUpdatingId(null);
      refreshBookings();
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bookings/${id}`, {
        method: "DELETE",
      }),
    onMutate: async (id: string) => {
      setDeletingId(id);
      await queryClient.cancelQueries({ queryKey: ["admin-bookings", status, search, dateFilter] });

      const previous = queryClient.getQueryData<any[]>([
        "admin-bookings",
        status,
        search,
        dateFilter,
      ]);

      if (previous) {
        queryClient.setQueryData(
          ["admin-bookings", status, search, dateFilter],
          previous.filter((b) => b.id !== id),
        );
      }

      return { previous };
    },
    onError: (_err, _id, context: any) => {
      queryClient.setQueryData(
        ["admin-bookings", status, search, dateFilter],
        context?.previous,
      );
      setDeletingId(null);
      toast({ title: "Delete failed", description: "Failed to delete booking.", variant: "error" });
    },
    onSuccess: () => {
      setDeletingId(null);
      toast({ title: "Booking deleted", variant: "success" });
      refreshBookings();
    },
    onSettled: () => {
      setDeletingId(null);
      refreshBookings();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", status, search, dateFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      if (dateFilter === "thisMonth") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        params.append("from", firstDay.toISOString().split("T")[0]);
        params.append("to", lastDay.toISOString().split("T")[0]);
      }

      return apiFetch<any[]>(`/admin/bookings?${params.toString()}`);
    },
    refetchInterval: 12000,
  });

  const handleAssign = (bookingId: string, driverId: string) => {
    if (!driverId) return;
    assignDriverMutation.mutate({ bookingId, driverId });
  };

  const handleStatusChange = (bookingId: string, nextStatus: BookingStatus) => {
    updateStatusMutation.mutate({ bookingId, status: nextStatus });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={dateFilter === "all" && status === "" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setDateFilter("all");
              setStatus("");
            }}
          >
            All Status
          </Button>
          <Button
            variant={dateFilter === "thisMonth" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateFilter("thisMonth")}
          >
            This Month
          </Button>
          {STATUS_FILTERS.map((statusOption) => (
            <Button
              key={statusOption}
              variant={status === statusOption && dateFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(statusOption);
                setDateFilter("all");
              }}
            >
              {statusOption.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search bookings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Card>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={9} rows={6} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((booking) => {
                const normalizedStatus = normalizeBookingStatus(booking.status);
                const canAssignDriver = canAdminAssign(booking.status);
                const canCompleteBooking = canAdminComplete(booking.status);
                const canCancelBooking = canAdminCancel(booking.status);
                const canRefundBooking = canAdminRefund(booking.status);
                const hasCollectionData =
                  booking.actualWeightKg !== null &&
                  booking.actualWeightKg !== undefined &&
                  booking.finalAmountLkr !== null &&
                  booking.finalAmountLkr !== undefined;

                return (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.id.slice(0, 8)}</TableCell>
                    <TableCell>{booking.user?.fullName ?? "--"}</TableCell>
                    <TableCell>{booking.wasteCategory?.name ?? "--"}</TableCell>
                    <TableCell>{booking.actualWeightKg ?? "-"} kg</TableCell>
                    <TableCell>
                      LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div>{booking.driver?.fullName ?? "Unassigned"}</div>
                        <select
                          className="h-9 w-full rounded-md border border-(--border) bg-(--card) px-2 text-sm"
                          value={booking.driver?.id ?? ""}
                          onChange={(event) => handleAssign(booking.id, event.target.value)}
                          disabled={
                            !canAssignDriver ||
                            assigningId === booking.id ||
                            driverOptions.length === 0
                          }
                        >
                          <option value="">Select driver</option>
                          {driverOptions.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.fullName} ({driver.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={booking.status} viewerRole="ADMIN" />
                    </TableCell>
                    <TableCell>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {canCompleteBooking && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(booking.id, "COMPLETED")}
                            disabled={statusUpdatingId === booking.id || !hasCollectionData}
                          >
                            Complete
                          </Button>
                        )}
                        {canCancelBooking && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(booking.id, "CANCELLED")}
                            disabled={statusUpdatingId === booking.id}
                          >
                            Cancel
                          </Button>
                        )}
                        {canRefundBooking && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(booking.id, "REFUNDED")}
                            disabled={statusUpdatingId === booking.id}
                          >
                            Refund
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(booking.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete Booking"
                          disabled={deletingId === booking.id}
                        >
                          {deletingId === booking.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {canCompleteBooking && !hasCollectionData && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Driver must submit weight and amount before completion.
                        </p>
                      )}
                      {!canAssignDriver && normalizedStatus === "ASSIGNED" && (
                        <p className="mt-1 text-xs text-(--muted)">
                          Driver already assigned.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
` 

## client/app/admin/sms/page.tsx

`$ext
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatPhoneForDisplay, normalizeSriLankaPhone } from "@/lib/phone";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { useToast } from "@/components/ui/use-toast";
import type { BookingStatus } from "@/lib/types";
import { MessageSquare, Send, CheckCheck, RefreshCw } from "lucide-react";

interface Booking {
  id: string;
  status: string;
  createdAt: string;
  scheduledDate: string;
  estimatedMaxAmount: number;
  finalAmountLkr: number | null;
  actualWeightKg: number | null;
  user?: { fullName: string; phone: string; email: string };
  wasteCategory?: { name: string };
  driver?: { name: string };
}

export default function AdminSmsPage() {
  const { toast } = useToast();

  // Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "thisMonth" | "thisWeek"
  >("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Selection state
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());

  // Message state
  const [message, setMessage] = useState("");

  // Fetch bookings with filters
  const {
    data: bookings,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "admin-sms-bookings",
      status,
      search,
      dateFilter,
      fromDate,
      toDate,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      if (dateFilter === "thisMonth") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        params.append("from", firstDay.toISOString().split("T")[0]);
        params.append("to", lastDay.toISOString().split("T")[0]);
      } else if (dateFilter === "thisWeek") {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        params.append("from", startOfWeek.toISOString().split("T")[0]);
        params.append("to", endOfWeek.toISOString().split("T")[0]);
      } else if (fromDate || toDate) {
        if (fromDate) params.append("from", fromDate);
        if (toDate) params.append("to", toDate);
      }

      return apiFetch<Booking[]>(`/admin/bookings?${params.toString()}`);
    },
  });

  // Fetch SMS balance
  const { data: balanceData } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: () => apiFetch<any>("/admin/sms/balance"),
  });

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: (payload: { phoneNumbers: string[]; message: string }) =>
      apiFetch<any>("/admin/sms/send", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      if (data.status === "success") {
        toast({
          title: "SMS Sent Successfully!",
          description: `Message sent to ${selectedPhones.size} recipient(s).`,
        });
        setSelectedPhones(new Set());
        setMessage("");
      } else {
        toast({
          title: "SMS Failed",
          description: data.message || "Failed to send SMS.",
          variant: "error",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "error",
      });
    },
  });

  // Get unique phone numbers from bookings
  const uniqueBookingsWithPhones = (bookings ?? []).filter(
    (b) => b.user?.phone,
  );

  const allPhoneNumbers = [
    ...new Set(
      uniqueBookingsWithPhones.map(
        (b) => normalizeSriLankaPhone(b.user!.phone) ?? b.user!.phone,
      ),
    ),
  ];

  const handleSelectAll = () => {
    if (selectedPhones.size === allPhoneNumbers.length) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(allPhoneNumbers));
    }
  };

  const handleTogglePhone = (phone: string) => {
    const next = new Set(selectedPhones);
    if (next.has(phone)) {
      next.delete(phone);
    } else {
      next.add(phone);
    }
    setSelectedPhones(next);
  };

  const handleSendSms = () => {
    if (selectedPhones.size === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one phone number.",
        variant: "error",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: "No message",
        description: "Please type a message to send.",
        variant: "error",
      });
      return;
    }

    sendSmsMutation.mutate({
      phoneNumbers: Array.from(selectedPhones),
      message: message.trim(),
    });
  };

  const statusOptions = [
    "CREATED",
    "ASSIGNED",
    "IN_PROGRESS",
    "COLLECTED",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-(--brand)" />
          <div>
            <h1 className="text-2xl font-bold">SMS Messaging</h1>
            <p className="text-sm text-muted-foreground">
              Send SMS to customers via Text.lk
            </p>
          </div>
        </div>
        {balanceData?.data && (
          <div className="rounded-lg border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">SMS Balance: </span>
            <span className="font-bold text-emerald-600">
              {typeof balanceData.data === "object"
                ? JSON.stringify(
                    balanceData.data.remaining_unit ?? balanceData.data,
                  )
                : balanceData.data}{" "}
              units
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Filter Bookings
        </h3>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={
              status === "" && dateFilter === "all" && !fromDate && !toDate
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() => {
              setStatus("");
              setDateFilter("all");
              setFromDate("");
              setToDate("");
            }}
          >
            All
          </Button>
          {statusOptions.map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(s);
                setDateFilter("all");
              }}
            >
              {s}
            </Button>
          ))}
        </div>

        {/* Date and search filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <Button
              variant={dateFilter === "thisWeek" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilter("thisWeek");
                setFromDate("");
                setToDate("");
              }}
            >
              This Week
            </Button>
            <Button
              variant={dateFilter === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilter("thisMonth");
                setFromDate("");
                setToDate("");
              }}
            >
              This Month
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              className="w-40"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDateFilter("all");
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              className="w-40"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDateFilter("all");
              }}
            />
          </div>

          <Input
            placeholder="Search bookings..."
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Bookings Table with Checkboxes */}
      <Card className="p-0 overflow-hidden">
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      allPhoneNumbers.length > 0 &&
                      selectedPhones.size === allPhoneNumbers.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading bookings...
                  </TableCell>
                </TableRow>
              ) : uniqueBookingsWithPhones.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No bookings found. Adjust your filters.
                  </TableCell>
                </TableRow>
              ) : (
                uniqueBookingsWithPhones.map((booking) => (
                  <TableRow
                    key={booking.id}
                    className={
                      selectedPhones.has(
                        normalizeSriLankaPhone(booking.user!.phone) ?? booking.user!.phone,
                      )
                        ? "bg-emerald-50 dark:bg-emerald-950/20"
                        : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedPhones.has(
                          normalizeSriLankaPhone(booking.user!.phone) ?? booking.user!.phone,
                        )}
                        onCheckedChange={() =>
                          handleTogglePhone(
                            normalizeSriLankaPhone(booking.user!.phone) ?? booking.user!.phone,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.user?.fullName ?? "--"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatPhoneForDisplay(booking.user?.phone)}
                    </TableCell>
                    <TableCell>{booking.wasteCategory?.name ?? "--"}</TableCell>
                    <TableCell>
                      LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={booking.status as BookingStatus}
                        viewerRole="ADMIN"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Compose and Send */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Compose Message</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCheck className="h-4 w-4" />
            <span>{selectedPhones.size} recipient(s) selected</span>
          </div>
        </div>

        {/* Selected phones preview */}
        {selectedPhones.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedPhones).map((phone) => (
              <span
                key={phone}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300"
              >
                {formatPhoneForDisplay(phone)}
                <button
                  onClick={() => handleTogglePhone(phone)}
                  className="ml-1 text-emerald-600 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <Textarea
          placeholder="Type your SMS message here..."
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="resize-none"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {message.length} characters
            {message.length > 160 && (
              <span className="text-amber-600">
                {" "}
                ({Math.ceil(message.length / 160)} SMS parts)
              </span>
            )}
          </p>
          <Button
            onClick={handleSendSms}
            disabled={
              sendSmsMutation.isPending ||
              selectedPhones.size === 0 ||
              !message.trim()
            }
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sendSmsMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS ({selectedPhones.size})
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
` 

## client/app/driver/bookings/page.tsx

`$ext
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  canDriverCancel,
  canDriverCollect,
  canDriverStart,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { Booking, PricingItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { SkeletonTableRows } from "@/components/shared/Skeleton";
import { useToast } from "@/components/ui/use-toast";

export default function DriverBookingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [collectBookingId, setCollectBookingId] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [wasteCategoryId, setWasteCategoryId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["driver-bookings-list"],
    queryFn: () => apiFetch<Booking[]>("/driver/bookings"),
    refetchInterval: 12000,
  });

  const { data: pricing } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
    staleTime: 60000,
  });

  const bookings = data ?? [];
  const selectedBooking = bookings.find((booking) => booking.id === collectBookingId) ?? null;

  useEffect(() => {
    if (!selectedBooking) return;
    setWeightKg(
      selectedBooking.actualWeightKg !== null && selectedBooking.actualWeightKg !== undefined
        ? String(selectedBooking.actualWeightKg)
        : "",
    );
    setWasteCategoryId(selectedBooking.wasteCategory?.id ?? "");
  }, [selectedBooking]);

  const pricingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of pricing ?? []) {
      const rate = (item.minPriceLkrPerKg + item.maxPriceLkrPerKg) / 2;
      map.set(item.wasteCategory.id, rate);
    }
    return map;
  }, [pricing]);

  const selectedCategoryId = wasteCategoryId || selectedBooking?.wasteCategory?.id || "";
  const numericWeight = Number(weightKg);
  const computedAmount =
    Number.isFinite(numericWeight) &&
    numericWeight > 0 &&
    selectedCategoryId &&
    pricingByCategory.has(selectedCategoryId)
      ? numericWeight * (pricingByCategory.get(selectedCategoryId) ?? 0)
      : null;

  const refreshBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["driver-bookings-list"] });
    queryClient.invalidateQueries({ queryKey: ["driver-bookings"] });
  };

  const startMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch(`/driver/bookings/${bookingId}/start`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      toast({ title: "Pickup started", variant: "success" });
      refreshBookings();
    },
    onError: (err: any) => {
      toast({
        title: "Could not start pickup",
        description: err?.message ?? "Please try again.",
        variant: "error",
      });
    },
  });

  const collectMutation = useMutation({
    mutationFn: ({
      bookingId,
      payload,
    }: {
      bookingId: string;
      payload: { weightKg: number; wasteCategoryId?: string };
    }) =>
      apiFetch(`/driver/bookings/${bookingId}/collect`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "Booking collected", variant: "success" });
      setCollectBookingId(null);
      refreshBookings();
    },
    onError: (err: any) => {
      toast({
        title: "Could not mark as collected",
        description: err?.message ?? "Please try again.",
        variant: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch(`/driver/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast({ title: "Booking cancelled", variant: "success" });
      refreshBookings();
    },
    onError: (err: any) => {
      toast({
        title: "Could not cancel",
        description: err?.message ?? "Please try again.",
        variant: "error",
      });
    },
  });

  const submitCollect = () => {
    if (!selectedBooking) return;
    const parsedWeight = Number(weightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast({
        title: "Invalid weight",
        description: "Enter a valid weight in kg.",
        variant: "error",
      });
      return;
    }

    const payload: { weightKg: number; wasteCategoryId?: string } = {
      weightKg: parsedWeight,
    };

    if (wasteCategoryId && wasteCategoryId !== selectedBooking.wasteCategory?.id) {
      payload.wasteCategoryId = wasteCategoryId;
    }

    collectMutation.mutate({ bookingId: selectedBooking.id, payload });
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={7} rows={5} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Pickup Date/Time</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const normalizedStatus = normalizeBookingStatus(booking.status);
                const loading =
                  startMutation.isPending ||
                  collectMutation.isPending ||
                  cancelMutation.isPending;

                return (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.id.slice(0, 8)}</TableCell>
                    <TableCell>{booking.user?.fullName ?? "Customer"}</TableCell>
                    <TableCell>{booking.addressLine1}</TableCell>
                    <TableCell>
                      <div>{new Date(booking.scheduledDate).toLocaleDateString()}</div>
                      <div className="text-xs text-(--muted)">{booking.scheduledTimeSlot}</div>
                    </TableCell>
                    <TableCell>{booking.wasteCategory?.name ?? "--"}</TableCell>
                    <TableCell>
                      <StatusPill status={booking.status} viewerRole="DRIVER" />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => startMutation.mutate(booking.id)}
                          disabled={!canDriverStart(booking.status) || loading}
                        >
                          Start Pickup
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCollectBookingId(booking.id)}
                          disabled={!canDriverCollect(booking.status) || loading}
                        >
                          {normalizedStatus === "COLLECTED" ? "Collected / Edit" : "Collected"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelMutation.mutate(booking.id)}
                          disabled={!canDriverCancel(booking.status) || loading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!bookings.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-(--muted)">
                    No bookings assigned.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={Boolean(collectBookingId)} onOpenChange={(open) => !open && setCollectBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collected Pickup</DialogTitle>
            <DialogDescription>
              Enter weight, confirm waste type, and review the computed amount.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-(--muted)">Booking</p>
              <p className="text-sm font-medium">{selectedBooking?.id.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-xs text-(--muted)">Waste Type</p>
              <select
                className="mt-1 h-10 w-full rounded-md border border-(--border) bg-(--card) px-3 text-sm"
                value={wasteCategoryId}
                onChange={(event) => setWasteCategoryId(event.target.value)}
              >
                {(pricing ?? []).map((item) => (
                  <option key={item.wasteCategory.id} value={item.wasteCategory.id}>
                    {item.wasteCategory.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-(--muted)">Weight (kg)</p>
              <Input
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                placeholder="e.g. 12.5"
              />
            </div>
            <div className="rounded-md border border-(--border) bg-(--surface-soft) p-3 text-sm">
              <p className="text-xs text-(--muted)">Computed Amount</p>
              <p className="font-semibold">
                {computedAmount === null ? "LKR --" : `LKR ${computedAmount.toFixed(2)}`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectBookingId(null)}
              disabled={collectMutation.isPending}
            >
              Close
            </Button>
            <Button onClick={submitCollect} disabled={collectMutation.isPending}>
              {collectMutation.isPending ? "Saving..." : "Confirm Collected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
` 

## client/app/driver/bookings/[id]/page.tsx

`$ext
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  canDriverCancel,
  canDriverCollect,
  canDriverStart,
} from "@/lib/booking-status";
import { Booking, PricingItem, WasteCategory } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import Loading from "@/components/shared/Loading";
import { useToast } from "@/components/ui/use-toast";

export default function DriverBookingDetailPage() {
  const params = useParams();
  const bookingId = typeof params?.id === "string" ? params.id : "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: booking, isLoading } = useQuery({
    queryKey: ["driver-booking", bookingId],
    queryFn: () => apiFetch<Booking>(`/driver/bookings/${bookingId}`),
    enabled: Boolean(bookingId),
    refetchInterval: 12000,
  });

  const { data: categories } = useQuery({
    queryKey: ["waste-categories"],
    queryFn: () => apiFetch<WasteCategory[]>("/public/waste-categories", {}, false),
  });

  const { data: pricing } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
    staleTime: 60000,
  });

  const [weightKg, setWeightKg] = useState("");
  const [wasteCategoryId, setWasteCategoryId] = useState("");

  useEffect(() => {
    if (!booking) return;
    setWeightKg(
      booking.actualWeightKg !== null && booking.actualWeightKg !== undefined
        ? String(booking.actualWeightKg)
        : "",
    );
    setWasteCategoryId(booking.wasteCategory?.id ?? "");
  }, [booking]);

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["driver-booking", bookingId] });
    queryClient.invalidateQueries({ queryKey: ["driver-bookings-list"] });
    queryClient.invalidateQueries({ queryKey: ["driver-bookings"] });
  };

  const startMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/driver/bookings/${bookingId}/start`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      toast({ title: "Pickup started", variant: "success" });
      refreshData();
    },
    onError: (err: any) => {
      toast({
        title: "Could not start pickup",
        description: err?.message ?? "Please try again.",
        variant: "error",
      });
    },
  });

  const collectMutation = useMutation({
    mutationFn: (payload: { weightKg: number; wasteCategoryId?: string }) =>
      apiFetch(`/driver/bookings/${bookingId}/collect`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "Booking collected", variant: "success" });
      refreshData();
    },
    onError: (err: any) => {
      toast({
        title: "Could not collect booking",
        description: err?.message ?? "Please try again.",
        variant: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/driver/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast({ title: "Booking cancelled", variant: "success" });
      refreshData();
    },
    onError: (err: any) => {
      toast({
        title: "Could not cancel booking",
        description: err?.message ?? "Please try again.",
        variant: "error",
      });
    },
  });

  const categoryOptions = useMemo(() => categories ?? [], [categories]);

  const rateByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of pricing ?? []) {
      map.set(
        item.wasteCategory.id,
        (item.minPriceLkrPerKg + item.maxPriceLkrPerKg) / 2,
      );
    }
    return map;
  }, [pricing]);

  const selectedCategoryId = wasteCategoryId || booking?.wasteCategory?.id || "";
  const numericWeight = Number(weightKg);
  const computedAmount =
    Number.isFinite(numericWeight) &&
    numericWeight > 0 &&
    selectedCategoryId &&
    rateByCategory.has(selectedCategoryId)
      ? numericWeight * (rateByCategory.get(selectedCategoryId) ?? 0)
      : null;

  const handleCollect = () => {
    const parsedWeight = Number(weightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast({
        title: "Invalid weight",
        description: "Enter a valid weight in kg.",
        variant: "error",
      });
      return;
    }

    const payload: { weightKg: number; wasteCategoryId?: string } = {
      weightKg: parsedWeight,
    };

    if (booking && wasteCategoryId && wasteCategoryId !== booking.wasteCategory?.id) {
      payload.wasteCategoryId = wasteCategoryId;
    }

    collectMutation.mutate(payload);
  };

  if (isLoading || !booking) {
    return (
      <Card className="p-6">
        <Loading message="Loading booking details..." />
      </Card>
    );
  }

  const isBusy =
    startMutation.isPending || collectMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-(--muted)">Booking</p>
          <h1 className="text-2xl font-semibold">{booking.id.slice(0, 8)}</h1>
        </div>
        <StatusPill status={booking.status} viewerRole="DRIVER" />
      </div>

      <Card className="p-4 space-y-2">
        <div className="text-sm text-(--muted)">Customer</div>
        <div className="text-base font-medium">{booking.user?.fullName ?? "Customer"}</div>
        <div className="text-sm text-(--muted)">Address</div>
        <div className="text-base">{booking.addressLine1}</div>
        <div className="text-sm text-(--muted)">Pickup Date/Time</div>
        <div className="text-base">
          {new Date(booking.scheduledDate).toLocaleDateString()} ({booking.scheduledTimeSlot})
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs text-(--muted)">Waste category</label>
            <select
              className="h-11 w-full rounded-xl border border-(--border) bg-(--card) px-3 text-sm"
              value={wasteCategoryId}
              onChange={(event) => setWasteCategoryId(event.target.value)}
            >
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-(--muted)">Weight (kg)</label>
            <Input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 12.5"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-(--muted)">Computed amount</label>
            <div className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm flex items-center">
              {computedAmount === null ? "LKR --" : `LKR ${computedAmount.toFixed(2)}`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => startMutation.mutate()}
            disabled={!canDriverStart(booking.status) || isBusy}
          >
            Start Pickup
          </Button>
          <Button
            variant="outline"
            onClick={handleCollect}
            disabled={!canDriverCollect(booking.status) || isBusy}
          >
            {collectMutation.isPending ? "Saving..." : "Collected / Edit"}
          </Button>
          <Button
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={!canDriverCancel(booking.status) || isBusy}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
` 

## client/app/driver/dashboard/page.tsx

`$ext
"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { normalizeBookingStatus } from "@/lib/booking-status";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import Loading from "@/components/shared/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";

export default function DriverDashboardPage() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["driver-bookings"],
    queryFn: () => apiFetch<any[]>("/driver/bookings"),
    refetchInterval: 12000,
  });

  const bookings = data ?? [];

  const stats = useMemo(() => {
    const assigned = bookings.length;
    const scheduled = bookings.filter((b) =>
      ["CREATED", "ASSIGNED"].includes(normalizeBookingStatus(b.status)),
    ).length;
    const onPickup = bookings.filter((b) =>
      ["IN_PROGRESS", "COLLECTED"].includes(normalizeBookingStatus(b.status)),
    ).length;
    const completed = bookings.filter(
      (b) => normalizeBookingStatus(b.status) === "COMPLETED",
    ).length;
    return { assigned, scheduled, onPickup, completed };
  }, [bookings]);

  const statusMutation = useMutation({
    mutationFn: (nextStatus: "ONLINE" | "OFFLINE") =>
      apiFetch("/driver/status", {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }),
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
  });

  const currentStatus = user?.driverStatus ?? "OFFLINE";
  const isOnPickup = currentStatus === "ON_PICKUP";
  const nextStatus = currentStatus === "ONLINE" ? "OFFLINE" : "ONLINE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-(--muted)">Driver status</p>
          <p className="text-lg font-semibold">{currentStatus}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => statusMutation.mutate(nextStatus)}
          disabled={statusMutation.isPending || isOnPickup}
        >
          {currentStatus === "ONLINE" ? "Go offline" : "Go online"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Assigned" value={`${stats.assigned}`} />
        <KpiCard label="Scheduled" value={`${stats.scheduled}`} />
        <KpiCard label="On Pickup" value={`${stats.onPickup}`} />
        <KpiCard label="Completed" value={`${stats.completed}`} />
      </div>

      {isLoading ? (
        <Card className="p-6">
          <Loading message="Loading dashboard..." />
        </Card>
      ) : (
        <Card>
          <div className="mt-2 overflow-x-auto -mx-6 sm:mx-0">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.id.slice(0, 8)}</TableCell>
                    <TableCell>{b.addressLine1}</TableCell>
                    <TableCell>{b.actualWeightKg ?? "-"} kg</TableCell>
                    <TableCell>
                      <StatusPill status={b.status} viewerRole="DRIVER" />
                    </TableCell>
                    <TableCell>
                      {new Date(
                        b.scheduledDate || b.createdAt,
                      ).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!bookings.length && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-(--muted)"
                    >
                      No assigned pickups.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
` 

## client/app/users/bookings/page.tsx

`$ext
"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Booking, WasteCategory } from "@/lib/types";
import {
  getBookingStatusLabel,
  isUserPaymentDueStatus,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { Card } from "@/components/ui/card";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";

export default function BookingHistoryPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["public-waste-categories"],
    queryFn: () => apiFetch<WasteCategory[]>("/public/waste-categories", {}, false),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", status, search, category],
    queryFn: () =>
      apiFetch<{ items: Booking[] }>(
        `/bookings?${new URLSearchParams({
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(category ? { category } : {}),
        }).toString()}`,
      ),
    refetchInterval: 12000,
  });

  const bookings = data?.items ?? [];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bookings/${id}`, {
        method: "DELETE",
      }),
    onMutate: async (id: string) => {
      setDeletingId(id);
      await queryClient.cancelQueries({ queryKey: ["bookings", status, search, category] });
      const previous = queryClient.getQueryData<{ items: Booking[] }>(["bookings", status, search, category]);
      if (previous) {
        queryClient.setQueryData(["bookings", status, search, category], {
          ...previous,
          items: previous.items.filter((b) => b.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      queryClient.setQueryData(["bookings", status, search, category], context?.previous);
      setDeletingId(null);
      toast({ title: "Delete failed", description: "Failed to delete booking.", variant: "error" });
    },
    onSettled: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onSuccess: () => {
      toast({ title: "Booking deleted", variant: "success" });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(id);
    }
  };

  const metrics = useMemo(() => {
    const completed = bookings.filter(
      (b) => normalizeBookingStatus(b.status) === "COMPLETED",
    ).length;
    const totalEarned = bookings.reduce(
      (sum, b) => sum + (b.finalAmountLkr ?? 0),
      0,
    );
    const totalWeight = bookings.reduce(
      (sum, b) => sum + (b.actualWeightKg ?? 0),
      0,
    );
    return { total: bookings.length, completed, totalEarned, totalWeight };
  }, [bookings]);

  const exportCsv = () => {
    const rows = bookings.map((booking) => [
      booking.id,
      booking.wasteCategory?.name ?? "",
      booking.actualWeightKg ?? "",
      booking.finalAmountLkr ?? booking.estimatedMaxAmount,
      getBookingStatusLabel(booking.status, "CUSTOMER"),
      booking.createdAt,
    ]);
    const header = [
      "Booking ID",
      "Waste Type",
      "Weight",
      "Amount",
      "Status",
      "Date",
    ];
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booking-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)">
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)"
            disabled={categoriesLoading}
          >
            {categoriesLoading ? (
              <option>Loading categories...</option>
            ) : (
              <>
                <option value="">All Categories</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="min-w-45"
            placeholder="Search bookings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Total Bookings" value={`${metrics.total}`} />
        <KpiCard label="Completed" value={`${metrics.completed}`} />
        <KpiCard
          label="Total Earned"
          value={`LKR ${metrics.totalEarned.toFixed(0)}`}
        />
        <KpiCard
          label="Total Weight"
          value={`${metrics.totalWeight.toFixed(1)} kg`}
        />
      </div>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={7} rows={6} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-180">
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <a
                      href={`/users/bookings/${booking.id}`}
                      className="text-(--brand) hover:underline"
                    >
                      {booking.id.slice(0, 8)}
                    </a>
                  </TableCell>
                  <TableCell>
                    {booking.wasteCategory?.name ?? "Unknown"}
                  </TableCell>
                  <TableCell>{booking.actualWeightKg ?? "-"} kg</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>
                        LKR{" "}
                        {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                      </div>
                      {isUserPaymentDueStatus(booking.status) &&
                        booking.finalAmountLkr !== null &&
                        booking.finalAmountLkr !== undefined && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            Please pay LKR {booking.finalAmountLkr.toFixed(2)} to
                            driver.
                          </div>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={booking.status} viewerRole="CUSTOMER" />
                  </TableCell>
                  <TableCell>
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {normalizeBookingStatus(booking.status) === "CREATED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(booking.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete Booking"
                        disabled={deletingId === booking.id}
                      >
                        {deletingId === booking.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!bookings.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-(--muted)"
                  >
                    No bookings found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm text-(--muted)">
            <span>Page 1 of 1</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Prev
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
` 

## client/app/users/bookings/[id]/page.tsx

`$ext
"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { apiFetch } from "@/lib/api";
import { Booking } from "@/lib/types";
import {
  isUserPaymentDueStatus,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Loading from "@/components/shared/Loading";
import { StatusPill } from "@/components/shared/status-pill";
import { Phone, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const mapContainerStyle = {
  height: "100%",
  width: "100%",
};

const defaultCenter = {
  lat: 6.9271, // Colombo, Sri Lanka as default
  lng: 79.8612,
};

export default function BookingDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => apiFetch<Booking>(`/bookings/${id}`),
    enabled: Boolean(id),
    refetchInterval: 12000,
  });

  const booking = data;

  // State for map marker position
  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const { toast } = useToast();

  // Mutation to save location
  const saveLocationMutation = useMutation({
    mutationFn: (location: { lng: number; lat: number }) =>
      apiFetch(`/bookings/${id}/location`, {
        method: "POST",
        body: JSON.stringify(location),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      toast({ title: "Location saved", variant: "success" });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Failed to save location. Please try again.", variant: "error" });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/bookings/${id}`, {
        method: "DELETE",
      }),
    onMutate: async () => {
      // optimistic removal from bookings list cache
      await queryClient.cancelQueries({ queryKey: ["bookings"] });
      const previous = queryClient.getQueryData<{ items: Booking[] }>(["bookings"]);
      if (previous) {
        queryClient.setQueryData(["bookings"], {
          ...previous,
          items: previous.items.filter((b) => b.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(["bookings"], context?.previous);
      toast({ title: "Delete failed", description: "Failed to delete booking.", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Booking deleted", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      window.location.href = "/users/bookings";
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  if (isLoading) {
    return (
      <div className="py-8">
        <Loading message="Loading booking details..." />
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate();
    }
  };

  // Handle map click to place marker
  const handleMapClick = (event: any) => {
    // event may be a React mouse event or a Google MapMouseEvent depending on context
    const latLng = event?.latLng ?? event?.nativeEvent?.latLng;
    if (latLng) {
      const lat = latLng.lat();
      const lng = latLng.lng();
      setMarkerPosition({ lat, lng });
    }
  };

  // Handle save location
  const handleSaveLocation = () => {
    saveLocationMutation.mutate(markerPosition);
  };

  const normalizedStatus = booking
    ? normalizeBookingStatus(booking.status)
    : "CREATED";
  const canDelete = normalizedStatus === "CREATED";
  const isPaymentDue = Boolean(
    booking &&
      isUserPaymentDueStatus(booking.status) &&
      booking.finalAmountLkr !== null &&
      booking.finalAmountLkr !== undefined,
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">
              Booking Tracking
            </p>
            <h2 className="text-2xl font-semibold">
              Booking {booking?.id?.slice(0, 8) ?? ""}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {booking && (
              <StatusPill status={booking.status} viewerRole="CUSTOMER" />
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={deleteBookingMutation.isPending}
              >
                {deleteBookingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3">
            <p className="text-xs text-(--muted)">Waste Type</p>
            <p className="text-sm font-semibold">
              {booking?.wasteCategory?.name ?? "Unknown"}
            </p>
          </div>
          <div className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3">
            <p className="text-xs text-(--muted)">Scheduled Pickup</p>
            <p className="text-sm font-semibold">
              {booking
                ? new Date(booking.scheduledDate).toLocaleString()
                : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3">
            <p className="text-xs text-(--muted)">Collected Details</p>
            <p className="text-sm font-semibold">
              {booking?.actualWeightKg ?? "-"} kg
            </p>
            <p className="text-xs text-(--muted)">
              Amount: LKR {booking?.finalAmountLkr ?? booking?.estimatedMaxAmount}
            </p>
          </div>
        </div>
        {isPaymentDue && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            Please pay LKR {booking?.finalAmountLkr?.toFixed(2)} to the driver.
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Driver Info</h3>
          <div className="space-y-2">
            <p className="text-sm">
              {booking?.driver?.fullName ?? "Assigned soon"}
            </p>
            <p className="text-xs text-(--muted)">
              Rating: {booking?.driver?.rating ?? "4.7"} ?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4" />
                Call
              </Button>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </div>
          </div>
        </Card>
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Live Tracking Map</h3>
          <div className="h-48 rounded-xl border border-(--border) overflow-hidden">
            {!apiKey ? (
              <div className="flex items-center justify-center h-full text-sm text-red-500">
                Google Maps API key is not configured
              </div>
            ) : loadError ? (
              <div className="flex items-center justify-center h-full text-sm text-(--muted)">
                Error loading map
              </div>
            ) : !isLoaded ? (
              <div className="flex items-center justify-center h-full text-sm text-(--muted)">
                Loading map...
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={defaultCenter}
                zoom={10}
                onClick={handleMapClick}
              >
                <Marker position={markerPosition} />
              </GoogleMap>
            )}
          </div>
          <Button onClick={handleSaveLocation} disabled={saveLocationMutation.isPending}>
            {saveLocationMutation.isPending ? "Saving..." : "Save Location"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
` 

## client/app/users/dashboard/page.tsx

`$ext
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking, RewardsSummary } from "@/lib/types";
import { normalizeBookingStatus } from "@/lib/booking-status";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bookings", "recent"],
    queryFn: () => apiFetch<{ items: Booking[] }>("/bookings"),
  });
  const { data: rewards } = useQuery({
    queryKey: ["rewards", "me"],
    queryFn: () => apiFetch<RewardsSummary>("/rewards/me"),
  });

  const bookings = data?.items ?? [];

  const metrics = useMemo(() => {
    const totalEarned = bookings.reduce(
      (sum, booking) => sum + (booking.finalAmountLkr ?? 0),
      0,
    );
    const totalWeight = bookings.reduce(
      (sum, booking) => sum + (booking.actualWeightKg ?? 0),
      0,
    );
    const pending = bookings.filter((booking) =>
      ["CREATED", "ASSIGNED", "IN_PROGRESS"].includes(
        normalizeBookingStatus(booking.status),
      ),
    ).length;
    const co2 = Math.round(totalWeight * 1.7);
    return { totalEarned, totalWeight, pending, co2 };
  }, [bookings]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <p className="text-xs sm:text-sm text-(--muted)">Dashboard</p>
        <h1 className="text-xl sm:text-2xl font-semibold">
          Welcome back, {user?.fullName?.split(" ")[0] ?? "User"}!
        </h1>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Earned"
          value={`LKR ${metrics.totalEarned.toFixed(0)}`}
          helper="Lifetime earnings"
        />
        <KpiCard
          label="Total Waste"
          value={`${metrics.totalWeight.toFixed(1)} kg`}
          helper="Collected to date"
        />
        <KpiCard
          label="Reward Points"
          value={`${rewards?.totalPoints ?? 0}`}
          helper="Lifetime points"
        />
        <KpiCard
          label="Pending Pickups"
          value={`${metrics.pending}`}
          helper="Scheduled"
        />
        <KpiCard
          label="CO? Saved"
          value={`${metrics.co2} kg`}
          helper="Estimated"
        />
      </div>

      <Card className="flex flex-col justify-between gap-3 sm:gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-semibold">
            Ready for another pickup?
          </h3>
          <p className="text-xs sm:text-sm text-(--muted)">
            Book your next collection and earn more.
          </p>
        </div>
        <Button className="w-full sm:w-auto shrink-0" asChild>
          <Link href="/users/bookings/new">+ Book New Pickup</Link>
        </Button>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h3 className="text-base sm:text-lg font-semibold">
            Recent Bookings
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            asChild
          >
            <Link href="/users/bookings">View all</Link>
          </Button>
        </div>
        <div className="mt-3 sm:mt-4 overflow-x-auto -mx-6 sm:mx-0">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTableRows columns={6} rows={5} />
            </div>
          ) : (
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Waste Type</TableHead>
                  {/* <TableHead>Weight</TableHead> */}
                  {/* <TableHead>Amount</TableHead> */}
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.slice(0, 5).map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <Link
                        href={`/users/bookings/${booking.id}`}
                        className="text-(--brand)"
                      >
                        {booking.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {booking.wasteCategory?.name ?? "Unknown"}
                    </TableCell>
                    {/* <TableCell>{booking.actualWeightKg ?? "-"} kg</TableCell> */}
                    {/* <TableCell>
                      LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                    </TableCell> */}
                    <TableCell>
                      <StatusPill status={booking.status} viewerRole="CUSTOMER" />
                    </TableCell>
                    <TableCell>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!bookings.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-(--muted)"
                    >
                      No bookings yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
` 

## client/app/users/notifications/page.tsx

`$ext
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

  const handleClick = (item: NotificationItem) => {
    if (item.bookingId) {
      router.push(`/users/bookings/${item.bookingId}`);
    }
  };

  return (
    <div className="notifications-page space-y-6">
      <div className="flex items-center justify-between">
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
                  ? "border-l-4 border-l-green-500 bg-(--card)/80"
                  : "opacity-75"
              } ${item.bookingId ? "cursor-pointer hover:shadow-md" : ""}`}
              onClick={() => handleClick(item)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {levelIcon[item.level]}
                  <h3 className="text-lg font-semibold">{item.title}</h3>
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
` 

## server/prisma/schema.prisma

`$ext
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────────────────────────
// Auth identity table (lightweight – no profile data)
// Passwords handled by Supabase Auth; passwordHash nullable
// ─────────────────────────────────────────────
model User {
  id                 String              @id @default(uuid())
  email              String              @unique
  passwordHash       String?
  refreshTokenHash   String?
  role               Role                @default(CUSTOMER)
  createdAt          DateTime            @default(now())
  totalPoints        Int                 @default(0)

  customer           Customer?
  admin              Admin?
  driver             Driver?
  bookings           Booking[]
  notifications      Notification[]
  pushSubscriptions  PushSubscription[]
  passkeyCredentials PasskeyCredential[]
  userPermissions    UserPermission[]
  recycler           Recycler?
  corporate          Corporate?
  pointsTransactions PointsTransaction[]
}

model Recycler {
  id              String   @id
  companyName     String
  contactPerson   String
  phone           String
  materialTypes   String   // Stored as comma-separated or JSON string for now
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [id], references: [id], onDelete: Cascade)
}

model Corporate {
  id              String   @id
  organizationName String
  contactName     String
  phone           String
  requirements    String?
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [id], references: [id], onDelete: Cascade)
}

// ─────────────────────────────────────────────
// Passkey / WebAuthn credentials (1 : N with User)
// ─────────────────────────────────────────────
model PasskeyCredential {
  id                  String   @id @default(uuid())
  userId              String
  credentialId        String   @unique
  credentialPublicKey Bytes
  counter             BigInt   @default(0)
  transports          String[] @default([])
  deviceName          String   @default("Passkey")
  createdAt           DateTime @default(now())

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ─────────────────────────────────────────────
// Role-specific profile tables (1 : 1 with User)
// ─────────────────────────────────────────────
model Customer {
  id        String         @id
  fullName  String
  phone     String
  address   String?
  avatarUrl String?
  type      CustomerType   @default(HOUSEHOLD)
  status    CustomerStatus @default(ACTIVE)
  createdAt DateTime       @default(now())

  user User @relation(fields: [id], references: [id], onDelete: Cascade)
}

model Admin {
  id       String  @id
  fullName String
  phone    String
  address  String?
  avatarUrl String?
  approved Boolean @default(false)

  user User @relation(fields: [id], references: [id], onDelete: Cascade)
}

model Driver {
  id          String       @id
  fullName    String
  phone       String
  rating      Float        @default(0)
  pickupCount Int          @default(0)
  vehicle     String
  status      DriverStatus @default(OFFLINE)
  avatarUrl   String?
  approved    Boolean      @default(false)
  createdAt   DateTime     @default(now())

  user     User      @relation(fields: [id], references: [id], onDelete: Cascade)
  bookings Booking[]
}

// ─────────────────────────────────────────────
// RBAC Permission tables
// ─────────────────────────────────────────────
model Permission {
  id    String           @id @default(uuid())
  name  String           @unique
  users UserPermission[]
}

model UserPermission {
  userId       String
  permissionId String

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([userId, permissionId])
}

// ─────────────────────────────────────────────
// Role change audit log (used by rollback functions)
// ─────────────────────────────────────────────
model RoleChangeLog {
  id             String   @id @default(uuid())
  userId         String
  oldRole        String
  newRole        String
  oldProfileData Json?
  changedAt      DateTime @default(now())
}

// ─────────────────────────────────────────────
// Domain tables
// ─────────────────────────────────────────────
model WasteCategory {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  isActive    Boolean   @default(true)
  bookings    Booking[]
  pricing     Pricing?
}

model Pricing {
  id               String        @id @default(uuid())
  wasteCategoryId  String        @unique
  minPriceLkrPerKg Float
  maxPriceLkrPerKg Float
  updatedAt        DateTime      @updatedAt
  isActive         Boolean       @default(true)
  wasteCategory    WasteCategory @relation(fields: [wasteCategoryId], references: [id])
}

model Booking {
  id                   String               @id @default(uuid())
  userId               String
  wasteCategoryId      String
  estimatedWeightRange String
  estimatedMinAmount   Float
  estimatedMaxAmount   Float
  addressLine1         String
  city                 String
  postalCode           String
  specialInstructions  String?
  scheduledDate        DateTime
  scheduledTimeSlot    String
  lat                  Float?
  lng                  Float?
  actualWeightKg       Float?
  finalAmountLkr       Float?
  confirmedAt          DateTime?
  driverId             String?
  createdAt            DateTime             @default(now())
  status               BookingStatus        @default(CREATED)
  driver               Driver?              @relation(fields: [driverId], references: [id])
  user                 User                 @relation(fields: [userId], references: [id])
  wasteCategory        WasteCategory        @relation(fields: [wasteCategoryId], references: [id])
  transactions         PaymentTransaction[]
  pointsTransaction    PointsTransaction?
  statusHistory        BookingStatusHistory[]
}

model BookingStatusHistory {
  id            String        @id @default(uuid())
  bookingId     String
  fromStatus    BookingStatus
  toStatus      BookingStatus
  changedById   String
  changedByRole Role
  createdAt     DateTime      @default(now())

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([bookingId, createdAt])
}

model Notification {
  id        String            @id @default(uuid())
  userId    String?
  bookingId String?
  title     String
  message   String
  isRead    Boolean           @default(false)
  level     NotificationLevel @default(INFO)
  createdAt DateTime          @default(now())
  user      User?             @relation(fields: [userId], references: [id])
}

model PaymentTransaction {
  id        String        @id @default(uuid())
  bookingId String
  amountLkr Float
  createdAt DateTime      @default(now())
  method    PaymentMethod
  status    PaymentStatus @default(PROCESSED)
  booking   Booking       @relation(fields: [bookingId], references: [id])
}

model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PointsTransaction {
  id            String   @id @default(uuid())
  userId        String
  bookingId     String   @unique
  pointsAwarded Int
  basePoints    Int
  bonusPoints   Int
  multiplier    Float
  reason        Json?
  awardedAt     DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([userId, awardedAt])
  @@index([awardedAt])
}

model LaunchNotify {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
}

// Application configuration (key/value) – used to store deploy-time settings such as storage bucket
model AppConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
}

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────
enum Role {
  CUSTOMER
  ADMIN
  SUPER_ADMIN
  DRIVER
  RECYCLER
  CORPORATE
}

enum DriverStatus {
  ONLINE
  OFFLINE
  ON_PICKUP
}

enum BookingStatus {
  CREATED
  SCHEDULED
  ASSIGNED
  IN_PROGRESS
  COLLECTED
  PAID
  COMPLETED
  CANCELLED
  REFUNDED
}

enum NotificationLevel {
  INFO
  SUCCESS
  WARNING
  ERROR
}

enum PaymentMethod {
  MOBILE_WALLET
  BANK
}

enum PaymentStatus {
  PROCESSED
  FAILED
}

enum CustomerStatus {
  ACTIVE
  INACTIVE
}

enum CustomerType {
  HOUSEHOLD
  BUSINESS
}
` 

## server/prisma/seed.ts

`$ext
import {
  PrismaClient,
  BookingStatus,
  CustomerStatus,
  CustomerType,
  DriverStatus,
  NotificationLevel,
  PaymentMethod,
  PaymentStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
// Supabase integration removed from seeds

const prisma = new PrismaClient();

// Supabase syncing removed from seed script to avoid relying on external credentials

async function main() {
  // Delete in reverse-dependency order
  await prisma.paymentTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.passkeyCredential.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.roleChangeLog.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.launchNotify.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Create admin user + admin profile
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@trash2cash.lk',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  await prisma.admin.create({
    data: {
      id: adminUser.id,
      fullName: 'Admin Team',
      phone: '+94 77 000 0000',
      address: 'Trash2Cash HQ, Colombo',
      approved: true,
    },
  });

  // Create customer user: Rajesh
  const rajeshUser = await prisma.user.create({
    data: {
      email: 'rajesh@trash2cash.lk',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });
  await prisma.customer.create({
    data: {
      id: rajeshUser.id,
      fullName: 'Rajesh Perera',
      phone: '+94 77 111 2222',
      type: CustomerType.HOUSEHOLD,
      status: CustomerStatus.ACTIVE,
      address: '45 Galle Road, Colombo 03',
    },
  });

  // Create customer user: Samantha
  const samanthaUser = await prisma.user.create({
    data: {
      email: 'samantha@trash2cash.lk',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });
  await prisma.customer.create({
    data: {
      id: samanthaUser.id,
      fullName: 'Samantha Silva',
      phone: '+94 77 333 4444',
      type: CustomerType.BUSINESS,
      status: CustomerStatus.ACTIVE,
      address: 'Industrial Park, Negombo',
    },
  });

  // Create driver users + driver profiles (1:1 with User)
  const driverData = [
    {
      email: 'sunil@trash2cash.lk',
      fullName: 'Sunil Jayasinghe',
      phone: '+94 77 555 0101',
      rating: 4.8,
      pickupCount: 128,
      vehicle: 'Truck',
      status: DriverStatus.ON_PICKUP,
    },
    {
      email: 'nimali@trash2cash.lk',
      fullName: 'Nimali Fernando',
      phone: '+94 77 555 0202',
      rating: 4.6,
      pickupCount: 94,
      vehicle: 'Van',
      status: DriverStatus.ONLINE,
    },
    {
      email: 'kasun@trash2cash.lk',
      fullName: 'Kasun Abeysekera',
      phone: '+94 77 555 0303',
      rating: 4.4,
      pickupCount: 64,
      vehicle: 'Three-wheeler',
      status: DriverStatus.OFFLINE,
    },
  ];

  const drivers: any[] = [];
  for (const dd of driverData) {
    const driverUser = await prisma.user.create({
      data: {
        email: dd.email,
        passwordHash,
        role: Role.DRIVER,
      },
    });
    const driver = await prisma.driver.create({
      data: {
        id: driverUser.id,
        fullName: dd.fullName,
        phone: dd.phone,
        rating: dd.rating,
        pickupCount: dd.pickupCount,
        vehicle: dd.vehicle,
        status: dd.status,
      },
    });
    drivers.push(driver);
  }

  // Upsert (create if missing) the known categories so seed is idempotent
  const categoryDefs = [
    { name: 'Plastic', description: 'PET bottles, HDPE, mixed plastics' },
    { name: 'Paper', description: 'Cardboard and paper packaging' },
    { name: 'Metal', description: 'Aluminum cans and scrap metal' },
    { name: 'E-Waste', description: 'Old electronics and devices' },
    { name: 'Glass', description: 'Glass bottles and jars' },
    { name: 'Organic', description: 'Food waste and compostables' },
    { name: 'Copper Wire', description: 'Copper wiring and cables' },
    { name: 'Batteries', description: 'Household batteries' },
  ];

  const categories = [] as any[];
  for (const def of categoryDefs) {
    const cat = await prisma.wasteCategory.upsert({
      where: { name: def.name },
      update: { description: def.description },
      create: { name: def.name, description: def.description },
    });
    categories.push(cat);
  }

  // Ensure each category has a pricing entry
  const defaultPricingMap: Record<string, { min: number; max: number }> = {
    Plastic: { min: 45, max: 70 },
    Paper: { min: 30, max: 55 },
    Metal: { min: 160, max: 240 },
    'E-Waste': { min: 220, max: 450 },
    Glass: { min: 20, max: 40 },
    Organic: { min: 5, max: 15 },
    'Copper Wire': { min: 300, max: 550 },
    Batteries: { min: 80, max: 160 },
  };

  for (const cat of categories) {
    const existingPrice = await prisma.pricing.findUnique({
      where: { wasteCategoryId: cat.id } as any,
    });
    if (!existingPrice) {
      const mapping = defaultPricingMap[cat.name] ?? { min: 20, max: 50 };
      await prisma.pricing.create({
        data: {
          wasteCategoryId: cat.id,
          minPriceLkrPerKg: mapping.min,
          maxPriceLkrPerKg: mapping.max,
          updatedAt: new Date(),
        },
      });
    }
  }

  const booking1 = await prisma.booking.create({
    data: {
      userId: rajeshUser.id,
      wasteCategoryId: categories[0].id,
      estimatedWeightRange: '10-15 kg',
      estimatedMinAmount: 450,
      estimatedMaxAmount: 900,
      addressLine1: '45 Galle Road',
      city: 'Colombo',
      postalCode: '00300',
      scheduledDate: new Date(),
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      status: BookingStatus.CREATED,
      driverId: drivers[1].id,
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: rajeshUser.id,
      wasteCategoryId: categories[2].id,
      estimatedWeightRange: '25-30 kg',
      estimatedMinAmount: 1250,
      estimatedMaxAmount: 2100,
      addressLine1: '45 Galle Road',
      city: 'Colombo',
      postalCode: '00300',
      scheduledDate: new Date(new Date().setDate(new Date().getDate() - 7)),
      scheduledTimeSlot: '2:00 PM - 4:00 PM',
      status: BookingStatus.COMPLETED,
      actualWeightKg: 27,
      finalAmountLkr: 1780,
      driverId: drivers[0].id,
    },
  });

  const booking3 = await prisma.booking.create({
    data: {
      userId: samanthaUser.id,
      wasteCategoryId: categories[1].id,
      estimatedWeightRange: '50-60 kg',
      estimatedMinAmount: 1500,
      estimatedMaxAmount: 2500,
      addressLine1: 'Industrial Park',
      city: 'Negombo',
      postalCode: '11500',
      scheduledDate: new Date(new Date().setDate(new Date().getDate() - 2)),
      scheduledTimeSlot: '9:00 AM - 11:00 AM',
      status: BookingStatus.REFUNDED,
      driverId: drivers[2].id,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      bookingId: booking2.id,
      amountLkr: 1780,
      method: PaymentMethod.MOBILE_WALLET,
      status: PaymentStatus.PROCESSED,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: rajeshUser.id,
        title: 'Pickup completed',
        message: 'Your metal pickup is complete. Payment processed.',
        level: NotificationLevel.SUCCESS,
      },
      {
        userId: rajeshUser.id,
        title: 'Driver en route',
        message: 'Driver Nimali is 15 minutes away.',
        level: NotificationLevel.INFO,
      },
      {
        userId: samanthaUser.id,
        title: 'Refund issued',
        message: 'Refund for booking ' + booking3.id + ' has been issued.',
        level: NotificationLevel.WARNING,
      },
      {
        title: 'Inventory alert',
        message: 'E-waste storage reached 85% capacity.',
        level: NotificationLevel.ERROR,
      },
    ],
  });

  await prisma.launchNotify.create({
    data: { email: 'hello@trash2cash.lk' },
  });

  // Insert application config values (e.g. storage bucket) if provided via env
  const bucket =
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
    process.env.SUPABASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    null;
  if (bucket) {
    await prisma.appConfig.upsert({
      where: { key: 'storageBucket' },
      update: { value: bucket },
      create: { key: 'storageBucket', value: bucket },
    });
  }

  console.log('Seed data created:', {
    admin: adminUser.email,
    rajesh: rajeshUser.email,
    samantha: samanthaUser.email,
    drivers: drivers.map((d) => d.fullName),
    storageBucket: bucket ?? 'none',
  });

  // Supabase syncing removed to avoid depending on external credentials during seeding.
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
` 

## server/prisma/migrations/20260219130000_normalize_legacy_booking_statuses/migration.sql

`$ext
-- Compatibility-safe booking status normalization:
-- Keep enum values, but normalize legacy rows and default writes.

ALTER TABLE "Booking"
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

UPDATE "Booking"
SET "status" = 'CREATED'
WHERE "status" = 'SCHEDULED';

UPDATE "Booking"
SET "status" = 'COLLECTED'
WHERE "status" = 'PAID';

DO $$
BEGIN
  IF to_regclass('"BookingStatusHistory"') IS NOT NULL THEN
    UPDATE "BookingStatusHistory"
    SET "fromStatus" = 'CREATED'
    WHERE "fromStatus" = 'SCHEDULED';

    UPDATE "BookingStatusHistory"
    SET "toStatus" = 'CREATED'
    WHERE "toStatus" = 'SCHEDULED';

    UPDATE "BookingStatusHistory"
    SET "fromStatus" = 'COLLECTED'
    WHERE "fromStatus" = 'PAID';

    UPDATE "BookingStatusHistory"
    SET "toStatus" = 'COLLECTED'
    WHERE "toStatus" = 'PAID';
  END IF;
END $$;
` 

## server/package.json

`$ext
{
  "name": "server",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "npm run prisma:generate && nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "seed": "prisma db seed",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "logs:tail": "node scripts/pretty-logs.js logs/trash2cash-$(date +%F).log",
    "logs:watch": "tail -f logs/trash2cash-$(date +%F).log | node scripts/pretty-logs.js -",
    "notifications:check": "ts-node src/scripts/check-notifications.ts",
    "notifications:create-for-booking": "ts-node src/scripts/create-notification-for-booking.ts",
    "rewards:backfill": "ts-node src/scripts/backfill-rewards.ts"
  },
  "dependencies": {
    "@google-cloud/vision": "^5.3.4",
    "@nestjs/cache-manager": "^3.1.0",
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.1",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/swagger": "^11.2.5",
    "@nestjs/throttler": "^6.5.0",
    "@prisma/client": "^6.2.1",
    "@simplewebauthn/server": "^13.2.2",
    "@supabase/supabase-js": "^2.95.1",
    "@types/node-fetch": "^2.6.13",
    "bcrypt": "^6.0.0",
    "cache-manager": "^7.2.8",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "cookie-parser": "^1.4.7",
    "jose": "^6.1.3",
    "nest-winston": "^1.10.2",
    "node-fetch": "^3.3.2",
    "openai": "^6.17.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.18.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "web-push": "^3.6.7",
    "winston": "^3.19.0",
    "winston-daily-rotate-file": "^4.7.1"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.10.7",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "prisma": "^6.2.1",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
` 

## server/src/bookings/booking-status.ts

`$ext
import { BookingStatus } from '@prisma/client';

export const CANONICAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COLLECTED,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REFUNDED,
];

const LEGACY_BOOKING_STATUS_MAP: Partial<Record<BookingStatus, BookingStatus>> = {
  [BookingStatus.SCHEDULED]: BookingStatus.CREATED,
  [BookingStatus.PAID]: BookingStatus.COLLECTED,
};

const canonicalBookingStatusSet = new Set<BookingStatus>(
  CANONICAL_BOOKING_STATUSES,
);

export const BOOKING_STATUS_TRANSITIONS: Partial<
  Record<BookingStatus, BookingStatus[]>
> = {
  CREATED: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  ASSIGNED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  IN_PROGRESS: [BookingStatus.COLLECTED, BookingStatus.CANCELLED],
  COLLECTED: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [BookingStatus.REFUNDED],
  REFUNDED: [],
};

export type BookingTransitionActor = 'ADMIN' | 'DRIVER';

const ROLE_ALLOWED_TRANSITIONS: Record<
  BookingTransitionActor,
  Partial<Record<BookingStatus, BookingStatus[]>>
> = {
  ADMIN: {
    CREATED: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
    ASSIGNED: [BookingStatus.CANCELLED],
    IN_PROGRESS: [BookingStatus.CANCELLED],
    COLLECTED: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    CANCELLED: [BookingStatus.REFUNDED],
  },
  DRIVER: {
    ASSIGNED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    IN_PROGRESS: [BookingStatus.COLLECTED, BookingStatus.CANCELLED],
    COLLECTED: [BookingStatus.CANCELLED],
  },
};

export function isLegacyBookingStatus(status: BookingStatus) {
  return status in LEGACY_BOOKING_STATUS_MAP;
}

export function normalizeBookingStatus(status: BookingStatus) {
  return LEGACY_BOOKING_STATUS_MAP[status] ?? status;
}

export function isCanonicalBookingStatus(status: BookingStatus) {
  return canonicalBookingStatusSet.has(status);
}

export function expandBookingStatusFilter(status: BookingStatus) {
  const normalized = normalizeBookingStatus(status);
  if (normalized === BookingStatus.CREATED) {
    return [BookingStatus.CREATED, BookingStatus.SCHEDULED];
  }
  if (normalized === BookingStatus.COLLECTED) {
    return [BookingStatus.COLLECTED, BookingStatus.PAID];
  }
  return [normalized];
}

export function canTransition(from: BookingStatus, to: BookingStatus) {
  if (isLegacyBookingStatus(to)) return false;
  if (from === to) return true;

  const fromCanonical = normalizeBookingStatus(from);
  const toCanonical = normalizeBookingStatus(to);
  if (fromCanonical === toCanonical) return true;

  return (BOOKING_STATUS_TRANSITIONS[fromCanonical] ?? []).includes(toCanonical);
}

export function getTransitionError(from: BookingStatus, to: BookingStatus) {
  if (canTransition(from, to)) return null;
  return `Invalid status transition from ${normalizeBookingStatus(from)} to ${normalizeBookingStatus(to)}.`;
}

export function getRoleTransitionError(
  actor: BookingTransitionActor,
  from: BookingStatus,
  to: BookingStatus,
) {
  if (isLegacyBookingStatus(to)) {
    return `Legacy status ${to} is not allowed.`;
  }

  const fromCanonical = normalizeBookingStatus(from);
  const toCanonical = normalizeBookingStatus(to);

  if (fromCanonical === toCanonical) return null;
  if (!canTransition(fromCanonical, toCanonical)) {
    return getTransitionError(fromCanonical, toCanonical);
  }

  const allowed = ROLE_ALLOWED_TRANSITIONS[actor][fromCanonical] ?? [];
  if (!allowed.includes(toCanonical)) {
    return `Role ${actor} cannot move booking from ${fromCanonical} to ${toCanonical}.`;
  }

  return null;
}

export function isTerminalStatus(status: BookingStatus) {
  const normalized = normalizeBookingStatus(status);
  return (
    normalized === BookingStatus.COMPLETED ||
    normalized === BookingStatus.REFUNDED
  );
}
` 

## server/src/bookings/bookings.service.ts

`$ext
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, NotificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { TransactionLogger } from '../common/logger/transaction-logger.service';
import { PushService } from '../notifications/push.service';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import {
  expandBookingStatusFilter,
  getTransitionError,
  isLegacyBookingStatus,
  normalizeBookingStatus,
} from './booking-status';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
    private transactionLogger: TransactionLogger,
    private pushService: PushService,
  ) {}

  async list(userId: string, query: BookingsQueryDto) {
    this.transactionLogger.logTransaction('booking.list.start', {
      userId,
      query,
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const where: any = { userId };
    if (query.status) {
      where.status = { in: expandBookingStatusFilter(query.status) };
    }
    if (query.category) where.wasteCategoryId = query.category;
    if (query.from || query.to) {
      where.scheduledDate = {};
      if (query.from) where.scheduledDate.gte = new Date(query.from);
      if (query.to) where.scheduledDate.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { addressLine1: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [items, total] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          include: { wasteCategory: true, driver: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.booking.count({ where }),
      ]);
      this.transactionLogger.logTransaction('booking.list.success', {
        userId,
        count: items.length,
        total,
      });
      return {
        items: items.map((item) => this.normalizeBookingForRead(item)),
        total,
        page,
        pageSize,
      };
    } catch (err) {
      this.transactionLogger.logError('booking.list.failure', err as Error, {
        userId,
      });
      throw err;
    }
  }

  async getById(userId: string, id: string) {
    this.transactionLogger.logTransaction('booking.get.start', {
      userId,
      bookingId: id,
    });
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
        include: { wasteCategory: true, driver: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== userId) throw new ForbiddenException();
      this.transactionLogger.logTransaction('booking.get.success', {
        userId,
        bookingId: id,
      });
      return this.normalizeBookingForRead(booking);
    } catch (err) {
      this.transactionLogger.logError('booking.get.failure', err as Error, {
        userId,
        bookingId: id,
      });
      throw err;
    }
  }

  async create(userId: string, dto: CreateBookingDto) {
    this.transactionLogger.logTransaction('booking.create.start', {
      userId,
      dto,
    });
    try {
      // Create one booking per selected item (category + quantity)
      const created = await Promise.all(
        dto.items.map(async (it) => {
          const pricing = await this.prisma.pricing.findUnique({
            where: { wasteCategoryId: it.wasteCategoryId },
          });
          const minPerKg = pricing?.minPriceLkrPerKg ?? 0;
          const maxPerKg = pricing?.maxPriceLkrPerKg ?? 0;
          const estimatedMinAmount = minPerKg * it.quantityKg;
          const estimatedMaxAmount = maxPerKg * it.quantityKg;
          const estimatedWeightRange = `${it.quantityKg} kg`;

          const booking = await this.prisma.booking.create({
            data: {
              userId,
              wasteCategoryId: it.wasteCategoryId,
              estimatedWeightRange,
              estimatedMinAmount,
              estimatedMaxAmount,
              addressLine1: dto.addressLine1,
              city: dto.city,
              postalCode: dto.postalCode,
              specialInstructions: dto.specialInstructions,
              scheduledDate: new Date(dto.scheduledDate),
              scheduledTimeSlot: dto.scheduledTimeSlot,
              lat: dto.lat,
              lng: dto.lng,
              status: BookingStatus.CREATED,
            },
          });
          this.transactionLogger.logTransaction('booking.create.success', {
            bookingId: booking.id,
            userId,
            scheduledDate: booking.scheduledDate?.toISOString(),
            amountRange: [
              booking.estimatedMinAmount,
              booking.estimatedMaxAmount,
            ],
          });

          // Sync booking to Supabase DB
          const supabaseData: any = {
            id: booking.id,
            userId: booking.userId,
            wasteCategoryId: booking.wasteCategoryId,
            estimatedWeightRange: booking.estimatedWeightRange,
            estimatedMinAmount: booking.estimatedMinAmount,
            estimatedMaxAmount: booking.estimatedMaxAmount,
            addressLine1: booking.addressLine1,
            city: booking.city,
            postalCode: booking.postalCode,
            scheduledDate: booking.scheduledDate,
            scheduledTimeSlot: booking.scheduledTimeSlot,
            status: booking.status,
          };

          // Add location if lat/lng provided
          if (dto.lat !== undefined && dto.lng !== undefined) {
            supabaseData.location = `SRID=4326;POINT(${dto.lng} ${dto.lat})`;
          }

          await this.supabaseService.upsertRow('bookings', supabaseData);

          return booking;
        }),
      );

      // Send push notification for each created booking
      for (const booking of created) {
        const category = await this.prisma.wasteCategory.findUnique({
          where: { id: booking.wasteCategoryId },
        });
        this.pushService
          .notify(userId, {
            title: 'Booking confirmed ✅',
            body: `Your ${category?.name ?? 'waste'} pickup on ${new Date(booking.scheduledDate).toLocaleDateString()} at ${booking.scheduledTimeSlot} is confirmed.`,
            level: NotificationLevel.SUCCESS,
            bookingId: booking.id,
            url: `/users/bookings/${booking.id}`,
          })
          .catch(() => {});
      }

      return created.map((item) => this.normalizeBookingForRead(item));
    } catch (err) {
      this.transactionLogger.logError('booking.create.failure', err as Error, {
        userId,
        dto,
      });
      throw err;
    }
  }

  async cancel(userId: string, id: string) {
    this.transactionLogger.logTransaction('booking.cancel.start', {
      userId,
      bookingId: id,
    });
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== userId) throw new ForbiddenException();
      const updated = await this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });
      this.transactionLogger.logTransaction('booking.cancel.success', {
        userId,
        bookingId: id,
      });

      // Sync status change to Supabase DB
      await this.supabaseService.upsertRow('bookings', {
        id: updated.id,
        status: updated.status,
      });

      // Send cancellation push notification
      this.pushService
        .notify(userId, {
          title: 'Booking cancelled',
          body: `Your booking #${id.slice(0, 8)} has been cancelled.`,
          level: NotificationLevel.WARNING,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});

      return this.normalizeBookingForRead(updated);
    } catch (err) {
      this.transactionLogger.logError('booking.cancel.failure', err as Error, {
        userId,
        bookingId: id,
      });
      throw err;
    }
  }

  async delete(userId: string, id: string, role: string) {
    this.transactionLogger.logTransaction('booking.delete.start', {
      userId,
      bookingId: id,
      role,
    });

    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');

      // Only the owner or admins can delete a booking
      if (booking.userId !== userId && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        throw new ForbiddenException();
      }

      await this.prisma.booking.delete({ where: { id } });

      this.transactionLogger.logTransaction('booking.delete.success', {
        userId,
        bookingId: id,
      });

      // Send deletion push notification
      this.pushService
        .notify(booking.userId, {
          title: 'Booking removed',
          body: `Your booking #${id.slice(0, 8)} has been removed.`,
          level: NotificationLevel.WARNING,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});

      return { message: 'Booking deleted' };
    } catch (err) {
      this.transactionLogger.logError('booking.delete.failure', err as Error, {
        userId,
        bookingId: id,
      });
      throw err;
    }
  }

  async pendingPickups(userId: string) {
    this.transactionLogger.logTransaction('booking.pending.start', { userId });
    try {
      const results = await this.prisma.booking.findMany({
        where: {
          userId,
          status: {
            in: [
              BookingStatus.CREATED,
              BookingStatus.SCHEDULED,
              BookingStatus.ASSIGNED,
              BookingStatus.IN_PROGRESS,
            ],
          },
        },
        include: { wasteCategory: true, driver: true },
        orderBy: { scheduledDate: 'asc' },
      });
      this.transactionLogger.logTransaction('booking.pending.success', {
        userId,
        count: results.length,
      });
      return results.map((item) => this.normalizeBookingForRead(item));
    } catch (err) {
      this.transactionLogger.logError('booking.pending.failure', err as Error, {
        userId,
      });
      throw err;
    }
  }

  async updateLocation(userId: string, id: string, lng: number, lat: number) {
    this.transactionLogger.logTransaction('booking.updateLocation.start', {
      userId,
      bookingId: id,
      lng,
      lat,
    });
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.userId !== userId) throw new ForbiddenException();

      // Update location in Supabase as geography(Point, 4326) with SRID=4326;POINT(lng lat)
      const location = `SRID=4326;POINT(${lng} ${lat})`;
      await this.supabaseService.upsertRow('bookings', {
        id,
        location,
      });

      this.transactionLogger.logTransaction('booking.updateLocation.success', {
        userId,
        bookingId: id,
        location,
      });
      return { message: 'Location updated successfully' };
    } catch (err) {
      this.transactionLogger.logError('booking.updateLocation.failure', err as Error, {
        userId,
        bookingId: id,
        lng,
        lat,
      });
      throw err;
    }
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    this.transactionLogger.logTransaction('booking.status.update.start', {
      bookingId: id,
      status: dto.status,
    });
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException('Booking not found');

      if (isLegacyBookingStatus(dto.status)) {
        throw new BadRequestException(
          `Legacy status ${dto.status} is not allowed.`,
        );
      }

      const currentStatus = normalizeBookingStatus(booking.status);
      const nextStatus = normalizeBookingStatus(dto.status);
      if (nextStatus !== currentStatus) {
        const transitionError = getTransitionError(currentStatus, nextStatus);
        if (transitionError) {
          throw new BadRequestException(transitionError);
        }
      }

      const shouldConfirm = nextStatus === BookingStatus.COMPLETED;
      const nextWeight =
        dto.actualWeightKg !== undefined
          ? dto.actualWeightKg
          : booking.actualWeightKg;
      const nextAmount =
        dto.finalAmountLkr !== undefined
          ? dto.finalAmountLkr
          : booking.finalAmountLkr;

      if (
        shouldConfirm &&
        (nextWeight === null ||
          nextWeight === undefined ||
          nextAmount === null ||
          nextAmount === undefined)
      ) {
        throw new BadRequestException(
          'Cannot complete a booking without weight and amount.',
        );
      }

      const data: any = { status: nextStatus };

      if (dto.actualWeightKg !== undefined) {
        data.actualWeightKg = dto.actualWeightKg;
      }
      if (dto.finalAmountLkr !== undefined) {
        data.finalAmountLkr = dto.finalAmountLkr;
      }
      if (shouldConfirm && !booking.confirmedAt) {
        data.confirmedAt = new Date();
      }

      const updated = await this.prisma.booking.update({
        where: { id },
        data,
      });

      await this.supabaseService.upsertRow('bookings', {
        id: updated.id,
        status: updated.status,
        actualWeightKg: updated.actualWeightKg,
        finalAmountLkr: updated.finalAmountLkr,
        confirmedAt: updated.confirmedAt,
      });

      this.transactionLogger.logTransaction('booking.status.update.success', {
        bookingId: id,
        status: updated.status,
      });

      return this.normalizeBookingForRead(updated);
    } catch (err) {
      this.transactionLogger.logError(
        'booking.status.update.failure',
        err as Error,
        { bookingId: id, status: dto.status },
      );
      throw err;
    }
  }

  private normalizeBookingForRead<T extends { status: BookingStatus }>(
    booking: T,
  ): T {
    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus === booking.status) return booking;
    return {
      ...booking,
      status: normalizedStatus,
    };
  }
}
` 

## server/src/admin/admin.service.ts

`$ext
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, CustomerType, NotificationLevel, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCreateDriverDto } from './dto/admin-create-driver.dto';
import { AdminUpdateDriverDto } from './dto/admin-update-driver.dto';
import { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';
import { AdminUpdateBookingDto } from './dto/admin-update-booking.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { AdminCreateWasteCategoryDto } from './dto/admin-create-waste-category.dto';
import { AdminUpdateWasteCategoryDto } from './dto/admin-update-waste-category.dto';
import * as bcrypt from 'bcrypt';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { RewardsService } from '../rewards/rewards.service';
import { UpdateBookingStatusDto } from '../bookings/dto/update-booking-status.dto';
import { calculateMidpointAmountLkr } from '../bookings/booking-amount';
import {
  CANONICAL_BOOKING_STATUSES,
  expandBookingStatusFilter,
  getRoleTransitionError,
  isLegacyBookingStatus,
  normalizeBookingStatus,
} from '../bookings/booking-status';

type ActorContext = { sub: string; role: Role };
const CLOSED_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REFUNDED,
]);
const PRE_ASSIGN_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CREATED,
]);
const DRIVER_REQUIRED_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COLLECTED,
  BookingStatus.COMPLETED,
]);
const BOOKING_STATUSES = [...CANONICAL_BOOKING_STATUSES];
const BOOKING_STATUS_ENUM_VALUES = Object.values(BookingStatus) as BookingStatus[];
const LEGACY_SAFE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COLLECTED,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REFUNDED,
];
const LEGACY_USER_PROFILE_INCLUDE = {
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      address: true,
      type: true,
      status: true,
      createdAt: true,
    },
  },
  admin: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      address: true,
    },
  },
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      rating: true,
      pickupCount: true,
      vehicle: true,
      status: true,
      createdAt: true,
    },
  },
  recycler: {
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      phone: true,
      materialTypes: true,
      createdAt: true,
    },
  },
  corporate: {
    select: {
      id: true,
      organizationName: true,
      contactName: true,
      phone: true,
      requirements: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly bookingStatusAvailability = new Map<BookingStatus, boolean>();
  private bookingStatusAvailabilityLoaded = false;
  private bookingStatusAvailabilityKnown = false;

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
    private rewardsService: RewardsService,
  ) {}

  async getMetrics() {
    const pendingStatuses = await this.getPendingPickupStatuses();
    const [
      revenueAgg,
      revenueCount,
      completedAgg,
      totalUsers,
      activeDrivers,
      pendingPickups,
    ] = await Promise.all([
      this.prisma.paymentTransaction.aggregate({
        _sum: { amountLkr: true },
      }),
      this.prisma.paymentTransaction.count(),
      this.prisma.booking.aggregate({
        _sum: { finalAmountLkr: true },
        where: { status: BookingStatus.COMPLETED },
      }),
      this.prisma.user.count(),
      this.prisma.driver.count({
        where: { status: { in: ['ONLINE', 'ON_PICKUP'] } },
      }),
      this.prisma.booking.count({
        where: { status: { in: pendingStatuses } },
      }),
    ]);

    const last7Days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const useTransactions = revenueCount > 0;
    const totalRevenue = useTransactions
      ? revenueAgg._sum.amountLkr ?? 0
      : completedAgg._sum.finalAmountLkr ?? 0;

    let revenueByDay: Array<{ date: string; revenue: number }> = [];

    if (useTransactions) {
      const transactions = await this.prisma.paymentTransaction.findMany({
        where: {
          createdAt: {
            gte: new Date(last7Days[0].toISOString().slice(0, 10)),
          },
        },
      });

      revenueByDay = last7Days.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const sum = transactions
          .filter((t) => t.createdAt.toISOString().slice(0, 10) === key)
          .reduce((acc, cur) => acc + cur.amountLkr, 0);
        return { date: key, revenue: sum };
      });
    } else {
      const completed = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          finalAmountLkr: { not: null },
          OR: [
            {
              confirmedAt: {
                gte: new Date(last7Days[0].toISOString().slice(0, 10)),
              },
            },
            {
              confirmedAt: null,
              createdAt: {
                gte: new Date(last7Days[0].toISOString().slice(0, 10)),
              },
            },
          ],
        },
        select: {
          finalAmountLkr: true,
          confirmedAt: true,
          createdAt: true,
        },
      });

      revenueByDay = last7Days.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const sum = completed
          .filter((b) => (b.confirmedAt ?? b.createdAt).toISOString().slice(0, 10) === key)
          .reduce((acc, cur) => acc + (cur.finalAmountLkr ?? 0), 0);
        return { date: key, revenue: sum };
      });
    }

    const bookingsByCategory = await this.prisma.booking.groupBy({
      by: ['wasteCategoryId'],
      _count: { wasteCategoryId: true },
    });
    const categories = await this.prisma.wasteCategory.findMany();
    const wasteDistribution = bookingsByCategory.map((item) => ({
      name:
        categories.find((c) => c.id === item.wasteCategoryId)?.name ?? 'Other',
      value: item._count.wasteCategoryId,
    }));

    const recentActivity = await this.findManyBookingsWithUserProfile(
      {
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          wasteCategory: true,
        },
      },
      'metrics/recentActivity',
    );

    return {
      totals: {
        totalRevenue,
        totalUsers,
        activeDrivers,
        pendingPickups,
      },
      revenueByDay,
      wasteDistribution,
      recentActivity: recentActivity.map((booking) => ({
        ...booking,
        user: flattenUser(booking.user),
      })),
    };
  }

  async listUsers(search?: string, type?: string) {
    // Build the customer filter for type
    const typeValue: CustomerType | null =
      type === 'HOUSEHOLD' || type === 'BUSINESS'
        ? (type as CustomerType)
        : null;

    const hasSearch = search?.trim().length;

    // We query users with their customer profile included
    const where: Prisma.UserWhereInput = {};

    // Only show CUSTOMER-role users in the admin users list
    where.role = 'CUSTOMER';

    if (typeValue) {
      where.customer = { type: typeValue };
    }

    if (hasSearch) {
      const term = search.trim();
      where.OR = [
        {
          customer: {
            fullName: { contains: term, mode: 'insensitive' as const },
          },
        },
        { email: { contains: term, mode: 'insensitive' as const } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ...USER_PROFILE_INCLUDE,
        _count: {
          select: { bookings: true },
        },
      },
    });

    return users.map((user) => ({
      ...flattenUser(user),
      _count: (user as any)._count,
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: dto.role,
        },
      });

      // Create the appropriate profile based on role
      switch (dto.role) {
        case 'CUSTOMER':
          await tx.customer.create({
            data: {
              id: newUser.id,
              fullName: dto.fullName,
              phone: dto.phone,
              type: dto.type ?? 'HOUSEHOLD',
              status: dto.status ?? 'ACTIVE',
            },
          });
          break;
        case 'ADMIN':
        case 'SUPER_ADMIN':
          await tx.admin.create({
            data: {
              id: newUser.id,
              fullName: dto.fullName,
              phone: dto.phone,
            },
          });
          break;
        case 'DRIVER':
          await tx.driver.create({
            data: {
              id: newUser.id,
              fullName: dto.fullName,
              phone: dto.phone,
              vehicle: '',
            },
          });
          break;
      }

      return tx.user.findUnique({
        where: { id: newUser.id },
        include: USER_PROFILE_INCLUDE,
      });
    });

    return flattenUser(user);
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const userUpdate: any = {};
    if (dto.email) userUpdate.email = dto.email;
    if (dto.role) userUpdate.role = dto.role;
    if (dto.password) {
      userUpdate.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({ where: { id }, data: userUpdate });
    }

    // Update profile data
    const profileData: any = {};
    if (dto.fullName) profileData.fullName = dto.fullName;
    if (dto.phone) profileData.phone = dto.phone;
    if (dto.type) profileData.type = dto.type;
    if (dto.status) profileData.status = dto.status;

    if (Object.keys(profileData).length > 0) {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (user) {
        switch (user.role) {
          case 'CUSTOMER':
            const existingCustomer = await this.prisma.customer.findUnique({
              where: { id },
              select: { id: true },
            });
            if (existingCustomer) {
              await this.prisma.customer.update({
                where: { id },
                data: profileData,
              });
            } else {
              await this.prisma.customer.create({
                data: {
                  id,
                  fullName: dto.fullName ?? '',
                  phone: dto.phone ?? '',
                  type: dto.type ?? 'HOUSEHOLD',
                  status: dto.status ?? 'ACTIVE',
                  ...profileData,
                },
              });
            }
            break;
          case 'ADMIN':
          case 'SUPER_ADMIN':
            const existingAdmin = await this.prisma.admin.findUnique({
              where: { id },
              select: { id: true },
            });
            if (existingAdmin) {
              await this.prisma.admin.update({
                where: { id },
                data: {
                  fullName: profileData.fullName,
                  phone: profileData.phone,
                  address: profileData.address,
                },
              });
            } else {
              await this.prisma.admin.create({
                data: {
                  id,
                  fullName: dto.fullName ?? '',
                  phone: dto.phone ?? '',
                  address: profileData.address,
                },
              });
            }
            break;
          case 'DRIVER':
            const existingDriver = await this.prisma.driver.findUnique({
              where: { id },
              select: { id: true },
            });
            if (existingDriver) {
              await this.prisma.driver.update({
                where: { id },
                data: {
                  fullName: profileData.fullName,
                  phone: profileData.phone,
                },
              });
            } else {
              await this.prisma.driver.create({
                data: {
                  id,
                  fullName: dto.fullName ?? '',
                  phone: dto.phone ?? '',
                  vehicle: '',
                },
              });
            }
            break;
        }
      }
    }

    const updated = await this.prisma.user.findUnique({
      where: { id },
      include: USER_PROFILE_INCLUDE,
    });
    return flattenUser(updated);
  }

  async deleteUser(id: string) {
    // Delete related records first (due to foreign key constraints)
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.paymentTransaction.deleteMany({
      where: { booking: { userId: id } },
    });
    await this.prisma.booking.deleteMany({ where: { userId: id } });

    // Delete profile tables (they share the same ID)
    await this.prisma.customer.deleteMany({ where: { id } });
    await this.prisma.admin.deleteMany({ where: { id } });
    await this.prisma.driver.deleteMany({ where: { id } });
    await this.prisma.userPermission.deleteMany({ where: { userId: id } });
    await this.prisma.passkeyCredential.deleteMany({ where: { userId: id } });

    // Now delete the user
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async listDrivers() {
    const drivers = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return drivers.map((d) => ({
      id: d.id,
      fullName: d.fullName,
      phone: d.phone,
      email: d.user?.email ?? '',
      rating: d.rating,
      pickupCount: d.pickupCount,
      vehicle: d.vehicle,
      status: d.status,
      approved: d.approved,
      createdAt: d.createdAt,
    }));
  }

  async createDriver(dto: AdminCreateDriverDto) {
    // Driver is now linked 1:1 with User, so we must create both
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'DRIVER',
        },
      });

      const driver = await tx.driver.create({
        data: {
          id: user.id,
          fullName: dto.fullName,
          phone: dto.phone,
          rating: dto.rating ?? 0,
          pickupCount: dto.pickupCount ?? 0,
          vehicle: dto.vehicle,
          status: dto.status ?? 'OFFLINE',
        },
      });

      return {
        ...driver,
        email: dto.email,
      };
    });
  }

  async updateDriver(id: string, dto: AdminUpdateDriverDto) {
    const data: any = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.pickupCount !== undefined) data.pickupCount = dto.pickupCount;
    if (dto.vehicle !== undefined) data.vehicle = dto.vehicle;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.driver.update({ where: { id }, data });
  }

  async deleteDriver(id: string) {
    // Delete the driver profile, then the user record
    await this.prisma.driver.delete({ where: { id } });
    await this.prisma.user.delete({ where: { id } }).catch(() => {});
    return { success: true };
  }

  async listBookings(query: AdminBookingsQueryDto) {
    const where: Prisma.BookingWhereInput = {};

    if (query.status) {
      where.status = { in: expandBookingStatusFilter(query.status) };
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setDate(toDate.getDate() + 1);
        where.createdAt.lt = toDate;
      }
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      where.OR = [
        { id: { contains: searchTerm, mode: 'insensitive' as const } },
        {
          addressLine1: { contains: searchTerm, mode: 'insensitive' as const },
        },
      ];
    }

    const bookings = await this.findManyBookingsWithUserProfile(
      {
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          wasteCategory: true,
          driver: true,
        },
      },
      'listBookings',
    );

    return bookings.map((booking) => ({
      ...this.normalizeBookingForRead(booking),
      user: flattenUser(booking.user),
    }));
  }

  async listSupportedBookingStatuses() {
    await this.loadBookingStatusAvailability();
    if (!this.bookingStatusAvailabilityKnown) {
      return LEGACY_SAFE_BOOKING_STATUSES;
    }

    return BOOKING_STATUSES.filter(
      (status) => this.bookingStatusAvailability.get(status) === true,
    );
  }

  async updatePricing(dto: AdminUpdatePricingDto) {
    const updates = await Promise.all(
      dto.items.map((item) =>
        this.prisma.pricing.upsert({
          where: { wasteCategoryId: item.wasteCategoryId },
          create: {
            wasteCategoryId: item.wasteCategoryId,
            minPriceLkrPerKg: item.minPriceLkrPerKg,
            maxPriceLkrPerKg: item.maxPriceLkrPerKg,
            isActive: item.isActive ?? true,
          },
          update: {
            minPriceLkrPerKg: item.minPriceLkrPerKg,
            maxPriceLkrPerKg: item.maxPriceLkrPerKg,
            isActive: item.isActive ?? true,
          },
        }),
      ),
    );
    return { items: updates };
  }

  async listPricing() {
    return this.prisma.pricing.findMany({
      include: { wasteCategory: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Waste Category management
  async listWasteCategories() {
    return this.prisma.wasteCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async createWasteCategory(dto: AdminCreateWasteCategoryDto) {
    try {
      return await this.prisma.wasteCategory.create({
        data: {
          name: dto.name,
          description: dto.description ?? undefined,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('Category name already exists');
      }
      throw error;
    }
  }

  async updateWasteCategory(id: string, dto: AdminUpdateWasteCategoryDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.wasteCategory.update({ where: { id }, data });
  }

  async deleteWasteCategory(id: string) {
    await this.prisma.wasteCategory.delete({ where: { id } }).catch(() => {});
    return { success: true };
  }

  /**
   * Admin updates a booking (assign driver, change status, set final weight/amount).
   * Sends push notifications to the customer (and driver if assigned).
   */
  async updateBooking(id: string, dto: AdminUpdateBookingDto, actor: ActorContext) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { wasteCategory: true, driver: true },
    });
    if (!existing) throw new NotFoundException('Booking not found');
    const existingStatus = normalizeBookingStatus(existing.status);

    const update: AdminUpdateBookingDto = { ...dto };
    const driverChanged = Boolean(
      update.driverId && update.driverId !== existing.driverId,
    );

    if (driverChanged) {
      if (CLOSED_BOOKING_STATUSES.has(existingStatus)) {
        throw new BadRequestException('Cannot assign a driver to a closed booking');
      }

      const driver = await this.prisma.driver.findUnique({
        where: { id: update.driverId },
      });
      if (!driver) throw new BadRequestException('Driver not found');
      if (!driver.approved) {
        throw new BadRequestException('Driver must be approved before assignment');
      }

      if (
        existingStatus !== BookingStatus.CREATED &&
        existingStatus !== BookingStatus.ASSIGNED
      ) {
        throw new BadRequestException(
          'Driver can only be assigned while booking is awaiting assignment.',
        );
      }

      if (!update.status && PRE_ASSIGN_BOOKING_STATUSES.has(existingStatus)) {
        const canUseAssignedStatus = await this.isBookingStatusSupported(
          BookingStatus.ASSIGNED,
          false,
        );
        if (canUseAssignedStatus) {
          update.status = BookingStatus.ASSIGNED;
        } else {
          this.logger.warn(
            'Skipping auto status ASSIGNED because the database enum is missing that value',
          );
        }
      }
    }

    if (update.status) {
      if (isLegacyBookingStatus(update.status)) {
        throw new BadRequestException(
          `Legacy status ${update.status} is not allowed.`,
        );
      }

      update.status = normalizeBookingStatus(update.status);

      const isSupported = await this.isBookingStatusSupported(update.status, true);
      if (!isSupported) {
        throw new BadRequestException(
          `Status ${update.status} is not available in the current database schema. Run migrations and restart the backend.`,
        );
      }
    }

    const nextStatus = update.status ?? existingStatus;
    const shouldConfirm = nextStatus === BookingStatus.COMPLETED;
    const statusChanged = nextStatus !== existingStatus;

    if (statusChanged) {
      const transitionError = getRoleTransitionError(
        'ADMIN',
        existingStatus,
        nextStatus,
      );
      if (transitionError) {
        throw new BadRequestException(transitionError);
      }
    }

    const hasDriver =
      update.driverId !== undefined ? Boolean(update.driverId) : Boolean(existing.driverId);
    if (
      DRIVER_REQUIRED_BOOKING_STATUSES.has(nextStatus) &&
      !hasDriver
    ) {
      throw new BadRequestException('Assign a driver before advancing this booking');
    }

    const data: any = {};
    if (statusChanged || existingStatus !== existing.status) data.status = nextStatus;
    if (update.driverId) data.driverId = update.driverId;
    if (update.actualWeightKg !== undefined) data.actualWeightKg = update.actualWeightKg;
    if (update.finalAmountLkr !== undefined) data.finalAmountLkr = update.finalAmountLkr;

    const weightForAmount =
      update.actualWeightKg !== undefined
        ? update.actualWeightKg
        : existing.actualWeightKg ?? null;
    if (data.finalAmountLkr === undefined && weightForAmount !== null) {
      const computed = await this.calculateFinalAmountLkr(
        existing.wasteCategoryId,
        weightForAmount,
      );
      if (computed !== null) data.finalAmountLkr = computed;
    }

    if (shouldConfirm) {
      if (weightForAmount === null || weightForAmount === undefined) {
        throw new BadRequestException(
          'Cannot complete booking without collected weight.',
        );
      }
      const amountForCompletion =
        data.finalAmountLkr ?? existing.finalAmountLkr ?? null;
      if (amountForCompletion === null || amountForCompletion === undefined) {
        throw new BadRequestException(
          'Cannot complete booking without a final amount.',
        );
      }
      if (!existing.confirmedAt) data.confirmedAt = new Date();
    }

    const updated = await (async () => {
      try {
        return await this.prisma.booking.update({
          where: { id },
          data,
          include: { wasteCategory: true, driver: true },
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          update.status &&
          errorMessage.includes('invalid input value for enum') &&
          errorMessage.includes('BookingStatus')
        ) {
          throw new BadRequestException(
            `Status ${update.status} is not available in the current database schema. Run migrations and restart the backend.`,
          );
        }
        throw error;
      }
    })();

    if (statusChanged && actor) {
      await this.recordStatusHistory(existing.id, existingStatus, nextStatus, actor);
    }

    // Push notification triggers based on what changed
    const catName = updated.wasteCategory?.name ?? 'waste';
    const shortId = id.slice(0, 8);

    // Driver was just assigned
    if (update.driverId && update.driverId !== existing.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: update.driverId } });
      // Notify customer
      this.pushService
        .notify(existing.userId, {
          title: 'Driver assigned',
          body: `Driver ${driver?.fullName ?? 'a driver'} will collect your ${catName}.`,
          level: NotificationLevel.INFO,
          bookingId: id,
          url: `/users/bookings/${id}`,
        })
        .catch(() => {});
      // Notify driver
      if (driver) {
        this.pushService
          .notify(update.driverId, {
            title: 'New pickup assigned',
            body: `Pickup at ${existing.addressLine1}, ${existing.city} on ${new Date(existing.scheduledDate).toLocaleDateString()} (${existing.scheduledTimeSlot}).`,
            level: NotificationLevel.INFO,
            bookingId: id,
            url: `/driver/bookings`,
          })
          .catch(() => {});
      }
    }

    // Status-based notifications to customer
    if (statusChanged) {
      switch (nextStatus) {
        case 'COLLECTED':
          this.pushService
            .notify(existing.userId, {
              title: 'Pickup collected',
              body: `Your ${catName} pickup #${shortId} has been collected.`,
              level: NotificationLevel.SUCCESS,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'COMPLETED':
          this.pushService
            .notify(existing.userId, {
              title: 'Booking completed',
              body: `Your ${catName} pickup #${shortId} is complete. Final: LKR ${updated.finalAmountLkr?.toFixed(2) ?? '-'}.`,
              level: NotificationLevel.SUCCESS,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'CANCELLED':
          this.pushService
            .notify(existing.userId, {
              title: 'Booking cancelled',
              body: `Booking #${shortId} was cancelled by the admin.`,
              level: NotificationLevel.WARNING,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
        case 'REFUNDED':
          this.pushService
            .notify(existing.userId, {
              title: 'Refund issued',
              body: `Refund for booking #${shortId} has been processed.`,
              level: NotificationLevel.WARNING,
              bookingId: id,
              url: `/users/bookings/${id}`,
            })
            .catch(() => {});
          break;
      }
    }

    if (statusChanged && shouldConfirm) {
      await this.rewardsService.awardPointsForBooking(updated.id);
    }

    const normalizedUpdated = this.normalizeBookingForRead(updated);
    return {
      ...normalizedUpdated,
      user: undefined, // Don't leak full user in admin response
    };
  }

  async assignDriver(id: string, driverId: string, actor: ActorContext) {
    return this.updateBooking(id, { driverId }, actor);
  }

  async updateBookingStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    actor: ActorContext,
  ) {
    return this.updateBooking(
      id,
      {
        status: dto.status,
        actualWeightKg: dto.actualWeightKg,
        finalAmountLkr: dto.finalAmountLkr,
      },
      actor,
    );
  }

  private async calculateFinalAmountLkr(
    wasteCategoryId: string,
    weightKg: number,
  ) {
    const pricing = await this.prisma.pricing.findUnique({
      where: { wasteCategoryId },
    });
    return calculateMidpointAmountLkr(weightKg, pricing);
  }

  private async recordStatusHistory(
    bookingId: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    actor: ActorContext,
  ) {
    await this.prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus,
        toStatus,
        changedById: actor.sub,
        changedByRole: actor.role,
      },
    });
  }

  private async isBookingStatusSupported(
    status: BookingStatus,
    fallbackWhenUnknown: boolean,
  ) {
    await this.loadBookingStatusAvailability();
    if (!this.bookingStatusAvailabilityKnown) return fallbackWhenUnknown;
    return this.bookingStatusAvailability.get(status) === true;
  }

  private async loadBookingStatusAvailability() {
    if (this.bookingStatusAvailabilityLoaded) return;

    this.bookingStatusAvailabilityLoaded = true;
    for (const status of BOOKING_STATUS_ENUM_VALUES) {
      this.bookingStatusAvailability.set(status, false);
    }

    try {
      const rows = await this.prisma.$queryRaw<Array<{ value: string }>>(
        Prisma.sql`
          SELECT e.enumlabel AS "value"
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_type t ON t.oid = a.atttypid
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE c.relname = 'Booking'
            AND a.attname = 'status'
            AND n.nspname = current_schema()
          ORDER BY e.enumsortorder
        `,
      );

      if (!rows.length) {
        this.logger.warn(
          'Could not load Booking.status enum values from the database. Falling back to default status options.',
        );
        return;
      }

      for (const row of rows) {
        if (this.bookingStatusAvailability.has(row.value as BookingStatus)) {
          this.bookingStatusAvailability.set(row.value as BookingStatus, true);
        }
      }

      this.bookingStatusAvailabilityKnown = true;
    } catch {
      this.logger.warn(
        'Failed to inspect Booking.status enum values from database. Falling back to default status options.',
      );
    }
  }

  private async getPendingPickupStatuses() {
    await this.loadBookingStatusAvailability();
    const candidateStatuses: BookingStatus[] = [
      BookingStatus.CREATED,
      BookingStatus.SCHEDULED,
      BookingStatus.ASSIGNED,
      BookingStatus.IN_PROGRESS,
    ];

    if (!this.bookingStatusAvailabilityKnown) {
      return [BookingStatus.CREATED];
    }

    const supported = candidateStatuses.filter(
      (status) => this.bookingStatusAvailability.get(status) === true,
    );

    return supported.length > 0 ? supported : [BookingStatus.CREATED];
  }

  private normalizeBookingForRead<T extends { status: BookingStatus }>(
    booking: T,
  ): T {
    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus === booking.status) return booking;
    return {
      ...booking,
      status: normalizedStatus,
    };
  }

  private isMissingColumnError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('column') &&
      message.includes('does not exist')
    );
  }

  private async findManyBookingsWithUserProfile(
    args: Prisma.BookingFindManyArgs,
    context: string,
  ) {
    const includeWithoutUser = { ...(args.include ?? {}) } as Record<string, unknown>;
    delete includeWithoutUser.user;

    const run = (user: Prisma.UserDefaultArgs) =>
      this.prisma.booking.findMany({
        ...args,
        include: {
          ...includeWithoutUser,
          user,
        },
      });

    try {
      return await run({ include: USER_PROFILE_INCLUDE });
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      this.logger.warn(
        `Falling back to legacy user profile select for ${context} (missing column in database schema).`,
      );
    }

    try {
      return await run({ include: LEGACY_USER_PROFILE_INCLUDE });
    } catch (error) {
      if (!this.isMissingColumnError(error)) throw error;
      this.logger.warn(
        `Falling back to minimal user profile select for ${context} (missing legacy columns in database schema).`,
      );
    }

    return run({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  /** Debug: trigger a 'Booking completed' style notification for a booking (admin only) */
  async triggerBookingCompletedNotification(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { wasteCategory: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const catName = booking.wasteCategory?.name ?? 'waste';
    const shortId = id.slice(0, 8);

    try {
      await this.pushService.notify(booking.userId, {
        title: 'Booking completed (test) 🎉',
        body: `Your ${catName} pickup #${shortId} is complete (test).`,
        level: NotificationLevel.SUCCESS,
        bookingId: id,
        url: `/users/bookings/${id}`,
      });
    } catch (err) {
      this.logger.error(`Failed to send test completed notification for booking=${id} user=${booking.userId}`, err as Error);
      throw err;
    }

    return { success: true };
  }

  // ─────────────────────────────────────────────
  // Super-Admin: approval & role management
  // ─────────────────────────────────────────────

  /** List admins and drivers whose approved flag is false. */
  async listPendingApprovals() {
    const [admins, drivers] = (await Promise.all([
      this.prisma.admin.findMany({
        where: { approved: false } as any,
        include: { user: { select: { id: true, email: true, role: true, createdAt: true } } },
      }),
      this.prisma.driver.findMany({
        // Cast `where` because TypeScript's generated types may be stale during hot-reload
        where: { approved: false } as any,
        // Use a simple `include: { user: true }` shape so returned driver objects include `user`
        include: { user: true },
      }),
    ])) as any;

    return [
      ...admins.map((a: any) => ({
        id: a.id,
        fullName: a.fullName,
        phone: a.phone,
        email: a.user?.email ?? '',
        role: a.user?.role ?? 'ADMIN',
        createdAt: a.user?.createdAt,
      })),
      ...drivers.map((d: any) => ({
        id: d.id,
        fullName: d.fullName,
        phone: d.phone,
        email: d.user?.email ?? '',
        role: d.user?.role ?? 'DRIVER',
        createdAt: d.user?.createdAt,
      })),
    ];
  }

  /** Approve an admin or driver account. */
  async approveUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { admin: true, driver: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.admin) {
      await this.prisma.admin.update({ where: { id }, data: { approved: true } as any });
    } else if (user.driver) {
      await this.prisma.driver.update({ where: { id }, data: { approved: true } as any });
    } else {
      throw new BadRequestException('User is neither an admin nor a driver');
    }

    return { success: true, message: `User ${id} approved` };
  }

  /** Reject (delete) a pending admin or driver account. */
  async rejectUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { admin: true, driver: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Clean up profile + user row
    if (user.admin) {
      await this.prisma.admin.delete({ where: { id } });
    }
    if (user.driver) {
      await this.prisma.driver.delete({ where: { id } });
    }
    await this.prisma.user.delete({ where: { id } });

    return { success: true, message: `User ${id} rejected and removed` };
  }

  /** List every user with their role (for the manage-roles page). */
  async listAllUsersWithRoles() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: USER_PROFILE_INCLUDE,
    });
    return users.map((u) => flattenUser(u));
  }

  /** Change a user's role (Super-Admin only). */
  async changeUserRole(id: string, role: string) {
    const validRoles: string[] = Object.values(Role);
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id }, data: { role: role as Role } });

    return { success: true, message: `Role changed to ${role}` };
  }

}
` 

## server/src/driver/driver.module.ts

`$ext
import { Module } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DriverController],
  providers: [DriverService],
})
export class DriverModule {}
` 

## server/src/driver/driver.controller.ts

`$ext
import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DriverService } from './driver.service';
import { CollectDriverBookingDto } from './dto/collect-driver-booking.dto';
import { CancelDriverBookingDto } from './dto/cancel-driver-booking.dto';
import { UpdateDriverBookingDto } from './dto/update-driver-booking.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DRIVER)
@Controller('driver')
export class DriverController {
  constructor(private driverService: DriverService) {}

  @Get('bookings')
  getBookings(@Req() req: any) {
    // req.user.sub is the driver's userId
    return this.driverService.getBookings(req.user.sub);
  }

  @Get('bookings/:id')
  getBookingById(@Param('id') id: string, @Req() req: any) {
    return this.driverService.getBookingById(req.user.sub, id);
  }

  @Patch('bookings/:id/update')
  updateBooking(
    @Param('id') id: string,
    @Body() dto: UpdateDriverBookingDto,
    @Req() req: any,
  ) {
    return this.driverService.updateBooking(req.user.sub, id, dto);
  }

  @Patch('bookings/:id/start')
  startPickup(@Param('id') id: string, @Req() req: any) {
    return this.driverService.startPickup(req.user.sub, id);
  }

  @Patch('bookings/:id/collect')
  collectBooking(
    @Param('id') id: string,
    @Body() dto: CollectDriverBookingDto,
    @Req() req: any,
  ) {
    return this.driverService.collectBooking(req.user.sub, id, dto);
  }

  @Patch('bookings/:id/cancel')
  cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelDriverBookingDto,
    @Req() req: any,
  ) {
    return this.driverService.cancelBooking(req.user.sub, id, dto);
  }

  @Patch('status')
  updateStatus(@Body() dto: UpdateDriverStatusDto, @Req() req: any) {
    return this.driverService.updateStatus(req.user.sub, dto.status);
  }
}
` 

## server/src/driver/driver.service.ts

`$ext
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DriverStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';
import { calculateMidpointAmountLkr } from '../bookings/booking-amount';
import {
  getRoleTransitionError,
  isLegacyBookingStatus,
  normalizeBookingStatus,
} from '../bookings/booking-status';
import { PushService } from '../notifications/push.service';
import { CollectDriverBookingDto } from './dto/collect-driver-booking.dto';
import { CancelDriverBookingDto } from './dto/cancel-driver-booking.dto';
import { UpdateDriverBookingDto } from './dto/update-driver-booking.dto';

const MANUAL_DRIVER_STATUSES = new Set<DriverStatus>([
  DriverStatus.ONLINE,
  DriverStatus.OFFLINE,
]);

@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

  async getBookings(driverId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { driverId },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return bookings.map((booking) => this.toDriverBookingResponse(booking));
  }

  async getBookingById(driverId: string, bookingId: string) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    return this.toDriverBookingResponse(booking);
  }

  async startPickup(driverId: string, bookingId: string) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    const currentStatus = normalizeBookingStatus(booking.status);
    const nextStatus = BookingStatus.IN_PROGRESS;

    const transitionError = getRoleTransitionError(
      'DRIVER',
      currentStatus,
      nextStatus,
    );
    if (transitionError) throw new BadRequestException(transitionError);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    await this.recordStatusHistory(booking.id, currentStatus, nextStatus, driverId);
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.ON_PICKUP },
    });

    return this.toDriverBookingResponse(updated);
  }

  async collectBooking(
    driverId: string,
    bookingId: string,
    dto: CollectDriverBookingDto,
  ) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    const currentStatus = normalizeBookingStatus(booking.status);
    const nextStatus = BookingStatus.COLLECTED;

    const transitionError = getRoleTransitionError(
      'DRIVER',
      currentStatus,
      nextStatus,
    );
    if (transitionError) throw new BadRequestException(transitionError);

    const categoryForPricing = dto.wasteCategoryId ?? booking.wasteCategoryId;
    const amountLkr = await this.calculateFinalAmountLkr(
      categoryForPricing,
      dto.weightKg,
    );
    if (amountLkr === null) {
      throw new BadRequestException(
        'Pricing is not configured for this waste category.',
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: nextStatus,
        actualWeightKg: dto.weightKg,
        finalAmountLkr: amountLkr,
        wasteCategoryId: dto.wasteCategoryId ?? booking.wasteCategoryId,
      },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    const statusChanged = currentStatus !== nextStatus;
    if (statusChanged) {
      await this.recordStatusHistory(booking.id, currentStatus, nextStatus, driverId);
      await this.prisma.driver.update({
        where: { id: driverId },
        data: {
          status: DriverStatus.ONLINE,
          pickupCount: { increment: 1 },
        },
      });
    }

    if (statusChanged) {
      const wasteTypeName = updated.wasteCategory?.name ?? 'Waste';
      this.pushService
        .notify(booking.userId, {
          title: 'Pickup collected',
          body: `Pickup collected: ${wasteTypeName}, ${dto.weightKg.toFixed(2)} kg. Amount due: LKR ${amountLkr.toFixed(2)}.`,
          bookingId: booking.id,
          url: `/users/bookings/${booking.id}`,
        })
        .catch(() => {});
    }

    return this.toDriverBookingResponse(updated);
  }

  async cancelBooking(
    driverId: string,
    bookingId: string,
    dto?: CancelDriverBookingDto,
  ) {
    const booking = await this.getAssignedBooking(driverId, bookingId);
    const currentStatus = normalizeBookingStatus(booking.status);
    const nextStatus = BookingStatus.CANCELLED;

    const transitionError = getRoleTransitionError(
      'DRIVER',
      currentStatus,
      nextStatus,
    );
    if (transitionError) throw new BadRequestException(transitionError);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    await this.recordStatusHistory(booking.id, currentStatus, nextStatus, driverId);
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.ONLINE },
    });

    const messageSuffix = dto?.reason?.trim()
      ? ` Reason: ${dto.reason.trim()}.`
      : '';
    this.pushService
      .notify(booking.userId, {
        title: 'Booking cancelled',
        body: `Booking #${booking.id.slice(0, 8)} was cancelled by the driver.${messageSuffix}`,
        bookingId: booking.id,
        url: `/users/bookings/${booking.id}`,
      })
      .catch(() => {});

    return this.toDriverBookingResponse(updated);
  }

  async updateBooking(driverId: string, bookingId: string, dto: UpdateDriverBookingDto) {
    if (dto.status && isLegacyBookingStatus(dto.status)) {
      throw new BadRequestException(`Legacy status ${dto.status} is not allowed.`);
    }

    if (dto.status === BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Driver cannot mark bookings as completed.',
      );
    }

    if (dto.status === BookingStatus.IN_PROGRESS) {
      return this.startPickup(driverId, bookingId);
    }

    if (dto.status === BookingStatus.CANCELLED) {
      return this.cancelBooking(driverId, bookingId);
    }

    if (dto.status === BookingStatus.COLLECTED) {
      if (dto.actualWeightKg === null || dto.actualWeightKg === undefined) {
        throw new BadRequestException(
          'Weight (kg) is required when marking a booking as collected.',
        );
      }
      return this.collectBooking(driverId, bookingId, {
        weightKg: dto.actualWeightKg,
        wasteCategoryId: dto.wasteCategoryId,
      });
    }

    if (dto.actualWeightKg !== null && dto.actualWeightKg !== undefined) {
      return this.collectBooking(driverId, bookingId, {
        weightKg: dto.actualWeightKg,
        wasteCategoryId: dto.wasteCategoryId,
      });
    }

    throw new BadRequestException(
      'Use start, collect, or cancel actions to update bookings.',
    );
  }

  async updateStatus(driverId: string, status: DriverStatus) {
    if (!MANUAL_DRIVER_STATUSES.has(status)) {
      throw new BadRequestException('Driver status can only be ONLINE or OFFLINE');
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: { status },
    });
  }

  private async getAssignedBooking(driverId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          include: USER_PROFILE_INCLUDE,
        },
        wasteCategory: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.driverId !== driverId) {
      throw new ForbiddenException('Booking is not assigned to this driver');
    }

    return booking;
  }

  private async calculateFinalAmountLkr(wasteCategoryId: string, weightKg: number) {
    const pricing = await this.prisma.pricing.findUnique({
      where: { wasteCategoryId },
    });
    return calculateMidpointAmountLkr(weightKg, pricing);
  }

  private async recordStatusHistory(
    bookingId: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    driverId: string,
  ) {
    await this.prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus,
        toStatus,
        changedById: driverId,
        changedByRole: Role.DRIVER,
      },
    });
  }

  private toDriverBookingResponse<T extends { status: BookingStatus; user: any }>(
    booking: T,
  ): T {
    return {
      ...booking,
      status: normalizeBookingStatus(booking.status),
      user: flattenUser(booking.user),
    };
  }
}
` 

## server/src/driver/dto/update-driver-booking.dto.ts

`$ext
import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateDriverBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsUUID()
  wasteCategoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualWeightKg?: number;
}
` 

## server/src/driver/dto/collect-driver-booking.dto.ts

`$ext
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CollectDriverBookingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  weightKg: number;

  @IsOptional()
  @IsUUID()
  wasteCategoryId?: string;
}
` 

## server/src/driver/dto/cancel-driver-booking.dto.ts

`$ext
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelDriverBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
` 

## server/src/notifications/notifications.module.ts

`$ext
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { UsersNotificationsController } from './users-notifications.controller';

@Module({
  controllers: [NotificationsController, UsersNotificationsController],
  providers: [NotificationsService, PushService],
  exports: [PushService],
})
export class NotificationsModule {}
` 

## server/src/notifications/users-notifications.controller.ts

`$ext
import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('users/notifications')
export class UsersNotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: any) {
    return this.notificationsService.list(req.user.sub);
  }

  @Post('mark-all-read')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub);
  }
}
` 

## server/src/rewards/points-calculator.ts

`$ext
export type WasteItem = {
  categoryName: string;
  weightKg: number;
};

export type PointsCalculationInput = {
  items: WasteItem[];
  includesEwaste?: boolean;
  isFirstBooking: boolean;
  hasWeeklyStreak: boolean;
};

export type PointsCalculationResult = {
  basePoints: number;
  bonusPoints: number;
  multiplier: number;
  finalPoints: number;
  breakdown: {
    items: Array<{
      categoryName: string;
      weightKg: number;
      rate: number;
      points: number;
    }>;
    multiplierReason: 'weekly_streak' | 'first_booking' | 'standard';
    rawBasePoints: number;
  };
};

export const BASE_POINT_RATES = {
  plastic: 10,
  metal: 20,
} as const;

export const E_WASTE_BONUS_POINTS = 30;

export const MULTIPLIERS = {
  weekly: 2.0,
  firstBooking: 1.5,
  standard: 1.0,
} as const;

export function normalizeCategoryName(name: string) {
  return (name ?? '').trim().toLowerCase();
}

export function isPlasticCategory(name: string) {
  const normalized = normalizeCategoryName(name);
  return normalized.includes('plastic') || normalized.includes('pet');
}

export function isMetalCategory(name: string) {
  const normalized = normalizeCategoryName(name);
  return (
    normalized.includes('metal') ||
    normalized.includes('aluminum') ||
    normalized.includes('aluminium')
  );
}

export function isEwasteCategory(name: string) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return false;

  if (
    normalized.includes('reusable electronics') ||
    normalized.includes('reusable electronic') ||
    normalized.includes('electrical waste')
  ) {
    return true;
  }

  return (
    normalized.includes('electronic') ||
    normalized.includes('ewaste') ||
    /(^|[^a-z])e[\s-]?wastes?([^a-z]|$)/.test(normalized)
  );
}

export function getBaseRate(categoryName: string) {
  if (isPlasticCategory(categoryName)) return BASE_POINT_RATES.plastic;
  if (isMetalCategory(categoryName)) return BASE_POINT_RATES.metal;
  return 0;
}

export function calculatePoints(
  input: PointsCalculationInput,
): PointsCalculationResult {
  const safeItems = input.items ?? [];
  let rawBasePoints = 0;

  const itemBreakdown = safeItems.map((item) => {
    const rate = getBaseRate(item.categoryName);
    const weightKg = Math.max(0, Number(item.weightKg) || 0);
    const points = weightKg * rate;
    rawBasePoints += points;
    return {
      categoryName: item.categoryName,
      weightKg,
      rate,
      points,
    };
  });

  const basePoints = Math.max(0, Math.round(rawBasePoints));
  const bonusPoints = input.includesEwaste ? E_WASTE_BONUS_POINTS : 0;

  const multiplierReason = input.hasWeeklyStreak
    ? 'weekly_streak'
    : input.isFirstBooking
      ? 'first_booking'
      : 'standard';

  const multiplier = input.hasWeeklyStreak
    ? MULTIPLIERS.weekly
    : input.isFirstBooking
      ? MULTIPLIERS.firstBooking
      : MULTIPLIERS.standard;

  const finalPoints = Math.max(
    0,
    Math.round((basePoints + bonusPoints) * multiplier),
  );

  return {
    basePoints,
    bonusPoints,
    multiplier,
    finalPoints,
    breakdown: {
      items: itemBreakdown,
      multiplierReason,
      rawBasePoints,
    },
  };
}
` 

## server/src/rewards/points-calculator.spec.ts

`$ext
import { calculatePoints, isEwasteCategory } from './points-calculator';

describe('calculatePoints', () => {
  it('calculates base points with no multiplier', () => {
    const result = calculatePoints({
      items: [
        { categoryName: 'Plastic', weightKg: 2 },
        { categoryName: 'Metal', weightKg: 1 },
      ],
      includesEwaste: false,
      isFirstBooking: false,
      hasWeeklyStreak: false,
    });

    expect(result.basePoints).toBe(40);
    expect(result.bonusPoints).toBe(0);
    expect(result.multiplier).toBe(1);
    expect(result.finalPoints).toBe(40);
  });

  it('adds e-waste bonus and applies weekly multiplier', () => {
    const result = calculatePoints({
      items: [{ categoryName: 'Plastic', weightKg: 1.2 }],
      includesEwaste: true,
      isFirstBooking: false,
      hasWeeklyStreak: true,
    });

    expect(result.basePoints).toBe(12);
    expect(result.bonusPoints).toBe(30);
    expect(result.multiplier).toBe(2);
    expect(result.finalPoints).toBe(84);
  });

  it('uses highest multiplier when multiple flags are true', () => {
    const result = calculatePoints({
      items: [{ categoryName: 'Plastic', weightKg: 1 }],
      includesEwaste: false,
      isFirstBooking: true,
      hasWeeklyStreak: true,
    });

    expect(result.multiplier).toBe(2);
    expect(result.finalPoints).toBe(20);
  });

  it('detects common e-waste category naming', () => {
    expect(isEwasteCategory('E-Waste')).toBe(true);
    expect(isEwasteCategory('E Waste')).toBe(true);
    expect(isEwasteCategory('Ewaste')).toBe(true);
    expect(isEwasteCategory('Electronics')).toBe(true);
    expect(isEwasteCategory('Reusable Electronics')).toBe(true);
    expect(isEwasteCategory('Plastic')).toBe(false);
  });
});
` 

## server/src/rewards/rewards.service.ts

`$ext
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePoints,
  isEwasteCategory,
  WasteItem,
} from './points-calculator';
import { flattenUser, USER_PROFILE_INCLUDE } from '../common/utils/user.utils';

const CONFIRMED_STATUSES: BookingStatus[] = [BookingStatus.COMPLETED];

function formatYearMonth(year: number, monthIndex: number) {
  const month = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthRange(yearMonth?: string) {
  if (!yearMonth) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start,
      end,
      yearMonth: formatYearMonth(now.getFullYear(), now.getMonth()),
    };
  }

  const match = /^\d{4}-\d{2}$/.exec(yearMonth);
  if (!match) {
    throw new BadRequestException('Invalid yearMonth. Expected YYYY-MM');
  }

  const [yearPart, monthPart] = yearMonth.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!year || !month || month < 1 || month > 12) {
    throw new BadRequestException('Invalid yearMonth. Expected YYYY-MM');
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return { start, end, yearMonth: formatYearMonth(year, month - 1) };
}

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  async getMyRewards(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { start, end, yearMonth } = getMonthRange();

    const [monthAgg, lifetimeAgg, recent] = await Promise.all([
      this.prisma.pointsTransaction.aggregate({
        _sum: { pointsAwarded: true },
        where: {
          userId,
          awardedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      this.prisma.pointsTransaction.aggregate({
        _sum: { pointsAwarded: true },
        where: { userId },
      }),
      this.prisma.pointsTransaction.findMany({
        where: { userId },
        orderBy: { awardedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          userId: true,
          bookingId: true,
          pointsAwarded: true,
          basePoints: true,
          bonusPoints: true,
          awardedAt: true,
        },
      }),
    ]);

    return {
      totalPoints: lifetimeAgg._sum.pointsAwarded ?? 0,
      monthPoints: monthAgg._sum.pointsAwarded ?? 0,
      monthRange: {
        yearMonth,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      howToEarn: [
        { label: 'Plastic (PET)', value: '10 pts/kg' },
        { label: 'Metal (Aluminum)', value: '20 pts/kg' },
        { label: 'E-waste bonus', value: '+30 per booking' },
        { label: 'Weekly pickup streak', value: '2x multiplier' },
        { label: 'First confirmed booking', value: '1.5x multiplier' },
        { label: 'Multiplier rule', value: 'Highest multiplier only' },
      ],
      recentPointsTransactions: recent,
    };
  }

  async getMonthlyLeaderboard(yearMonth?: string) {
    const { start, end, yearMonth: ym } = getMonthRange(yearMonth);

    const groups = await this.prisma.pointsTransaction.groupBy({
      by: ['userId'],
      _sum: { pointsAwarded: true },
      _min: { awardedAt: true },
      where: {
        awardedAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [
        { _sum: { pointsAwarded: 'desc' } },
        { _min: { awardedAt: 'asc' } },
        { userId: 'asc' },
      ],
      take: 10,
    });

    return this.buildLeaderboardResponse(groups, {
      monthRange: {
        yearMonth: ym,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  }

  async getOverallLeaderboard() {
    const groups = await this.prisma.pointsTransaction.groupBy({
      by: ['userId'],
      _sum: { pointsAwarded: true },
      _min: { awardedAt: true },
      orderBy: [
        { _sum: { pointsAwarded: 'desc' } },
        { _min: { awardedAt: 'asc' } },
        { userId: 'asc' },
      ],
      take: 10,
    });

    return this.buildLeaderboardResponse(groups);
  }

  async awardPointsForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { wasteCategory: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!CONFIRMED_STATUSES.includes(booking.status)) {
      return { awarded: false, reason: 'not_confirmed' };
    }

    const confirmedAt = booking.confirmedAt ?? new Date();

    const [isFirstBooking, hasWeeklyStreak] = await Promise.all([
      this.isFirstConfirmedBooking(booking.userId, bookingId, confirmedAt),
      this.hasWeeklyPickupStreak(booking.userId, bookingId, confirmedAt),
    ]);

    const items: WasteItem[] = [
      {
        categoryName: booking.wasteCategory?.name ?? 'Unknown',
        weightKg: booking.actualWeightKg ?? 0,
      },
    ];

    const includesEwaste = items.some((item) =>
      isEwasteCategory(item.categoryName),
    );

    const calculation = calculatePoints({
      items,
      includesEwaste,
      isFirstBooking,
      hasWeeklyStreak,
    });

    return this.prisma.$transaction(async (tx) => {
      let insertedCount = 0;

      try {
        const createResult = await tx.pointsTransaction.createMany({
          data: [
            {
              userId: booking.userId,
              bookingId: booking.id,
              pointsAwarded: calculation.finalPoints,
              basePoints: calculation.basePoints,
              bonusPoints: calculation.bonusPoints,
              multiplier: calculation.multiplier,
              reason: {
                ...calculation.breakdown,
                includesEwaste,
                isFirstBooking,
                hasWeeklyStreak,
              },
              awardedAt: confirmedAt,
            },
          ],
          skipDuplicates: true,
        });
        insertedCount = createResult.count;
      } catch (error) {
        const missingMultiplier = this.isMissingColumnError(
          error,
          'PointsTransaction.multiplier',
        );
        const missingReason = this.isMissingColumnError(
          error,
          'PointsTransaction.reason',
        );

        if (!missingMultiplier && !missingReason) {
          throw error;
        }

        insertedCount = Number(
          await tx.$executeRaw`
            INSERT INTO "PointsTransaction"
              ("userId", "bookingId", "pointsAwarded", "basePoints", "bonusPoints", "awardedAt")
            VALUES
              (${booking.userId}, ${booking.id}, ${calculation.finalPoints}, ${calculation.basePoints}, ${calculation.bonusPoints}, ${confirmedAt})
            ON CONFLICT ("bookingId") DO NOTHING
          `,
        );
      }

      if (insertedCount === 0) {
        return { awarded: false, reason: 'already_awarded' };
      }

      if (!booking.confirmedAt) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { confirmedAt },
        });
      }

      return {
        awarded: true,
        pointsAwarded: calculation.finalPoints,
        breakdown: calculation,
      };
    });
  }

  async backfillMissingPoints(limit = 1000) {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        pointsTransaction: {
          is: null,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: normalizedLimit,
      select: { id: true },
    });

    let awarded = 0;
    let skipped = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const result = await this.awardPointsForBooking(booking.id);
        if ((result as any)?.awarded) {
          awarded += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: bookings.length,
      awarded,
      skipped,
      failed,
    };
  }

  private async buildLeaderboardResponse(
    groups: Array<{
      userId: string;
      _sum: { pointsAwarded: number | null };
      _min: { awardedAt: Date | null };
    }>,
    extra?: Record<string, unknown>,
  ) {
    if (groups.length === 0) {
      return {
        items: [],
        ...(extra ?? {}),
      };
    }

    const userIds = groups.map((group) => group.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      include: USER_PROFILE_INCLUDE,
    });

    const userMap = new Map(
      users.map((u) => {
        const flat = flattenUser(u);
        return [u.id, flat];
      }),
    );

    const items = groups.map((group, index) => {
      const user = userMap.get(group.userId);
      const name = user?.fullName ?? user?.email ?? 'Anonymous';
      return {
        rank: index + 1,
        userId: group.userId,
        name,
        points: group._sum.pointsAwarded ?? 0,
      };
    });

    return {
      items,
      ...(extra ?? {}),
    };
  }

  private async isFirstConfirmedBooking(
    userId: string,
    bookingId: string,
    confirmedAt: Date,
  ) {
    const count = await this.prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.COMPLETED,
        NOT: { id: bookingId },
        OR: [
          {
            confirmedAt: {
              lt: confirmedAt,
            },
          },
          {
            confirmedAt: null,
            createdAt: {
              lt: confirmedAt,
            },
          },
        ],
      },
    });
    return count === 0;
  }

  private async hasWeeklyPickupStreak(
    userId: string,
    bookingId: string,
    confirmedAt: Date,
  ) {
    const windowStart = new Date(confirmedAt);
    windowStart.setDate(windowStart.getDate() - 7);

    const count = await this.prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.COMPLETED,
        NOT: { id: bookingId },
        OR: [
          {
            confirmedAt: {
              gte: windowStart,
              lt: confirmedAt,
            },
          },
          {
            confirmedAt: null,
            createdAt: {
              gte: windowStart,
              lt: confirmedAt,
            },
          },
        ],
      },
    });

    return count > 0;
  }

  private isMissingColumnError(error: unknown, columnName: string) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('does not exist') && message.includes(columnName);
  }
}
` 

## server/src/scripts/backfill-rewards.ts

`$ext
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RewardsService } from '../rewards/rewards.service';

function readLimitArg() {
  const arg = process.argv.find((item) => item.startsWith('--limit='));
  if (!arg) return 1000;
  const raw = Number(arg.split('=')[1]);
  if (!Number.isFinite(raw) || raw <= 0) return 1000;
  return Math.floor(raw);
}

async function main() {
  const limit = readLimitArg();
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const rewardsService = app.get(RewardsService);
    const result = await rewardsService.backfillMissingPoints(limit);
    // eslint-disable-next-line no-console
    console.log('Rewards backfill result:', result);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Rewards backfill failed:', error);
  process.exit(1);
});
` 

