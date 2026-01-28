'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusPill } from '@/components/shared/status-pill';

export default function AdminBookingsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-bookings', status, search],
    queryFn: () =>
      apiFetch<any[]>(`/admin/bookings?${new URLSearchParams({
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      }).toString()}`),
  });

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {['All Status', 'This Month', 'SCHEDULED', 'COMPLETED', 'CANCELLED'].map((pill) => (
            <Button
              key={pill}
              variant={status === (pill === 'All Status' ? '' : pill) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus(pill === 'All Status' || pill === 'This Month' ? '' : pill)}
            >
              {pill}
            </Button>
          ))}
        </div>
        <Input placeholder="Search bookings" value={search} onChange={(event) => setSearch(event.target.value)} />
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>{booking.id.slice(0, 8)}</TableCell>
                <TableCell>{booking.user?.fullName ?? '--'}</TableCell>
                <TableCell>{booking.wasteCategory?.name ?? '--'}</TableCell>
                <TableCell>{booking.actualWeightKg ?? '-'} kg</TableCell>
                <TableCell>LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}</TableCell>
                <TableCell>{booking.driver?.name ?? 'Unassigned'}</TableCell>
                <TableCell><StatusPill status={booking.status} /></TableCell>
                <TableCell>{new Date(booking.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
