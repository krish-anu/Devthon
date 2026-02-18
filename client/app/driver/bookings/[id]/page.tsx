"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking, BookingStatus, WasteCategory } from "@/lib/types";
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

  const [weightKg, setWeightKg] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [wasteCategoryId, setWasteCategoryId] = useState("");

  useEffect(() => {
    if (!booking) return;
    setWeightKg(
      booking.actualWeightKg !== null && booking.actualWeightKg !== undefined
        ? String(booking.actualWeightKg)
        : "",
    );
    setFinalAmount(
      booking.finalAmountLkr !== null && booking.finalAmountLkr !== undefined
        ? String(booking.finalAmountLkr)
        : "",
    );
    setWasteCategoryId(booking.wasteCategory?.id ?? "");
  }, [booking]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(`/driver/bookings/${bookingId}/update`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "Booking updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["driver-booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["driver-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["driver-bookings-list"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Failed to update booking.",
        variant: "error",
      });
    },
  });

  const status = booking?.status as BookingStatus | undefined;

  const canStart =
    status &&
    ["SCHEDULED", "ASSIGNED", "CREATED"].includes(status) &&
    !updateMutation.isPending;

  const canComplete =
    status &&
    ["IN_PROGRESS", "COLLECTED", "PAID"].includes(status) &&
    !updateMutation.isPending;

  const handleUpdate = (nextStatus?: BookingStatus) => {
    if (!bookingId) return;
    const payload: Record<string, unknown> = {};
    const weightValue = Number(weightKg);
    const amountValue = Number(finalAmount);

    if (!Number.isNaN(weightValue) && weightKg !== "") {
      payload.actualWeightKg = weightValue;
    }
    if (!Number.isNaN(amountValue) && finalAmount !== "") {
      payload.finalAmountLkr = amountValue;
    }
    if (wasteCategoryId) {
      payload.wasteCategoryId = wasteCategoryId;
    }
    if (nextStatus) {
      payload.status = nextStatus;
    }

    updateMutation.mutate(payload);
  };

  const categoryOptions = useMemo(() => categories ?? [], [categories]);

  if (isLoading || !booking) {
    return (
      <Card className="p-6">
        <Loading message="Loading booking details..." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-(--muted)">Booking</p>
          <h1 className="text-2xl font-semibold">
            {booking.id.slice(0, 8)}
          </h1>
        </div>
        <StatusPill status={booking.status} />
      </div>

      <Card className="p-4 space-y-2">
        <div className="text-sm text-(--muted)">Customer</div>
        <div className="text-base font-medium">
          {booking.user?.fullName ?? "Customer"}
        </div>
        <div className="text-sm text-(--muted)">Address</div>
        <div className="text-base">{booking.addressLine1}</div>
        <div className="text-sm text-(--muted)">Scheduled</div>
        <div className="text-base">
          {new Date(booking.scheduledDate).toLocaleString()} (
          {booking.scheduledTimeSlot})
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs text-(--muted)">Weight (kg)</label>
            <Input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 12.5"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-(--muted)">Final amount (LKR)</label>
            <Input
              value={finalAmount}
              onChange={(e) => setFinalAmount(e.target.value)}
              placeholder="Auto-calculated if empty"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-(--muted)">Waste category</label>
            <select
              className="h-11 w-full rounded-xl border border-(--border) bg-(--card) px-3 text-sm"
              value={wasteCategoryId}
              onChange={(event) => setWasteCategoryId(event.target.value)}
            >
              <option value="">Select category</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => handleUpdate()}
            disabled={updateMutation.isPending}
          >
            Save updates
          </Button>
          <Button onClick={() => handleUpdate("IN_PROGRESS")} disabled={!canStart}>
            Start pickup
          </Button>
          <Button onClick={() => handleUpdate("COMPLETED")} disabled={!canComplete}>
            Mark completed
          </Button>
        </div>
      </Card>
    </div>
  );
}
