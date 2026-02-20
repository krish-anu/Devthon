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
  isBookingCompleted,
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
        <Card>
          <Table className="md:min-w-[800px]">
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
                const isCompleted = isBookingCompleted(booking.status);
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
                    <TableCell>
                      {isCompleted && typeof booking.actualWeightKg === "number"
                        ? `${booking.actualWeightKg} kg`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      LKR{" "}
                      {isCompleted && typeof booking.finalAmountLkr === "number"
                        ? booking.finalAmountLkr.toFixed(2)
                        : "0.00"}
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
