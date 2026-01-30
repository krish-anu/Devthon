"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";

export default function BookingHistoryPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["bookings", status, search],
    queryFn: () =>
      apiFetch<{ items: Booking[] }>(
        `/bookings?${new URLSearchParams({
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
        }).toString()}`,
      ),
  });

  const bookings = data?.items ?? [];

  const metrics = useMemo(() => {
    const completed = bookings.filter((b) => b.status === "COMPLETED").length;
    const totalEarned = bookings.reduce(
      (sum, b) => sum + (b.finalAmountLkr ?? 0),
      0,
    );
    const totalWeight = bookings.reduce(
      (sum, b) => sum + (b.actualWeightKg ?? 0),
      0,
    );
    return { total: bookings.length, completed, totalEarned, totalWeight };
  }, [bookings]);

  const exportCsv = () => {
    const rows = bookings.map((booking) => [
      booking.id,
      booking.wasteCategory?.name ?? "",
      booking.actualWeightKg ?? "",
      booking.finalAmountLkr ?? booking.estimatedMaxAmount,
      booking.status,
      booking.createdAt,
    ]);
    const header = [
      "Booking ID",
      "Waste Type",
      "Weight",
      "Amount",
      "Status",
      "Date",
    ];
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booking-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <select className="h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--muted)]">
          <option>Last 30 Days</option>
          <option>Last 90 Days</option>
        </select>
        <select className="h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--muted)]">
          <option>All Types</option>
          <option>Plastic</option>
          <option>Metal</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--muted)]"
        >
          <option value="">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <Input
          placeholder="Search bookings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Bookings" value={`${metrics.total}`} />
        <KpiCard label="Completed" value={`${metrics.completed}`} />
        <KpiCard
          label="Total Earned"
          value={`LKR ${metrics.totalEarned.toFixed(0)}`}
        />
        <KpiCard
          label="Total Weight"
          value={`${metrics.totalWeight.toFixed(1)} kg`}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>Waste Type</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <a
                    href={`/users/bookings/${booking.id}`}
                    className="text-[color:var(--brand)]"
                  >
                    {booking.id.slice(0, 8)}
                  </a>
                </TableCell>
                <TableCell>
                  {booking.wasteCategory?.name ?? "Unknown"}
                </TableCell>
                <TableCell>{booking.actualWeightKg ?? "-"} kg</TableCell>
                <TableCell>
                  LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                </TableCell>
                <TableCell>
                  <StatusPill status={booking.status} />
                </TableCell>
                <TableCell>
                  {new Date(booking.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {!bookings.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-[color:var(--muted)]"
                >
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
          <span>Page 1 of 1</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Prev
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
