import { BookingStatus } from '@prisma/client';

export const BOOKING_STATUS_TRANSITIONS: Record<
  BookingStatus,
  BookingStatus[]
> = {
  CREATED: [BookingStatus.SCHEDULED, BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  SCHEDULED: [
    BookingStatus.ASSIGNED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COLLECTED,
    BookingStatus.CANCELLED,
  ],
  ASSIGNED: [
    BookingStatus.IN_PROGRESS,
    BookingStatus.COLLECTED,
    BookingStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    BookingStatus.COLLECTED,
    BookingStatus.PAID,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  COLLECTED: [BookingStatus.PAID, BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  PAID: [BookingStatus.COMPLETED, BookingStatus.REFUNDED, BookingStatus.CANCELLED],
  COMPLETED: [BookingStatus.REFUNDED],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  if (from === to) return true;
  return (BOOKING_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function getTransitionError(from: BookingStatus, to: BookingStatus) {
  if (canTransition(from, to)) return null;
  return `Invalid status transition from ${from} to ${to}.`;
}

export function isTerminalStatus(status: BookingStatus) {
  return status === BookingStatus.CANCELLED || status === BookingStatus.REFUNDED;
}
