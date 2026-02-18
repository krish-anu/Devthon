"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
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
import { BookingStatus } from "@/lib/types";

const DEFAULT_STATUS_OPTIONS: BookingStatus[] = [
  "SCHEDULED",
  "COLLECTED",
  "PAID",
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

  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: drivers } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: () => apiFetch<any[]>("/admin/drivers"),
    refetchInterval: 15000,
  });
  const { data: statusOptions } = useQuery({
    queryKey: ["admin-booking-status-options"],
    queryFn: () => apiFetch<BookingStatus[]>("/admin/bookings/status-options"),
    staleTime: 60000,
  });
  const availableStatusOptions = useMemo(
    () =>
      statusOptions && statusOptions.length > 0
        ? statusOptions
        : DEFAULT_STATUS_OPTIONS,
    [statusOptions],
  );

  const driverOptions = useMemo(
    () => (drivers ?? []).filter((d) => d.approved !== false),
    [drivers],
  );

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
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
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
      toast({ title: "Status updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Failed to update status.",
        variant: "error",
      });
    },
    onSettled: () => {
      setStatusUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
  });

  const handleAssign = (bookingId: string, driverId: string) => {
    if (!driverId) return;
    assignDriverMutation.mutate({ bookingId, driverId });
  };

  const handleStatusChange = (bookingId: string, nextStatus: BookingStatus) => {
    updateStatusMutation.mutate({ bookingId, status: nextStatus });
  };

  // Mutation to delete booking with optimistic update + spinner
  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bookings/${id}`, {
        method: "DELETE",
      }),
    onMutate: async (id: string) => {
      setDeletingId(id);
      // Show a loading toast while deletion is in progress
      const toastHandle = toast({ title: "Deleting booking...", variant: "loading" });

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["admin-bookings"] });

      // Snapshot current data for rollback
      const previous = queryClient.getQueryData<any[]>([
        "admin-bookings",
        status,
        search,
        dateFilter,
      ]);

      // Optimistically remove the booking from the cached lists that match the current filters
      if (previous) {
        queryClient.setQueryData(
          ["admin-bookings", status, search, dateFilter],
          previous.filter((b) => b.id !== id),
        );
      }

      return { previous, toastHandle };
    },
    onError: (_err, _id, context: any) => {
      // rollback
      queryClient.setQueryData(
        ["admin-bookings", status, search, dateFilter],
        context?.previous,
      );
      setDeletingId(null);
      // Update the loading toast into an error toast
      context?.toastHandle?.update?.({
        title: "Delete failed",
        description: "Failed to delete booking.",
        variant: "error",
      });
    },
    onSuccess: (_data, _id, context: any) => {
      setDeletingId(null);
      // Update the loading toast into a success toast
      context?.toastHandle?.update?.({ title: "Booking deleted", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onSettled: () => {
      setDeletingId(null);
      // Ensure all admin-bookings queries are refreshed
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(id);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", status, search, dateFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      // Add date filter for "This Month"
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

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        {/* ... (existing filters) */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={
              dateFilter === "all" && status === "" ? "default" : "outline"
            }
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
          {["SCHEDULED", "COMPLETED", "CANCELLED", "REFUNDED"].map(
            (statusOption) => (
              <Button
                key={statusOption}
                variant={
                  status === statusOption && dateFilter === "all"
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => {
                  setStatus(statusOption);
                  setDateFilter("all");
                }}
              >
                {statusOption}
              </Button>
            ),
          )}
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
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((booking) => (
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
                        onChange={(event) =>
                          handleAssign(booking.id, event.target.value)
                        }
                        disabled={
                          assigningId === booking.id || driverOptions.length === 0
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
                    <div className="space-y-2">
                      <StatusPill status={booking.status} />
                      <select
                        className="h-9 w-full rounded-md border border-(--border) bg-(--card) px-2 text-sm"
                        value={booking.status}
                        onChange={(event) =>
                          handleStatusChange(
                            booking.id,
                            event.target.value as BookingStatus,
                          )
                        }
                        disabled={statusUpdatingId === booking.id}
                      >
                        {[
                          ...(availableStatusOptions.includes(
                            booking.status as BookingStatus,
                          )
                            ? []
                            : [booking.status as BookingStatus]),
                          ...availableStatusOptions,
                        ].map((option) => (
                          <option key={option} value={option}>
                            {option.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
