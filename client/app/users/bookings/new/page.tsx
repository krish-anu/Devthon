"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking, PricingItem, WasteCategory } from "@/lib/types";
import { Card } from "@/components/ui/card";
import Loading from "@/components/shared/Loading";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { isValidSriLankaPhone, normalizeSriLankaPhone } from "@/lib/phone";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/auth/auth-provider";
import MapComponent from "@/components/shared/map";

const weightOptions = [
  { label: "1-5 kg", min: 1, max: 5 },
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
  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/public/pricing", {}, false),
  });

  const { data: categories } = useQuery({
    queryKey: ["public-waste-categories"],
    queryFn: () =>
      apiFetch<WasteCategory[]>("/public/waste-categories", {}, false),
  });

  const combinedPricing = useMemo(() => {
    const pricing = pricingData ?? [];
    const existingCatIds = new Set(pricing.map((p) => p.wasteCategory.id));
    const missing = (categories ?? [])
      .filter((c) => !existingCatIds.has(c.id))
      .map(
        (c) =>
          ({
            id: `new-${c.id}`,
            minPriceLkrPerKg: 0,
            maxPriceLkrPerKg: 0,
            isActive: false,
            wasteCategory: c,
          }) as PricingItem,
      );
    return [...pricing, ...missing];
  }, [pricingData, categories]);
  const { data: latestBookingData, isLoading: latestLoading } = useQuery({
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
  // images assigned specifically to categories (categoryId -> images)
  const [categoryImages, setCategoryImages] = useState<
    Record<string, { id: string; file: File; preview: string }[]>
  >({});
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
  const [mapLat, setMapLat] = useState<number>(6.9271);
  const [mapLng, setMapLng] = useState<number>(79.8612);

  const isPaperCategory = useMemo(() => {
    return selectedItems.some(
      (item) =>
        item.item.wasteCategory.name.toLowerCase().includes("paper") ||
        item.item.wasteCategory.name.toLowerCase().includes("cardboard"),
    );
  }, [selectedItems]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimate = useMemo(() => {
    if (selectedItems.length === 0) return { min: 0, max: 0 };
    let min = 0;
    let max = 0;
    for (const s of selectedItems) {
      const weight = isPaperCategory ? weightRange?.min || 0 : s.quantity;
      const weightMax = isPaperCategory ? weightRange?.max || 0 : s.quantity;
      min += s.item.minPriceLkrPerKg * weight;
      max += s.item.maxPriceLkrPerKg * weightMax;
    }
    return { min, max };
  }, [selectedItems, isPaperCategory, weightRange]);

  const latestBooking = latestBookingData?.items?.[0];

  // Pricing loader moved below so hooks are always called in the same order

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

  // Add images tied to a specific category (also adds them to the global uploadedImages list)
  const handleCategoryFileSelect = (
    categoryId: string,
    files: FileList | null,
  ) => {
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

    if (newImages.length === 0) return;

    // keep global uploaded list (so user can scan all images together)
    setUploadedImages((prev) => [...prev, ...newImages]);

    // add to the specific category
    setCategoryImages((prev) => {
      const existing = prev[categoryId] ?? [];
      return { ...prev, [categoryId]: [...existing, ...newImages] };
    });

    // Auto-select the category when the user uploads images for it
    const matchingPricing = combinedPricing.find(
      (p) => p.wasteCategory.id === categoryId,
    );
    if (matchingPricing) {
      setSelectedItems((prev) => {
        const exists = prev.find((s) => s.id === matchingPricing.id);
        if (exists) return prev;
        return [
          ...prev,
          { id: matchingPricing.id, item: matchingPricing, quantity: 1 },
        ];
      });
    }

    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Only the first ${maxFiles} images were added`,
        variant: "warning",
      });
    }
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
    setScanResults((prev) =>
      prev.filter((result) => result.imageId !== imageId),
    );

    // remove from any category assignments
    setCategoryImages((prev) => {
      const updated: Record<string, { id: string; file: File; preview: string }[]> = {};
      Object.entries(prev).forEach(([key, imgs]) => {
        const filtered = imgs.filter((i) => i.id !== imageId);
        if (filtered.length > 0) updated[key] = filtered;
      });
      return updated;
    });
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
          }>(
            "/public/classify-image",
            {
              method: "POST",
              body: JSON.stringify({ imageBase64: base64Data }),
            },
            false,
          );

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
        const matchingItem = combinedPricing.find(
          (item) => item.wasteCategory.id === categoryId,
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

    if (!isValidSriLankaPhone(phoneNumber)) {
      toast({
        title: "Invalid phone number",
        description:
          "Please enter a valid Sri Lanka phone number (e.g. +94 77 123 4567)",
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

    setIsSubmitting(true);
    try {
      await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          items: selectedItems.map((s) => ({
            wasteCategoryId: s.item.wasteCategory.id,
            quantityKg: isPaperCategory ? weightRange?.min || 0 : s.quantity,
          })),
          addressLine1,
          city,
          postalCode,
          specialInstructions,
          scheduledDate,
          scheduledTimeSlot,
          phone: normalizeSriLankaPhone(phoneNumber),
          lat: mapLat,
          lng: mapLng,
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
    } finally {
      setIsSubmitting(false);
    }
  };

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

  if (pricingLoading) {
    return (
      <div className="py-8">
        <Loading message="Loading pricing..." />
      </div>
    );
  }

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


          {/* Category Selection Grid */}
          <div className="space-y-2">
            {/* <Label className="text-sm font-semibold">
              {scanResults.length > 0
                ? "Detected Categories (You can modify selection):"
                : "Or Select Categories Manually:"}
            </Label> */}
            <div className="grid gap-4 md:grid-cols-3">
              {(combinedPricing ?? []).map((item) => {
                const isSelected = selectedItems.some((s) => s.id === item.id);
                const catId = item.wasteCategory.id;
                const imgsForCat = categoryImages[catId] ?? [];

                const toggleSelection = () => {
                  const exists = selectedItems.find((s) => s.id === item.id);
                  if (exists) {
                    setSelectedItems((prev) => prev.filter((p) => p.id !== item.id));
                  } else {
                    setSelectedItems((prev) => [
                      ...prev,
                      { id: item.id, item, quantity: 1 },
                    ]);
                  }
                };

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelection();
                      }
                    }}
                    onClick={toggleSelection}
                    className={`relative rounded-2xl border px-4 py-4 text-left ${
                      isSelected ? "border-(--brand) bg-(--brand)/10" : "border-(--border) bg-(--surface)"
                    }`}
                  >
                    {/* camera / per-category image picker */}
                    <div className="absolute right-3 top-3 flex items-center gap-2">
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center rounded-full bg-(--surface-strong) p-1 cursor-pointer"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            e.stopPropagation();
                            handleCategoryFileSelect(catId, e.target.files);
                            (e.target as HTMLInputElement).value = "";
                          }}
                          className="sr-only"
                        />
                        <svg
                          className="h-4 w-4 text-(--muted)"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l4-4h10l4 4M5 8v10a1 1 0 001 1h12a1 1 0 001-1V8M8 12l2 2 4-4"
                          />
                        </svg>
                      </label>

                      {imgsForCat.length > 0 && (
                        <div className="ml-2 inline-flex items-center rounded-full bg-(--brand) px-2 py-0.5 text-xs font-semibold text-white">
                          {imgsForCat.length}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <p className="text-lg font-semibold">{item.wasteCategory.name}</p>
                      <p className="text-xs text-(--muted)">
                        LKR {item.minPriceLkrPerKg} - {item.maxPriceLkrPerKg} / kg
                      </p>

                      {imgsForCat.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          {imgsForCat.slice(0, 3).map((img) => (
                            <img
                              key={img.id}
                              src={img.preview}
                              alt="preview"
                              className="h-8 w-8 rounded-md object-cover"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(img.id);
                              }}
                            />
                          ))}
                          {imgsForCat.length > 3 && (
                            <div className="h-8 w-8 flex items-center justify-center rounded-md bg-(--surface-strong) text-xs text-(--muted)">
                              +{imgsForCat.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-(--muted)">
                      {isSelected ? "Selected" : "Tap to add"}
                    </div>
                  </div>
                );
              })}
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
                <p className="text-sm font-semibold text-(--brand)">
                  Important Note
                </p>
                <p className="text-sm text-(--muted) mt-1">
                  Final prices may vary according to the quality, condition, and
                  actual weight of your product. The quoted prices are estimates
                  and will be confirmed after inspection.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && isPaperCategory && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">
            Estimate Weight of the Papers
          </h3>
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

      {((step === 3 && isPaperCategory) ||
        (step === 2 && !isPaperCategory)) && (
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
              <PhoneInput
                value={phoneNumber}
                onChange={(e: any) => setPhoneNumber(e.target.value)}
                placeholder="+94 77 123 4567"
                required
              />
              {!isValidSriLankaPhone(phoneNumber) && phoneNumber && (
                <p className="text-xs text-rose-500">
                  Enter a valid Sri Lanka phone number
                </p>
              )}
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
          <div className="h-96 rounded-2xl border border-(--border) bg-(--surface) overflow-hidden">
            <MapComponent
              initialLat={mapLat}
              initialLng={mapLng}
              onLocationSelect={(lat, lng) => {
                setMapLat(lat);
                setMapLng(lng);
                setLocationPicked(true);
              }}
            />
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

      {((step === 4 && isPaperCategory) ||
        (step === 3 && !isPaperCategory)) && (
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

      {((step === 5 && isPaperCategory) ||
        (step === 4 && !isPaperCategory)) && (
        <Card className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Booking Summary</h3>
            <p className="text-sm text-(--muted) mt-1">
              Please review all details before confirming
            </p>
          </div>

          {/* Waste Categories Summary */}
          <div className="rounded-xl border-2 border-(--brand) bg-(--brand)/5 p-4">
            <p className="text-sm font-semibold text-(--brand) mb-3">
              Waste Categories
            </p>
            <div className="space-y-2">
              {selectedItems.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {s.item.wasteCategory.name}
                    </p>
                    <p className="text-xs text-(--muted)">
                      {isPaperCategory
                        ? `Estimated weight: ${weightRange?.label || "Not specified"}`
                        : `Quantity: ${s.quantity} kg`}
                    </p>
                  </div>
                  <div className="text-sm text-(--muted)">
                    LKR{" "}
                    {(
                      s.item.minPriceLkrPerKg *
                      (isPaperCategory ? weightRange?.min || 1 : s.quantity)
                    ).toFixed(0)}{" "}
                    -{" "}
                    {(
                      s.item.maxPriceLkrPerKg *
                      (isPaperCategory ? weightRange?.max || 1 : s.quantity)
                    ).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Estimated Total */}
            <div className="rounded-xl border border-(--border) bg-(--surface) p-4">
              {isPaperCategory ? (
                <>
                  <p className="text-sm text-(--muted) mb-2">
                    Estimated Total Earnings
                  </p>
                  <p className="text-2xl font-bold text-(--brand)">
                    LKR {estimate.min.toFixed(0)} - {estimate.max.toFixed(0)}
                  </p>
                  <p className="text-xs text-(--muted) mt-1">
                    Final amount may change after quality inspection
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-(--muted) mb-2">Pricing</p>
                  <div className="flex items-start gap-2 mt-2">
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
                      <p className="text-sm font-semibold">
                        To be determined on-site
                      </p>
                      <p className="text-xs text-(--muted) mt-1">
                        Final pricing will be determined after physical
                        inspection based on the quality, condition, and actual
                        weight of your recyclables.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Weight Range */}
            {isPaperCategory && weightRange && (
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
                <p className="text-sm text-(--muted)">
                  {city}, {postalCode}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--muted)">Contact Number</p>
                <p className="text-sm font-medium">{phoneNumber}</p>
              </div>
              <div>
                <p className="text-xs text-(--muted)">Scheduled Date</p>
                <p className="text-sm font-medium">
                  {new Date(scheduledDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
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
          <div className="flex items-start gap-3 text-sm text-(--muted)">
            <Checkbox
              checked={terms}
              onCheckedChange={(checked) => setTerms(Boolean(checked))}
              className="mt-0.5"
            />
            <span className="leading-relaxed">
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-(--brand) hover:underline"
              >
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-(--brand) hover:underline"
              >
                Privacy Policy
              </Link>{" "}
              for waste pickup and recycling services.
            </span>
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
              const isPickupStep =
                (isPaperCategory && step === 3) ||
                (!isPaperCategory && step === 2);
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
                    description:
                      "Please confirm the map location before proceeding.",
                    variant: "warning",
                  });
                  return;
                }
              }
              const isDateStep =
                (isPaperCategory && step === 4) ||
                (!isPaperCategory && step === 3);
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Confirming...
              </>
            ) : (
              "Confirm Booking"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
