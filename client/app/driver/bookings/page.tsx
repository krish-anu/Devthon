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
