import { Badge } from '@/components/ui/badge';
import { BookingStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusStyle: Record<BookingStatus, { label: string; variant: 'default' | 'warning' | 'danger' | 'info' }> = {
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  COLLECTED: { label: 'Collected', variant: 'info' },
  PAID: { label: 'Paid', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  REFUNDED: { label: 'Refunded', variant: 'warning' },
};

export function StatusPill({ status, className }: { status: BookingStatus; className?: string }) {
  const style = statusStyle[status] ?? { label: status, variant: 'default' };
  return (
    <Badge variant={style.variant} className={cn('uppercase tracking-wide', className)}>
      {style.label}
    </Badge>
  );
}
