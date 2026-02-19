import {
  CanonicalBookingStatus,
  getBookingStatusLabel,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { BookingStatus, UserRole } from "@/lib/types";
import { cn } from '@/lib/utils';

const statusStyle: Record<CanonicalBookingStatus, { className: string }> = {
  CREATED: { className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400' },
  ASSIGNED: { className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
  IN_PROGRESS: { className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  COLLECTED: { className: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  COMPLETED: { className: 'bg-(--brand)/10 text-(--brand-strong) dark:bg-(--brand)/20 dark:text-(--brand)' },
  CANCELLED: { className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  REFUNDED: { className: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400' },
};

const customerCollectedStyle = {
  className:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
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
  const style = isCustomerPaymentDue
    ? customerCollectedStyle
    : (statusStyle[normalizedStatus] ?? {
        className: "bg-gray-100 text-gray-600",
      });
  const label = getBookingStatusLabel(status, viewerRole);
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      style.className,
      className
    )}>
      {label}
    </span>
  );
}
