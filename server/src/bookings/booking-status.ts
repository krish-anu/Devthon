import { BookingStatus } from '@prisma/client';

export const CANONICAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.ASSIGNED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COLLECTED,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REFUNDED,
];

const LEGACY_BOOKING_STATUS_MAP: Partial<Record<BookingStatus, BookingStatus>> = {
  [BookingStatus.SCHEDULED]: BookingStatus.CREATED,
  [BookingStatus.PAID]: BookingStatus.COLLECTED,
};

const canonicalBookingStatusSet = new Set<BookingStatus>(
  CANONICAL_BOOKING_STATUSES,
);

export const BOOKING_STATUS_TRANSITIONS: Partial<
  Record<BookingStatus, BookingStatus[]>
> = {
  CREATED: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  ASSIGNED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  IN_PROGRESS: [BookingStatus.COLLECTED, BookingStatus.CANCELLED],
  COLLECTED: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [BookingStatus.REFUNDED],
  REFUNDED: [],
};

export type BookingTransitionActor = 'ADMIN' | 'DRIVER';

const ROLE_ALLOWED_TRANSITIONS: Record<
  BookingTransitionActor,
  Partial<Record<BookingStatus, BookingStatus[]>>
> = {
  ADMIN: {
    CREATED: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
    ASSIGNED: [BookingStatus.CANCELLED],
    IN_PROGRESS: [BookingStatus.CANCELLED],
    COLLECTED: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    CANCELLED: [BookingStatus.REFUNDED],
  },
  DRIVER: {
    ASSIGNED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    IN_PROGRESS: [BookingStatus.COLLECTED, BookingStatus.CANCELLED],
    COLLECTED: [BookingStatus.CANCELLED],
  },
};

export function isLegacyBookingStatus(status: BookingStatus) {
  return status in LEGACY_BOOKING_STATUS_MAP;
}

export function normalizeBookingStatus(status: BookingStatus) {
  return LEGACY_BOOKING_STATUS_MAP[status] ?? status;
}

export function isCanonicalBookingStatus(status: BookingStatus) {
  return canonicalBookingStatusSet.has(status);
}

export function expandBookingStatusFilter(status: BookingStatus) {
  const normalized = normalizeBookingStatus(status);
  if (normalized === BookingStatus.CREATED) {
    return [BookingStatus.CREATED, BookingStatus.SCHEDULED];
  }
  if (normalized === BookingStatus.COLLECTED) {
    return [BookingStatus.COLLECTED, BookingStatus.PAID];
  }
  return [normalized];
}

export function canTransition(from: BookingStatus, to: BookingStatus) {
  if (isLegacyBookingStatus(to)) return false;
  if (from === to) return true;

  const fromCanonical = normalizeBookingStatus(from);
  const toCanonical = normalizeBookingStatus(to);
  if (fromCanonical === toCanonical) return true;

  return (BOOKING_STATUS_TRANSITIONS[fromCanonical] ?? []).includes(toCanonical);
}

export function getTransitionError(from: BookingStatus, to: BookingStatus) {
  if (canTransition(from, to)) return null;
  return `Invalid status transition from ${normalizeBookingStatus(from)} to ${normalizeBookingStatus(to)}.`;
}

export function getRoleTransitionError(
  actor: BookingTransitionActor,
  from: BookingStatus,
  to: BookingStatus,
) {
  if (isLegacyBookingStatus(to)) {
    return `Legacy status ${to} is not allowed.`;
  }

  const fromCanonical = normalizeBookingStatus(from);
  const toCanonical = normalizeBookingStatus(to);

  if (fromCanonical === toCanonical) return null;
  if (!canTransition(fromCanonical, toCanonical)) {
    return getTransitionError(fromCanonical, toCanonical);
  }

  const allowed = ROLE_ALLOWED_TRANSITIONS[actor][fromCanonical] ?? [];
  if (!allowed.includes(toCanonical)) {
    return `Role ${actor} cannot move booking from ${fromCanonical} to ${toCanonical}.`;
  }

  return null;
}

export function isTerminalStatus(status: BookingStatus) {
  const normalized = normalizeBookingStatus(status);
  return (
    normalized === BookingStatus.COMPLETED ||
    normalized === BookingStatus.REFUNDED
  );
}
