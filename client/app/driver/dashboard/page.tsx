"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import Loading from "@/components/shared/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DriverDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["driver-bookings"],
    queryFn: () => apiFetch<any[]>("/driver/bookings"),
  });

  const bookings = data ?? [];

  const stats = useMemo(() => {
    const assigned = bookings.length;
    const scheduled = bookings.filter((b) => b.status === "SCHEDULED").length;
    const onPickup = bookings.filter(
      (b) => b.status === "IN_PROGRESS" || b.status === "ON_PICKUP",
    ).length;
    const completed = bookings.filter((b) => b.status === "COMPLETED").length;
    return { assigned, scheduled, onPickup, completed };
  }, [bookings]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Assigned" value={`${stats.assigned}`} />
        <KpiCard label="Scheduled" value={`${stats.scheduled}`} />
        <KpiCard label="On Pickup" value={`${stats.onPickup}`} />
        <KpiCard label="Completed" value={`${stats.completed}`} />
      </div>

      {isLoading ? (
        <Card className="p-6">
          <Loading message="Loading dashboard..." />
        </Card>
      ) : (
        <Card>
          <div className="mt-2 overflow-x-auto -mx-6 sm:mx-0">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.id.slice(0, 8)}</TableCell>
                    <TableCell>{b.addressLine1}</TableCell>
                    <TableCell>{b.actualWeightKg ?? "-"} kg</TableCell>
                    <TableCell>{b.status}</TableCell>
                    <TableCell>
                      {new Date(
                        b.scheduledDate || b.createdAt,
                      ).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!bookings.length && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-(--muted)"
                    >
                      No assigned pickups.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
