"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking, PricingItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/auth/auth-provider";

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

const getTodayInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function NewBookingPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
  });
  const { data: latestBookingData } = useQuery({
    queryKey: ["bookings", "latest"],
    queryFn: () =>
      apiFetch<{ items: Booking[] }>("/bookings?page=1&pageSize=1"),
  });

  const [step, setStep] = useState(1);
  const [selectedItems, setSelectedItems] = useState<
    { id: string; item: PricingItem; quantity: number }[]
  >([]);
  const [uploadedImages, setUploadedImages] = useState<
    { id: string; file: File; preview: string }[]
  >([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<
    {
      imageId: string;
      categoryId: string;
      categoryName: string;
      confidence: string;
      message?: string;
    }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [weightRange, setWeightRange] = useState<
    (typeof weightOptions)[number] | null
  >(null);
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [scheduledDate, setScheduledDate] = useState(getTodayInputValue());
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState("");
  const [locationPicked, setLocationPicked] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [terms, setTerms] = useState(false);

  const estimate = useMemo(() => {
    if (selectedItems.length === 0) return { min: 0, max: 0 };
    let min = 0;
    let max = 0;
    for (const s of selectedItems) {
      min += s.item.minPriceLkrPerKg * s.quantity;
      max += s.item.maxPriceLkrPerKg * s.quantity;
    }
    return { min, max };
  }, [selectedItems]);

  const latestBooking = latestBookingData?.items?.[0];

  useEffect(() => {
    if (!latestBooking) return;
    setAddressLine1((prev) => prev || latestBooking.addressLine1 || "");
    setCity((prev) => prev || latestBooking.city || "");
    setPostalCode((prev) => prev || latestBooking.postalCode || "");
  }, [latestBooking]);

  useEffect(() => {
    if (!user?.phone) return;
    setPhoneNumber((prev) => prev || user.phone || "");
  }, [user]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: { id: string; file: File; preview: string }[] = [];
    const maxFiles = 10;

    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: `${file.name} is not an image file`,
          variant: "error",
        });
        continue;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 5MB`,
          variant: "error",
        });
        continue;
      }

      const id = Math.random().toString(36).substring(7);
      const preview = URL.createObjectURL(file);
      newImages.push({ id, file, preview });
    }

    setUploadedImages((prev) => [...prev, ...newImages]);
    
    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Only the first ${maxFiles} images were added`,
        variant: "warning",
      });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelect(event.dataTransfer.files);
  };

  const removeImage = (imageId: string) => {
    setUploadedImages((prev) => {
      const image = prev.find((img) => img.id === imageId);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== imageId);
    });
    setScanResults((prev) => prev.filter((result) => result.imageId !== imageId));
  };

  const handleScanImages = async () => {
    if (uploadedImages.length === 0) {
      toast({
        title: "No images",
        description: "Please upload at least one image to scan",
        variant: "warning",
      });
      return;
    }

    setIsScanning(true);
    setScanResults([]);
    const results: typeof scanResults = [];

    try {
      for (const image of uploadedImages) {
        // Convert to base64
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.split(",")[1]);
          };
          reader.readAsDataURL(image.file);
        });

        try {
          const response = await apiFetch<{
            categoryId: string;
            categoryName: string;
            confidence: string;
            message?: string;
          }>("/public/classify-image", {
            method: "POST",
            body: JSON.stringify({ imageBase64: base64Data }),
          }, false);

          results.push({
            imageId: image.id,
            categoryId: response.categoryId,
            categoryName: response.categoryName,
            confidence: response.confidence,
            message: response.message,
          });
        } catch (error: any) {
          results.push({
            imageId: image.id,
            categoryId: "",
            categoryName: "Error",
            confidence: "error",
            message: error?.message || "Classification failed",
          });
        }
      }

      setScanResults(results);

      // Auto-select detected categories
      const detectedCategoryIds = results
        .filter((r) => r.categoryId)
        .map((r) => r.categoryId);

      const uniqueCategoryIds = [...new Set(detectedCategoryIds)];

      uniqueCategoryIds.forEach((categoryId) => {
        const matchingItem = data?.find(
          (item) => item.wasteCategory.id === categoryId
        );

        if (matchingItem) {
          const exists = selectedItems.find((s) => s.id === matchingItem.id);
          if (!exists) {
            setSelectedItems((prev) => [
              ...prev,
              { id: matchingItem.id, item: matchingItem, quantity: 1 },
            ]);
          }
        }
      });

      toast({
        title: "Scan complete",
        description: `Successfully scanned ${uploadedImages.length} image(s)`,
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Scan failed",
        description: error?.message || "Could not scan images",
        variant: "error",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "Select a category", variant: "warning" });
      return;
    }
    if (isPaperCategory && !weightRange) {
      toast({ title: "Select a weight range", variant: "warning" });
      return;
    }
    if (!addressLine1 || !city || !postalCode) {
      toast({
        title: "Complete the pickup details",
        description: "Please fill all required address fields.",
        variant: "warning",
      });
      return;
    }
    if (!locationPicked) {
      toast({
        title: "Select a pickup location",
        description: "Please confirm the map location before proceeding.",
        variant: "warning",
      });
      return;
    }
    if (!scheduledDate || !scheduledTimeSlot) {
      toast({
        title: "Select date and time",
        description: "Please choose a pickup date and time slot.",
        variant: "warning",
      });
      return;
    }
    if (!phoneNumber) {
      toast({
        title: "Add contact number",
        description: "Please enter a phone number for pickup coordination.",
        variant: "warning",
      });
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
          items: selectedItems.map((s) => ({
            wasteCategoryId: s.item.wasteCategory.id,
            quantityKg: s.quantity,
          })),
          addressLine1,
          city,
          postalCode,
          specialInstructions,
          scheduledDate,
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

  const isPaperCategory = useMemo(() => {
    return selectedItems.some(
      (item) => item.item.wasteCategory.name.toLowerCase().includes("paper") ||
                item.item.wasteCategory.name.toLowerCase().includes("cardboard")
    );
  }, [selectedItems]);

  const steps = isPaperCategory
    ? [
        "Select Waste Categories",
        "Enter Quantities",
        "Pickup Details & Contact",
        "Select Date & Time",
        "Confirm Booking",
      ]
    : [
        "Select Waste Categories",
        "Pickup Details & Contact",
        "Select Date & Time",
        "Confirm Booking",
      ];

  const getActualStep = (currentStep: number) => {
    if (isPaperCategory) return currentStep;
    if (currentStep <= 1) return currentStep;
    return currentStep + 1; // Skip step 2 for non-paper
  };

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
          <h3 className="text-lg font-semibold">Select Waste Categories</h3>
          
          {/* Image Upload Section */}
          <div className="rounded-xl border border-(--border) bg-(--surface) p-6">
            <Label className="mb-4 block text-sm font-semibold">
              Upload Images to Auto-Detect Categories
            </Label>
            
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-(--brand) bg-(--brand)/5"
                  : "border-(--border) bg-(--surface-strong)"
              }`}
            >
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-(--brand)/10">
                  <svg
                    className="h-6 w-6 text-(--brand)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop images here, or click to browse
                  </p>
                  <p className="text-xs text-(--muted) mt-1">
                    Support for multiple images (max 10). PNG, JPG up to 5MB each
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </div>
            </div>

            {/* Uploaded Images Preview */}
            {uploadedImages.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Uploaded Images ({uploadedImages.length})
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      uploadedImages.forEach((img) =>
                        URL.revokeObjectURL(img.preview)
                      );
                      setUploadedImages([]);
                      setScanResults([]);
                    }}
                  >
                    Clear All
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {uploadedImages.map((image) => {
                    const result = scanResults.find(
                      (r) => r.imageId === image.id
                    );
                    return (
                      <div
                        key={image.id}
                        className="relative rounded-lg border border-(--border) bg-(--surface-strong) p-3"
                      >
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                        >
                          ×
                        </button>
                        <div className="aspect-square overflow-hidden rounded-md">
                          <img
                            src={image.preview}
                            alt="Waste preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        {result && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-(--muted)">Detected:</p>
                            <p className="text-sm font-semibold">
                              {result.categoryName}
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  result.confidence === "high"
                                    ? "bg-green-500"
                                    : result.confidence === "medium"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                              />
                              <span className="text-xs text-(--muted) capitalize">
                                {result.confidence}
                              </span>
                            </div>
                            {result.message && (
                              <p className="text-xs text-(--muted)">
                                {result.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Scan Button */}
                <Button
                  onClick={handleScanImages}
                  disabled={isScanning}
                  className="w-full"
                >
                  {isScanning ? (
                    <>
                      <svg
                        className="mr-2 h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Scanning {uploadedImages.length} image(s)...
                    </>
                  ) : (
                    <>
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      Scan Images
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Category Selection Grid */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              {scanResults.length > 0
                ? "Detected Categories (You can modify selection):"
                : "Or Select Categories Manually:"}
            </Label>
            <div className="grid gap-4 md:grid-cols-3">
              {(data ?? []).map((item) => (
                <button
                  key={item.id}
                  className={`rounded-2xl border px-4 py-4 text-left ${
                    selectedItems.some((s) => s.id === item.id)
                      ? "border-(--brand) bg-(--brand)/10"
                      : "border-(--border) bg-(--surface)"
                  }`}
                  onClick={() => {
                    const exists = selectedItems.find((s) => s.id === item.id);
                    if (exists) {
                      setSelectedItems((prev) =>
                        prev.filter((p) => p.id !== item.id),
                      );
                    } else {
                      setSelectedItems((prev) => [
                        ...prev,
                        { id: item.id, item, quantity: 1 },
                      ]);
                    }
                  }}
                >
                  <div className="flex-1 text-left">
                    <p className="text-lg font-semibold">
                      {item.wasteCategory.name}
                    </p>
                    <p className="text-xs text-(--muted)">
                      LKR {item.minPriceLkrPerKg} - {item.maxPriceLkrPerKg} / kg
                    </p>
                  </div>
                  <div className="text-sm text-(--muted)">
                    {selectedItems.find((s) => s.id === item.id)
                      ? "Selected"
                      : "Tap to add"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Price Variation Warning */}
          <div className="rounded-xl border-2 border-(--brand) bg-(--brand)/5 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-(--brand)"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-(--brand)">Important Note</p>
                <p className="text-sm text-(--muted) mt-1">
                  Final prices may vary according to the quality, condition, and actual weight of your product. The quoted prices are estimates and will be confirmed after inspection.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && isPaperCategory && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Estimate Weight</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {weightOptions.map((option) => (
              <button
                key={option.label}
                className={`rounded-xl border px-4 py-3 text-left ${
                  weightRange?.label === option.label
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

      {((step === 3 && isPaperCategory) || (step === 2 && !isPaperCategory)) && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Pickup Details & Contact</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Street Address *</Label>
              <Input
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>City *</Label>
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP *</Label>
              <Input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="Enter contact number"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Special Instructions (Optional)</Label>
              <Textarea
                value={specialInstructions}
                onChange={(event) => setSpecialInstructions(event.target.value)}
                placeholder="Any specific instructions for the pickup driver (e.g., gate code, building entrance)"
              />
            </div>
          </div>
          <div className="h-48 rounded-2xl border border-dashed border-(--border) bg-(--surface) p-4 text-sm text-(--muted)">
            Map Placeholder
          </div>
          <div className="flex items-center gap-3 text-sm text-(--muted)">
            <Checkbox
              checked={locationPicked}
              onCheckedChange={(checked) => setLocationPicked(Boolean(checked))}
            />
            I have selected the pickup location on the map.
          </div>
        </Card>
      )}

      {((step === 4 && isPaperCategory) || (step === 3 && !isPaperCategory)) && (
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

      {((step === 5 && isPaperCategory) || (step === 4 && !isPaperCategory)) && (
        <Card className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Booking Summary</h3>
            <p className="text-sm text-(--muted) mt-1">Please review all details before confirming</p>
          </div>

          {/* Waste Categories Summary */}
          <div className="rounded-xl border-2 border-(--brand) bg-(--brand)/5 p-4">
            <p className="text-sm font-semibold text-(--brand) mb-3">Waste Categories</p>
            <div className="space-y-2">
              {selectedItems.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {s.item.wasteCategory.name}
                    </p>
                    <p className="text-xs text-(--muted)">
                      {isPaperCategory ? `Quantity: ${s.quantity} kg` : `Estimated weight: ${weightRange?.label || 'Not specified'}`}
                    </p>
                  </div>
                  <div className="text-sm text-(--muted)">
                    LKR {(s.item.minPriceLkrPerKg * (isPaperCategory ? s.quantity : (weightRange?.min || 1))).toFixed(0)} -{" "}
                    {(s.item.maxPriceLkrPerKg * (isPaperCategory ? s.quantity : (weightRange?.max || 1))).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Estimated Total */}
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              <p className="text-sm text-(--muted) mb-2">Estimated Total Earnings</p>
              <p className="text-2xl font-bold text-(--brand)">
                LKR {estimate.min.toFixed(0)} - {estimate.max.toFixed(0)}
              </p>
              <p className="text-xs text-(--muted) mt-1">Final amount may change after quality inspection</p>
            </div>

            {/* Weight Range */}
            {!isPaperCategory && weightRange && (
              <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
                <p className="text-sm text-(--muted) mb-2">Estimated Weight</p>
                <p className="text-lg font-semibold">{weightRange.label}</p>
              </div>
            )}
          </div>

          {/* Pickup Details */}
          <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
            <p className="text-sm font-semibold mb-3">Pickup Details</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-(--muted)">Address</p>
                <p className="text-sm font-medium">{addressLine1}</p>
                <p className="text-sm text-(--muted)">{city}, {postalCode}</p>
              </div>
              <div>
                <p className="text-xs text-(--muted)">Contact Number</p>
                <p className="text-sm font-medium">{phoneNumber}</p>
              </div>
              <div>
                <p className="text-xs text-(--muted)">Scheduled Date</p>
                <p className="text-sm font-medium">{new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs text-(--muted)">Time Slot</p>
                <p className="text-sm font-medium">{scheduledTimeSlot}</p>
              </div>
              {specialInstructions && (
                <div className="md:col-span-2">
                  <p className="text-xs text-(--muted)">Special Instructions</p>
                  <p className="text-sm font-medium">{specialInstructions}</p>
                </div>
              )}
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
          disabled={step === 1}
        >
          Back
        </Button>
        {step < steps.length ? (
          <Button
            onClick={() => {
              if (step === 1 && selectedItems.length === 0) {
                toast({ title: "Select a category", variant: "warning" });
                return;
              }
              if (step === 2 && isPaperCategory && !weightRange) {
                toast({ title: "Select a weight range", variant: "warning" });
                return;
              }
              const isPickupStep = (isPaperCategory && step === 3) || (!isPaperCategory && step === 2);
              if (isPickupStep) {
                if (!addressLine1 || !city || !postalCode) {
                  toast({
                    title: "Complete the pickup details",
                    description: "Please fill all required address fields.",
                    variant: "warning",
                  });
                  return;
                }
                if (!phoneNumber) {
                  toast({
                    title: "Phone number required",
                    description: "Please enter your contact number.",
                    variant: "warning",
                  });
                  return;
                }
                if (!locationPicked) {
                  toast({
                    title: "Select a pickup location",
                    description: "Please confirm the map location before proceeding.",
                    variant: "warning",
                  });
                  return;
                }
              }
              const isDateStep = (isPaperCategory && step === 4) || (!isPaperCategory && step === 3);
              if (isDateStep && (!scheduledDate || !scheduledTimeSlot)) {
                toast({
                  title: "Select date and time",
                  description: "Please choose a pickup date and time slot.",
                  variant: "warning",
                });
                return;
              }
              setStep((s) => Math.min(steps.length, s + 1));
            }}
          >
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit}>Confirm Booking</Button>
        )}
      </div>
    </div>
  );
}
