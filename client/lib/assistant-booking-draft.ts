export const ASSISTANT_BOOKING_DRAFT_KEY = "t2c-assistant-booking-draft";

export type AssistantBookingDraft = {
  wasteCategoryId?: string;
  wasteCategoryName?: string;
  quantityKg?: number;
  weightRangeLabel?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  specialInstructions?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  lat?: number;
  lng?: number;
  locationPicked?: boolean;
};

function isStringOrUndefined(value: unknown): value is string | undefined {
  return typeof value === "string" || typeof value === "undefined";
}

function isNumberOrUndefined(value: unknown): value is number | undefined {
  return typeof value === "number" || typeof value === "undefined";
}

function isBooleanOrUndefined(value: unknown): value is boolean | undefined {
  return typeof value === "boolean" || typeof value === "undefined";
}

export function isAssistantBookingDraft(
  value: unknown,
): value is AssistantBookingDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;

  return (
    isStringOrUndefined(draft.wasteCategoryId) &&
    isStringOrUndefined(draft.wasteCategoryName) &&
    isNumberOrUndefined(draft.quantityKg) &&
    isStringOrUndefined(draft.weightRangeLabel) &&
    isStringOrUndefined(draft.addressLine1) &&
    isStringOrUndefined(draft.city) &&
    isStringOrUndefined(draft.postalCode) &&
    isStringOrUndefined(draft.phone) &&
    isStringOrUndefined(draft.specialInstructions) &&
    isStringOrUndefined(draft.scheduledDate) &&
    isStringOrUndefined(draft.scheduledTimeSlot) &&
    isNumberOrUndefined(draft.lat) &&
    isNumberOrUndefined(draft.lng) &&
    isBooleanOrUndefined(draft.locationPicked)
  );
}

