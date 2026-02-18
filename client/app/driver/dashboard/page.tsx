"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export default function DriverDashboardPage() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["driver-bookings"],
    queryFn: () => apiFetch<any[]>("/driver/bookings"),
    refetchInterval: 12000,
  });

  const bookings = data ?? [];

  const stats = useMemo(() => {
    const assigned = bookings.length;
    const scheduled = bookings.filter((b) =>
      ["CREATED", "SCHEDULED", "ASSIGNED"].includes(b.status),
    ).length;
    const onPickup = bookings.filter((b) =>
      ["IN_PROGRESS", "COLLECTED", "PAID"].includes(b.status),
    ).length;
    const completed = bookings.filter((b) => b.status === "COMPLETED").length;
    return { assigned, scheduled, onPickup, completed };
  }, [bookings]);

  const statusMutation = useMutation({
    mutationFn: (nextStatus: "ONLINE" | "OFFLINE") =>
      apiFetch("/driver/status", {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }),
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
  });

  const currentStatus = user?.driverStatus ?? "OFFLINE";
  const isOnPickup = currentStatus === "ON_PICKUP";
  const nextStatus = currentStatus === "ONLINE" ? "OFFLINE" : "ONLINE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-(--muted)">Driver status</p>
          <p className="text-lg font-semibold">{currentStatus}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => statusMutation.mutate(nextStatus)}
          disabled={statusMutation.isLoading || isOnPickup}
        >
          {currentStatus === "ONLINE" ? "Go offline" : "Go online"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
