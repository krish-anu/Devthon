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
import { Booking, WasteType } from "@/lib/types";
import { getWasteById } from "@/lib/wasteTypeUtils";
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

  const { data: wasteTypes } = useQuery({
    queryKey: ["waste-types"],
    queryFn: () => apiFetch<WasteType[]>("/waste-types", {}, false),
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

  const categoryOptions = useMemo(() => {
    const options = [...(wasteTypes ?? [])];
    const bookingWaste = booking?.wasteCategory;

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
  }, [wasteTypes, booking]);

  const selectedCategoryId = wasteCategoryId || booking?.wasteCategory?.id || "";
  const selectedWasteType = getWasteById(categoryOptions, selectedCategoryId);
  const numericWeight = Number(weightKg);
  const computedAmount =
    Number.isFinite(numericWeight) &&
    numericWeight > 0 &&
    selectedWasteType?.ratePerKg !== null &&
    selectedWasteType?.ratePerKg !== undefined
      ? numericWeight * selectedWasteType.ratePerKg
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
        <div className="text-base font-medium">
          {booking.user?.fullName ?? "Customer"}
        </div>

        {booking.imageUrls && booking.imageUrls.length > 0 && (
          <div className="mt-2 flex gap-2">
            {booking.imageUrls!.map((src) => (
              <img key={src} src={src} className="h-12 w-12 rounded-md object-cover" alt="booking" />
            ))}
          </div>
        )}

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
