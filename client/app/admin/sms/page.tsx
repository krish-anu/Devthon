"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { useToast } from "@/components/ui/use-toast";
import type { BookingStatus } from "@/lib/types";
import { MessageSquare, Send, CheckCheck, RefreshCw } from "lucide-react";

interface Booking {
  id: string;
  status: string;
  createdAt: string;
  scheduledDate: string;
  estimatedMaxAmount: number;
  finalAmountLkr: number | null;
  actualWeightKg: number | null;
  user?: { fullName: string; phone: string; email: string };
  wasteCategory?: { name: string };
  driver?: { name: string };
}

export default function AdminSmsPage() {
  const { toast } = useToast();

  // Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "thisMonth" | "thisWeek"
  >("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Selection state
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());

  // Message state
  const [message, setMessage] = useState("");

  // Fetch bookings with filters
  const {
    data: bookings,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "admin-sms-bookings",
      status,
      search,
      dateFilter,
      fromDate,
      toDate,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      if (dateFilter === "thisMonth") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        params.append("from", firstDay.toISOString().split("T")[0]);
        params.append("to", lastDay.toISOString().split("T")[0]);
      } else if (dateFilter === "thisWeek") {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        params.append("from", startOfWeek.toISOString().split("T")[0]);
        params.append("to", endOfWeek.toISOString().split("T")[0]);
      } else if (fromDate || toDate) {
        if (fromDate) params.append("from", fromDate);
        if (toDate) params.append("to", toDate);
      }

      return apiFetch<Booking[]>(`/admin/bookings?${params.toString()}`);
    },
  });

  // Fetch SMS balance
  const { data: balanceData } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: () => apiFetch<any>("/admin/sms/balance"),
  });

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: (payload: { phoneNumbers: string[]; message: string }) =>
      apiFetch<any>("/admin/sms/send", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      if (data.status === "success") {
        toast({
          title: "SMS Sent Successfully!",
          description: `Message sent to ${selectedPhones.size} recipient(s).`,
        });
        setSelectedPhones(new Set());
        setMessage("");
      } else {
        toast({
          title: "SMS Failed",
          description: data.message || "Failed to send SMS.",
          variant: "error",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "error",
      });
    },
  });

  // Get unique phone numbers from bookings
  const uniqueBookingsWithPhones = (bookings ?? []).filter(
    (b) => b.user?.phone,
  );

  const allPhoneNumbers = [
    ...new Set(uniqueBookingsWithPhones.map((b) => b.user!.phone)),
  ];

  const handleSelectAll = () => {
    if (selectedPhones.size === allPhoneNumbers.length) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(allPhoneNumbers));
    }
  };

  const handleTogglePhone = (phone: string) => {
    const next = new Set(selectedPhones);
    if (next.has(phone)) {
      next.delete(phone);
    } else {
      next.add(phone);
    }
    setSelectedPhones(next);
  };

  const handleSendSms = () => {
    if (selectedPhones.size === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one phone number.",
        variant: "error",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: "No message",
        description: "Please type a message to send.",
        variant: "error",
      });
      return;
    }

    sendSmsMutation.mutate({
      phoneNumbers: Array.from(selectedPhones),
      message: message.trim(),
    });
  };

  const statusOptions = [
    "SCHEDULED",
    "COLLECTED",
    "PAID",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-(--brand)" />
          <div>
            <h1 className="text-2xl font-bold">SMS Messaging</h1>
            <p className="text-sm text-muted-foreground">
              Send SMS to customers via Text.lk
            </p>
          </div>
        </div>
        {balanceData?.data && (
          <div className="rounded-lg border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">SMS Balance: </span>
            <span className="font-bold text-emerald-600">
              {typeof balanceData.data === "object"
                ? JSON.stringify(
                    balanceData.data.remaining_unit ?? balanceData.data,
                  )
                : balanceData.data}{" "}
              units
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Filter Bookings
        </h3>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={
              status === "" && dateFilter === "all" && !fromDate && !toDate
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() => {
              setStatus("");
              setDateFilter("all");
              setFromDate("");
              setToDate("");
            }}
          >
            All
          </Button>
          {statusOptions.map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(s);
                setDateFilter("all");
              }}
            >
              {s}
            </Button>
          ))}
        </div>

        {/* Date and search filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <Button
              variant={dateFilter === "thisWeek" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilter("thisWeek");
                setFromDate("");
                setToDate("");
              }}
            >
              This Week
            </Button>
            <Button
              variant={dateFilter === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateFilter("thisMonth");
                setFromDate("");
                setToDate("");
              }}
            >
              This Month
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              className="w-40"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDateFilter("all");
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              className="w-40"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDateFilter("all");
              }}
            />
          </div>

          <Input
            placeholder="Search bookings..."
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Bookings Table with Checkboxes */}
      <Card className="p-0 overflow-hidden">
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      allPhoneNumbers.length > 0 &&
                      selectedPhones.size === allPhoneNumbers.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading bookings...
                  </TableCell>
                </TableRow>
              ) : uniqueBookingsWithPhones.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No bookings found. Adjust your filters.
                  </TableCell>
                </TableRow>
              ) : (
                uniqueBookingsWithPhones.map((booking) => (
                  <TableRow
                    key={booking.id}
                    className={
                      selectedPhones.has(booking.user!.phone)
                        ? "bg-emerald-50 dark:bg-emerald-950/20"
                        : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedPhones.has(booking.user!.phone)}
                        onCheckedChange={() =>
                          handleTogglePhone(booking.user!.phone)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.user?.fullName ?? "--"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {booking.user?.phone}
                    </TableCell>
                    <TableCell>{booking.wasteCategory?.name ?? "--"}</TableCell>
                    <TableCell>
                      LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={booking.status as BookingStatus} />
                    </TableCell>
                    <TableCell>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Compose and Send */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Compose Message</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCheck className="h-4 w-4" />
            <span>{selectedPhones.size} recipient(s) selected</span>
          </div>
        </div>

        {/* Selected phones preview */}
        {selectedPhones.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedPhones).map((phone) => (
              <span
                key={phone}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300"
              >
                {phone}
                <button
                  onClick={() => handleTogglePhone(phone)}
                  className="ml-1 text-emerald-600 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <Textarea
          placeholder="Type your SMS message here..."
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="resize-none"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {message.length} characters
            {message.length > 160 && (
              <span className="text-amber-600">
                {" "}
                ({Math.ceil(message.length / 160)} SMS parts)
              </span>
            )}
          </p>
          <Button
            onClick={handleSendSms}
            disabled={
              sendSmsMutation.isPending ||
              selectedPhones.size === 0 ||
              !message.trim()
            }
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sendSmsMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS ({selectedPhones.size})
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
