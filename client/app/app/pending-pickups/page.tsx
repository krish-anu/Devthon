'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Booking } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PendingPickupsPage() {
  const { data } = useQuery({
    queryKey: ['pending-pickups'],
    queryFn: () => apiFetch<Booking[]>('/pickups/pending'),
  });

  const pickups = data ?? [];

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap gap-3">
        <div className="flex flex-1 flex-wrap gap-3">
          <input
            type="date"
            className="h-11 rounded-xl border border-white/10 bg-slate-950/40 px-4 text-sm text-white/70"
          />
          <input
            type="time"
            className="h-11 rounded-xl border border-white/10 bg-slate-950/40 px-4 text-sm text-white/70"
          />
          <input
            type="date"
            className="h-11 rounded-xl border border-white/10 bg-slate-950/40 px-4 text-sm text-white/70"
          />
          <input
            type="time"
            className="h-11 rounded-xl border border-white/10 bg-slate-950/40 px-4 text-sm text-white/70"
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time Slot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickups.map((pickup) => (
              <TableRow key={pickup.id}>
                <TableCell>{pickup.id.slice(0, 8)}</TableCell>
                <TableCell>{pickup.driver?.name ?? 'Assigned soon'}</TableCell>
                <TableCell>{pickup.driver?.phone ?? '--'}</TableCell>
                <TableCell>{pickup.addressLine1}</TableCell>
                <TableCell>{new Date(pickup.scheduledDate).toLocaleDateString()}</TableCell>
                <TableCell>{pickup.scheduledTimeSlot}</TableCell>
              </TableRow>
            ))}
            {!pickups.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-white/50">
                  No pending pickups.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
