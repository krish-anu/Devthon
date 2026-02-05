"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PricingItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

const weightOptions = [
  { label: "0-5 kg", min: 0, max: 5 },
  { label: "5-10 kg", min: 5, max: 10 },
  { label: "10-20 kg", min: 10, max: 20 },
  { label: "20-50 kg", min: 20, max: 50 },
  { label: "50+ kg", min: 50, max: 80 },
];

const timeSlots = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "6:00 PM - 8:00 PM",
];

export default function NewBookingPage() {
  const { data } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
  });

  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<PricingItem | null>(
    null,
  );
  const [weightRange, setWeightRange] = useState(weightOptions[1]);
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(timeSlots[1]);
  const [terms, setTerms] = useState(false);

  const estimate = useMemo(() => {
    if (!selectedCategory) return { min: 0, max: 0 };
    const min = selectedCategory.minPriceLkrPerKg * weightRange.min;
    const max = selectedCategory.maxPriceLkrPerKg * weightRange.max;
    return { min, max };
  }, [selectedCategory, weightRange]);

  const handleSubmit = async () => {
    if (!selectedCategory) {
      toast({ title: "Select a category", variant: "warning" });
      return;
    }
    if (!terms) {
      toast({
        title: "Accept terms",
        description: "You must accept the terms before confirming.",
        variant: "warning",
      });
      return;
    }

    try {
      await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          wasteCategoryId: selectedCategory.wasteCategory.id,
          estimatedWeightRange: weightRange.label,
          estimatedMinAmount: estimate.min,
          estimatedMaxAmount: estimate.max,
          addressLine1,
          city,
          postalCode,
          specialInstructions,
          scheduledDate: scheduledDate || new Date().toISOString(),
          scheduledTimeSlot,
        }),
      });
      toast({
        title: "Booking confirmed",
        description: "Your pickup is scheduled.",
        variant: "success",
      });
      window.location.href = "/users/bookings";
    } catch (error: any) {
      toast({
        title: "Booking failed",
        description: error?.message,
        variant: "error",
      });
    }
  };

  const steps = [
    "Select Waste Category",
    "Estimate Weight",
    "Pickup Location",
    "Select Date & Time",
    "Confirm Booking",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  step === index + 1
                    ? "bg-(--brand) text-slate-950"
                    : "bg-(--surface-strong) text-(--muted)"
                }`}
              >
                {index + 1}
              </div>
              <span className="text-xs text-(--muted)">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {step === 1 && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Select Waste Category</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {(data ?? []).map((item) => (
              <button
                key={item.id}
                className={`rounded-2xl border px-4 py-4 text-left ${
                  selectedCategory?.id === item.id
                    ? "border-(--brand) bg-(--brand)/10"
                    : "border-(--border) bg-(--surface)"
                }`}
                onClick={() => setSelectedCategory(item)}
              >
                <p className="text-lg font-semibold">
                  {item.wasteCategory.name}
                </p>
                <p className="text-xs text-(--muted)">
                  LKR {item.minPriceLkrPerKg} - {item.maxPriceLkrPerKg} / kg
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Estimate Weight</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {weightOptions.map((option) => (
              <button
                key={option.label}
                className={`rounded-xl border px-4 py-3 text-left ${
                  weightRange.label === option.label
                    ? "border-(--brand) bg-(--brand)/10"
                    : "border-(--border) bg-(--surface)"
                }`}
                onClick={() => setWeightRange(option)}
              >
                <p className="text-sm font-semibold">{option.label}</p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--muted)">
            Estimated earnings: LKR {estimate.min.toFixed(0)} -{" "}
            {estimate.max.toFixed(0)}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Pickup Location</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <Textarea
                value={specialInstructions}
                onChange={(event) => setSpecialInstructions(event.target.value)}
              />
            </div>
          </div>
          <div className="h-48 rounded-2xl border border-dashed border-(--border) bg-(--surface) p-4 text-sm text-(--muted)">
            Map Placeholder
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Select Date & Time</h3>
          <div className="space-y-4">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-3">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setScheduledTimeSlot(slot)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm ${
                    scheduledTimeSlot === slot
                      ? "border-(--brand) bg-(--brand)/10"
                      : "border-(--border) bg-(--surface)"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Confirm Booking</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              <p className="text-sm text-(--muted)">Category</p>
              <p className="text-lg font-semibold">
                {selectedCategory?.wasteCategory.name ?? "--"}
              </p>
            </div>
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              <p className="text-sm text-(--muted)">Estimated Weight</p>
              <p className="text-lg font-semibold">{weightRange.label}</p>
            </div>
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              <p className="text-sm text-(--muted)">Pickup Address</p>
              <p className="text-lg font-semibold">{addressLine1 || "--"}</p>
              <p className="text-sm text-(--muted)">
                {city} {postalCode}
              </p>
            </div>
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              <p className="text-sm text-(--muted)">Time Slot</p>
              <p className="text-lg font-semibold">{scheduledTimeSlot}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-(--muted)">
            <Checkbox
              checked={terms}
              onCheckedChange={(checked) => setTerms(Boolean(checked))}
            />
            I agree to the pickup terms and quality inspection policy.
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          Back
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep((s) => Math.min(5, s + 1))}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit}>Confirm Booking</Button>
        )}
      </div>
    </div>
  );
}
