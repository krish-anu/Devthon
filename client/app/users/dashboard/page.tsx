"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking } from "@/lib/types";
import { Card } from "@/components/ui/card";
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
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { DollarSign, Package, Truck, Leaf } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["bookings", "recent"],
    queryFn: () => apiFetch<{ items: Booking[] }>("/bookings"),
  });

  const bookings = data?.items ?? [];

  const metrics = useMemo(() => {
    const totalEarned = bookings.reduce(
      (sum, booking) => sum + (booking.finalAmountLkr ?? 0),
      0,
    );
    const totalWeight = bookings.reduce(
      (sum, booking) => sum + (booking.actualWeightKg ?? 0),
      0,
    );
    const pending = bookings.filter(
      (booking) => booking.status === "SCHEDULED",
    ).length;
    const co2 = Math.round(totalWeight * 1.7);
    return { totalEarned, totalWeight, pending, co2 };
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.fullName?.split(" ")[0] ?? "User"}!
        </h1>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
          {user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2) ?? "U"}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <DollarSign className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Total Earned</p>
            <p className="text-xl font-bold text-foreground">LKR {metrics.totalEarned.toLocaleString()}</p>
            <p className="text-xs text-emerald-500">+12% this month</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Package className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Total waste</p>
            <p className="text-xl font-bold text-foreground">{metrics.totalWeight.toFixed(1)} kg</p>
            <p className="text-xs text-(--muted)">Across {bookings.length} pickups</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Truck className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">Pending Pickups</p>
            <p className="text-xl font-bold text-foreground">{metrics.pending}</p>
            <p className="text-xs text-(--muted)">Next: Tomorrow</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Leaf className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-(--muted)">CO₂ Saved</p>
            <p className="text-xl font-bold text-foreground">{metrics.co2} kg</p>
            <p className="text-xs text-(--muted)">Environmental Impact</p>
          </div>
        </Card>
      </div>

      {/* CTA Banner */}
      <Card className="flex flex-col justify-between gap-4 bg-linear-to-r from-emerald-500 to-emerald-600 md:flex-row md:items-center">
        <div className="text-white">
          <h3 className="text-xl font-bold">Ready for another pickup?</h3>
          <p className="text-sm text-emerald-100">
            Schedule a collection and start earning today
          </p>
        </div>
        <Button asChild className="bg-white text-emerald-600 hover:bg-emerald-50">
          <Link href="/users/bookings/new">+ Book New Pickup</Link>
        </Button>
      </Card>

      {/* Recent Bookings Table */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Recent Bookings</h3>
          <Link href="/users/bookings" className="text-sm font-medium text-emerald-500 hover:underline">
            View All →
          </Link>
        </div>
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
            {bookings.slice(0, 5).map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/users/bookings/${booking.id}`}
                    className="text-foreground hover:text-emerald-500"
                  >
                    {booking.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell className="text-(--muted)">
                  {booking.wasteCategory?.name ?? "Unknown"}
                </TableCell>
                <TableCell className="text-(--muted)">{booking.actualWeightKg ?? "-"} kg</TableCell>
                <TableCell className="font-medium text-foreground">
                  LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                </TableCell>
                <TableCell>
                  <StatusPill status={booking.status} />
                </TableCell>
                <TableCell className="text-(--muted)">
                  {new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </TableCell>
              </TableRow>
            ))}
            {!bookings.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-(--muted)">
                  No bookings yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
