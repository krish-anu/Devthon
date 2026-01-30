"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { FileText, CheckCircle, DollarSign, Package } from "lucide-react";
import Link from "next/link";

export default function BookingHistoryPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

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

  const totalPages = Math.ceil(bookings.length / itemsPerPage);
  const paginatedBookings = bookings.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Booking History</h1>
        <p className="text-sm text-(--muted)">View all your past bookings and transactions</p>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-(--muted)">Date Range:</span>
          <select className="h-10 rounded-xl border border-(--border) bg-(--card) px-4 text-sm">
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
            <option>All Time</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-(--muted)">Category:</span>
          <select className="h-10 rounded-xl border border-(--border) bg-(--card) px-4 text-sm">
            <option>All Types</option>
            <option>Plastic</option>
            <option>Metal</option>
            <option>Paper</option>
            <option>E-Waste</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-(--muted)">Status:</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-xl border border-(--border) bg-(--card) px-4 text-sm"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
        <Input
          placeholder="Search bookings..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-48"
        />
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <FileText className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Total Bookings</p>
            <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Completed</p>
            <p className="text-2xl font-bold text-foreground">{metrics.completed}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <DollarSign className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Total Earned</p>
            <p className="text-2xl font-bold text-foreground">${metrics.totalEarned.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Package className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Total Weight</p>
            <p className="text-2xl font-bold text-foreground">{metrics.totalWeight.toLocaleString()} kg</p>
          </div>
        </Card>
      </div>

      {/* Bookings Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium text-foreground">
                  #BK-{booking.id.slice(0, 7).toUpperCase()}
                </TableCell>
                <TableCell className="text-(--muted)">
                  {new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                </TableCell>
                <TableCell className="text-(--muted)">
                  {booking.wasteCategory?.name ?? "Unknown"}
                </TableCell>
                <TableCell className="text-(--muted)">{booking.actualWeightKg ?? "-"} kg</TableCell>
                <TableCell>
                  <StatusPill status={booking.status} />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  ${(booking.finalAmountLkr ?? booking.estimatedMaxAmount)?.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild className="border-emerald-500 text-emerald-500 hover:bg-emerald-50">
                    <Link href={`/users/bookings/${booking.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!bookings.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-(--muted)">
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between border-t border-(--border) pt-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              &lt; Prev
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
              <Button 
                key={p}
                variant={page === p ? "default" : "outline"} 
                size="sm"
                onClick={() => setPage(p)}
                className={page === p ? "bg-emerald-500 text-white" : ""}
              >
                {p}
              </Button>
            ))}
            {totalPages > 5 && <span className="text-(--muted)">...</span>}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              Next &gt;
            </Button>
          </div>
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
