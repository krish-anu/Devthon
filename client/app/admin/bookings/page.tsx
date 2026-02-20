"use client";

import { useMemo, useState, useEffect } from "react";
import Pagination from "@/components/ui/pagination";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
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
import { BookingStatus, Booking } from "@/lib/types";
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

type AdminBookingsResponse = {
  items: Booking[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

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
    mutationFn: ({
      bookingId,
      driverId,
    }: {
      bookingId: string;
      driverId: string;
    }) =>
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
    mutationFn: ({
      bookingId,
      status,
    }: {
      bookingId: string;
      status: BookingStatus;
    }) =>
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
      const queryKey = [
        "admin-bookings",
        status,
        search,
        dateFilter,
        afterCursor,
        beforeCursor,
        limit,
      ] as const;

      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<AdminBookingsResponse>(queryKey);

      if (previous) {
        queryClient.setQueryData<AdminBookingsResponse>(queryKey, {
          ...previous,
          items: previous.items.filter((booking) => booking.id !== id),
        });
      }

      return { previous };
    },
    onError: (_err, _id, context: any) => {
      queryClient.setQueryData(
        ["admin-bookings", status, search, dateFilter, afterCursor, beforeCursor, limit],
        context?.previous,
      );
      setDeletingId(null);
      toast({
        title: "Delete failed",
        description: "Failed to delete booking.",
        variant: "error",
      });
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

  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isFetching } = useQuery<AdminBookingsResponse>({
    queryKey: [
      "admin-bookings",
      status,
      search,
      dateFilter,
      afterCursor,
      beforeCursor,
      limit,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);
      params.append("limit", String(limit));

      if (dateFilter === "thisMonth") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        params.append("from", firstDay.toISOString().split("T")[0]);
        params.append("to", lastDay.toISOString().split("T")[0]);
      }

      if (afterCursor) params.append("after", afterCursor);
      if (beforeCursor) params.append("before", beforeCursor);

      return apiFetch<Booking[] | AdminBookingsResponse>(
        `/admin/bookings?${params.toString()}`,
      ).then((response) => {
        if (Array.isArray(response)) {
          return { items: response, nextCursor: null, prevCursor: null };
        }
        return response;
      });
    },
    refetchInterval: 12000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    setAfterCursor(null);
    setBeforeCursor(null);
  }, [status, search, dateFilter]);

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
          {STATUS_FILTERS.map((statusOption) => (
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
          <SkeletonTableRows columns={10} rows={6} />
        </Card>
      ) : (
        <Card>
          <Table className="w-full md:table-auto [&_th]:md:whitespace-normal [&_td]:md:whitespace-normal">
            <TableHeader>
              <TableRow>
                {/* default widths, let content dictate actual size with auto layout */}
                <TableHead className="w-24">Booking ID</TableHead>
                <TableHead className="w-32">User</TableHead>
                <TableHead className="w-32">Waste Type</TableHead>
                <TableHead className="w-24">Images</TableHead>
                <TableHead className="w-24">Weight</TableHead>
                <TableHead className="w-24">Amount</TableHead>
                <TableHead className="w-auto">Driver</TableHead>
                <TableHead className="w-auto">Status</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-auto">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((booking) => {
                const normalizedStatus = normalizeBookingStatus(booking.status);
                const canAssignDriver = canAdminAssign(booking.status);
                const canCompleteBooking = canAdminComplete(booking.status);
                const canCancelBooking = canAdminCancel(booking.status);
                const canRefundBooking = canAdminRefund(booking.status);
                const isCompleted = isBookingCompleted(booking.status);
                const weightText =
                  typeof booking.actualWeightKg === "number"
                    ? `${booking.actualWeightKg} kg`
                    : "-";
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
                      {booking.imageUrls && booking.imageUrls.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {booking.imageUrls.slice(0, 3).map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Click to view full image"
                            >
                              <img
                                src={url}
                                alt={`Booking image ${idx + 1}`}
                                className="h-10 w-10 rounded border object-cover hover:ring-2 hover:ring-(--brand)"
                              />
                            </a>
                          ))}
                          {booking.imageUrls.length > 3 && (
                            <span className="flex h-10 w-10 items-center justify-center rounded border bg-(--surface-strong) text-xs text-(--muted)">
                              +{booking.imageUrls.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-(--muted)">
                          <ImageIcon className="h-3 w-3" /> None
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{weightText}</TableCell>
                    <TableCell>
                      LKR{" "}
                      {isCompleted && typeof booking.finalAmountLkr === "number"
                        ? booking.finalAmountLkr.toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell className="w-auto whitespace-nowrap">
                      <select
                        className="h-9 w-auto rounded-md border border-(--border) bg-(--card) px-2 text-sm"
                        value={booking.driver?.id ?? ""}
                        onChange={(event) =>
                          handleAssign(booking.id, event.target.value)
                        }
                        disabled={
                          !canAssignDriver ||
                          assigningId === booking.id ||
                          driverOptions.length === 0
                        }
                      >
                        <option value="">
                          {booking.driver ? booking.driver.fullName : "Select driver"}
                        </option>
                        {driverOptions.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.fullName} ({driver.status})
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="w-auto whitespace-nowrap">
                      <StatusPill status={booking.status} viewerRole="ADMIN" />
                    </TableCell>
                    <TableCell>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="w-auto whitespace-nowrap">
                      <div className="flex flex-nowrap gap-2">
                        {canCompleteBooking && (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleStatusChange(booking.id, "COMPLETED")
                            }
                            disabled={
                              statusUpdatingId === booking.id ||
                              !hasCollectionData
                            }
                            title="Mark as completed"
                          >
                            ✓
                          </Button>
                        )}
                        {canCancelBooking && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleStatusChange(booking.id, "CANCELLED")
                            }
                            disabled={statusUpdatingId === booking.id}
                            title="Cancel booking"
                          >
                            ×
                          </Button>
                        )}
                        {canRefundBooking && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleStatusChange(booking.id, "REFUNDED")
                            }
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
                          Driver must submit weight and amount before
                          completion.
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
        </Card>
      )}
    </div>
  );
}
