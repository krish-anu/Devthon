"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare } from "lucide-react";

const steps = [
  "Booking Confirmed",
  "Driver Assigned",
  "Driver En Route",
  "Pickup Complete",
];

export default function BookingDetailsPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => apiFetch<Booking>(`/bookings/${id}`),
    enabled: Boolean(id),
  });

  const booking = data;

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
          <div className="text-sm text-(--muted)">
            Estimated Arrival 15 minutes
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step}
              className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3"
            >
              <p className="text-xs text-(--muted)">Step {index + 1}</p>
              <p className="text-sm font-semibold">{step}</p>
            </div>
          ))}
        </div>
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
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-(--border) bg-(--surface) text-sm text-(--muted)">
            Map Placeholder
          </div>
        </Card>
      </div>
    </div>
  );
}
