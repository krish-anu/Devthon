"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export default function DriverBookingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["driver-bookings-list"],
    queryFn: () => apiFetch<any[]>("/driver/bookings"),
  });

  const bookings = data ?? [];

  return (
    <div className="space-y-6">
      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={4} rows={5} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link
                      href={`/driver/bookings/${b.id}`}
                      className="text-(--brand)"
                    >
                      {b.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{b.user?.fullName ?? "Customer"}</TableCell>
                  <TableCell>{b.addressLine1}</TableCell>
                  <TableCell>{b.status}</TableCell>
                </TableRow>
              ))}
              {!bookings.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-(--muted)">
                    No bookings assigned.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
