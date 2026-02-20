"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  canDriverCancel,
  canDriverCollect,
  canDriverStart,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { Booking, WasteType } from "@/lib/types";
import { getWasteById } from "@/lib/wasteTypeUtils";
import { Card } from "@/components/ui/card";
import Pagination from "@/components/ui/pagination";
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

type DriverBookingsResponse = {
  items: Booking[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

export default function DriverBookingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [collectBookingId, setCollectBookingId] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [wasteCategoryId, setWasteCategoryId] = useState("");

  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isFetching } = useQuery<DriverBookingsResponse>({
    queryKey: ["driver-bookings-list", afterCursor, beforeCursor, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("limit", String(limit));
      if (afterCursor) params.append("after", afterCursor);
      if (beforeCursor) params.append("before", beforeCursor);
      return apiFetch<DriverBookingsResponse>(
        `/driver/bookings?${params.toString()}`,
      );
    },
    refetchInterval: 12000,
    placeholderData: (previousData) => previousData,
  });

  const { data: wasteTypes } = useQuery({
    queryKey: ["waste-types"],
    queryFn: () => apiFetch<WasteType[]>("/waste-types", {}, false),
    staleTime: 60000,
  });

  const bookings = data?.items ?? [];

  useEffect(() => {
    setAfterCursor(null);
    setBeforeCursor(null);
  }, []);
  const selectedBooking =
    bookings.find((booking) => booking.id === collectBookingId) ?? null;

  useEffect(() => {
    if (!selectedBooking) return;
    setWeightKg(
      selectedBooking.actualWeightKg !== null &&
        selectedBooking.actualWeightKg !== undefined
        ? String(selectedBooking.actualWeightKg)
        : "",
    );
    setWasteCategoryId(selectedBooking.wasteCategory?.id ?? "");
  }, [selectedBooking]);

  const categoryOptions = useMemo(() => {
    const options = [...(wasteTypes ?? [])];
    const bookingWaste = selectedBooking?.wasteCategory;

    if (bookingWaste && !getWasteById(options, bookingWaste.id)) {
      options.push({
        id: bookingWaste.id,
        name: bookingWaste.name,
        slug: bookingWaste.slug || "",
        description: bookingWaste.description ?? null,
        minPriceLkrPerKg: null,
        maxPriceLkrPerKg: null,
        ratePerKg: null,
      });
    }

    return options;
  }, [wasteTypes, selectedBooking]);

  const selectedCategoryId =
    wasteCategoryId || selectedBooking?.wasteCategory?.id || "";
  const selectedWasteType = getWasteById(categoryOptions, selectedCategoryId);
  const numericWeight = Number(weightKg);
  const computedAmount =
    Number.isFinite(numericWeight) &&
    numericWeight > 0 &&
    selectedWasteType?.ratePerKg !== null &&
    selectedWasteType?.ratePerKg !== undefined
      ? numericWeight * selectedWasteType.ratePerKg
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

    if (
      wasteCategoryId &&
      wasteCategoryId !== selectedBooking.wasteCategory?.id
    ) {
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
        <Card>
          <Table className="md:min-w-[640px]">
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
                    <TableCell>
                      <Link
                        href={`/driver/bookings/${booking.id}`}
                        className="font-mono text-sm text-blue-600 hover:underline"
                      >
                        {booking.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {booking.user?.fullName ?? "Customer"}
                    </TableCell>
                    <TableCell>{booking.addressLine1}</TableCell>
                    <TableCell>
                      <div>
                        {new Date(booking.scheduledDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-(--muted)">
                        {booking.scheduledTimeSlot}
                      </div>
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
                          disabled={
                            !canDriverCollect(booking.status) || loading
                          }
                        >
                          {normalizedStatus === "COLLECTED"
                            ? "Collected / Edit"
                            : "Collected"}
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

      <Dialog
        open={Boolean(collectBookingId)}
        onOpenChange={(open) => !open && setCollectBookingId(null)}
      >
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
              <p className="text-sm font-medium">
                {selectedBooking?.id.slice(0, 8)}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--muted)">Waste Type</p>
              <select
                className="mt-1 h-10 w-full rounded-md border border-(--border) bg-(--card) px-3 text-sm"
                value={wasteCategoryId}
                onChange={(event) => setWasteCategoryId(event.target.value)}
              >
                {categoryOptions.map((waste) => (
                  <option key={waste.id} value={waste.id}>
                    {waste.name}
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
                {computedAmount === null
                  ? "LKR --"
                  : `LKR ${computedAmount.toFixed(2)}`}
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
            <Button
              onClick={submitCollect}
              disabled={collectMutation.isPending}
            >
              {collectMutation.isPending ? "Saving..." : "Confirm Collected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
