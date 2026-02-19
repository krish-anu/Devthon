"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatPhoneForDisplay } from "@/lib/phone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { CheckCircle, XCircle } from "lucide-react";

interface PendingUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  approved: boolean;
  createdAt: string;
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => apiFetch<PendingUser[]>("/admin/pending-approvals"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/approve/${id}`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast({
        title: "Approved",
        description: "User has been approved and can now log in.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to approve user.",
        variant: "error",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/reject/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast({
        title: "Rejected",
        description: "User has been rejected and removed.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to reject user.",
        variant: "error",
      });
    },
  });

  const pending = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <p className="text-sm text-(--muted)">
          Review and approve or reject admin and driver sign-up requests.
        </p>
      </div>

      <Card>
        <Table className="md:min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Signed Up</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-(--muted)">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && pending.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-(--muted)">
                  No pending approvals. All clear! 🎉
                </TableCell>
              </TableRow>
            )}
            {pending.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.fullName || "—"}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{formatPhoneForDisplay(user.phone) || "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "DRIVER" ? "info" : "warning"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(user.id)}
                    disabled={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => rejectMutation.mutate(user.id)}
                    disabled={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
