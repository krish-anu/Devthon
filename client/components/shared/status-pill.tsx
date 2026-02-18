import { BookingStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusStyle: Record<BookingStatus, { label: string; className: string }> = {
  CREATED: { label: 'Created', className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  ASSIGNED: { label: 'Assigned', className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
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
