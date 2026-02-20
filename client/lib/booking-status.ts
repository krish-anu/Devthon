import { BookingStatus, UserRole } from "@/lib/types";

export type CanonicalBookingStatus =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COLLECTED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

const LEGACY_STATUS_MAP: Partial<Record<BookingStatus, CanonicalBookingStatus>> = {
  SCHEDULED: "CREATED",
  PAID: "COLLECTED",
};

const USER_LABELS: Record<CanonicalBookingStatus, string> = {
  CREATED: "Scheduled",
  ASSIGNED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COLLECTED: "Payment Due",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const INTERNAL_LABELS: Record<CanonicalBookingStatus, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COLLECTED: "Collected",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function normalizeBookingStatus(status: BookingStatus): CanonicalBookingStatus {
  return LEGACY_STATUS_MAP[status] ?? (status as CanonicalBookingStatus);
}

export function isBookingCompleted(status: BookingStatus) {
  return normalizeBookingStatus(status) === "COMPLETED";
}

export function getBookingStatusLabel(
  status: BookingStatus,
  viewerRole?: UserRole,
) {
  const normalized = normalizeBookingStatus(status);
  if (viewerRole === "CUSTOMER") {
    return USER_LABELS[normalized];
  }
  return INTERNAL_LABELS[normalized];
}

export function isUserPaymentDueStatus(status: BookingStatus) {
  return normalizeBookingStatus(status) === "COLLECTED";
}

export function canAdminAssign(status: BookingStatus) {
  return normalizeBookingStatus(status) === "CREATED";
}

export function canAdminComplete(status: BookingStatus) {
  return normalizeBookingStatus(status) === "COLLECTED";
}

export function canAdminCancel(status: BookingStatus) {
  return ["CREATED", "ASSIGNED", "IN_PROGRESS", "COLLECTED"].includes(
    normalizeBookingStatus(status),
  );
}

export function canAdminRefund(status: BookingStatus) {
  return normalizeBookingStatus(status) === "CANCELLED";
}

export function canDriverStart(status: BookingStatus) {
  return normalizeBookingStatus(status) === "ASSIGNED";
}

export function canDriverCollect(status: BookingStatus) {
  return ["IN_PROGRESS", "COLLECTED"].includes(normalizeBookingStatus(status));
}

export function canDriverCancel(status: BookingStatus) {
  return ["ASSIGNED", "IN_PROGRESS", "COLLECTED"].includes(
    normalizeBookingStatus(status),
  );
}
