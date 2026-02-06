import { BookingStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusStyle: Record<BookingStatus, { label: string; className: string }> = {
  SCHEDULED: { label: 'Scheduled', className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  COLLECTED: { label: 'Collected', className: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  PAID: { label: 'Paid', className: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  COMPLETED: { label: 'Completed', className: 'bg-(--brand)/10 text-(--brand-strong) dark:bg-(--brand)/20 dark:text-(--brand)' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  REFUNDED: { label: 'Refunded', className: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400' },
};

export function StatusPill({ status, className }: { status: BookingStatus; className?: string }) {
  const style = statusStyle[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      style.className,
      className
    )}>
      {style.label}
    </span>
  );
}
