"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { apiFetch } from "@/lib/api";
import { Booking } from "@/lib/types";
import {
  isBookingCompleted,
  isUserPaymentDueStatus,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Loading from "@/components/shared/Loading";
import { StatusPill } from "@/components/shared/status-pill";
import { Phone, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const steps = [
  "Booking Confirmed",
  "Driver Assigned",
  "Driver En Route",
  "Pickup Complete",
];

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
    onError: (
      _err,
      _vars,
      context: { previous?: { items: Booking[] } } | undefined,
    ) => {
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
  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    const latLng = event?.latLng;
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
  const isCollectedPendingCompletion = Boolean(
    booking &&
      isUserPaymentDueStatus(booking.status) &&
      !isBookingCompleted(booking.status),
  );
  const canShowFinalCollectionDetails = Boolean(
    booking && isBookingCompleted(booking.status),
  );
  const displayCollectedWeight =
    booking &&
    canShowFinalCollectionDetails &&
    typeof booking.actualWeightKg === "number"
      ? `${booking.actualWeightKg} kg`
      : "-";
  const displayCollectedAmount =
    booking &&
    canShowFinalCollectionDetails &&
    typeof booking.finalAmountLkr === "number"
      ? `LKR ${booking.finalAmountLkr.toFixed(2)}`
      : "LKR 0.00";

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
              {displayCollectedWeight}
            </p>
            <p className="text-xs text-(--muted)">
              Amount: {displayCollectedAmount}
            </p>
          </div>
    </div>

        {booking?.imageUrls && booking.imageUrls.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {booking.imageUrls!.map((src) => (
              <img key={src} src={src} className="h-20 w-full rounded-md object-cover" alt="booking" />
            ))}
          </div>
        )}

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
        {isCollectedPendingCompletion && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            Pickup is collected. Final weight and amount will appear once this booking is completed.
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
              Rating: {booking?.driver?.rating ?? "4.7"}/5
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
