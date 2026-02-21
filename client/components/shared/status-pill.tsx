import React from 'react';
import {
  CanonicalBookingStatus,
  getBookingStatusLabel,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { BookingStatus, UserRole } from "@/lib/types";
import { cn } from '@/lib/utils';

const statusStyle: Record<CanonicalBookingStatus, { style: React.CSSProperties }> = {
  CREATED:     { style: { backgroundColor: 'var(--status-created-bg)',     color: 'var(--status-created-text)' } },
  ASSIGNED:    { style: { backgroundColor: 'var(--status-assigned-bg)',    color: 'var(--status-assigned-text)' } },
  IN_PROGRESS: { style: { backgroundColor: 'var(--status-in-progress-bg)', color: 'var(--status-in-progress-text)' } },
  COLLECTED:   { style: { backgroundColor: 'var(--status-collected-bg)',   color: 'var(--status-collected-text)' } },
  COMPLETED:   { style: { backgroundColor: 'var(--status-completed-bg)',   color: 'var(--status-completed-text)' } },
  CANCELLED:   { style: { backgroundColor: 'var(--status-cancelled-bg)',   color: 'var(--status-cancelled-text)' } },
  REFUNDED:    { style: { backgroundColor: 'var(--status-refunded-bg)',    color: 'var(--status-refunded-text)' } },
};

const customerCollectedStyle = {
  style: { backgroundColor: 'var(--status-payment-due-bg)', color: 'var(--status-payment-due-text)' } as React.CSSProperties,
};

export function StatusPill({
  status,
  className,
  viewerRole,
}: {
  status: BookingStatus;
  className?: string;
  viewerRole?: UserRole;
}) {
  const normalizedStatus = normalizeBookingStatus(status);
  const isCustomerPaymentDue =
    viewerRole === "CUSTOMER" && normalizedStatus === "COLLECTED";
  const pillStyle = isCustomerPaymentDue
    ? customerCollectedStyle.style
    : (statusStyle[normalizedStatus]?.style ?? { backgroundColor: '#e5e7eb', color: '#374151' });
  const label = getBookingStatusLabel(status, viewerRole);
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', className)}
      style={pillStyle}
    >
      {label}
    </span>
  );
}
