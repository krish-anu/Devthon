"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { Search } from "lucide-react";

interface UserWithRole {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: string;
  approved?: boolean;
  createdAt: string;
}

const ROLES = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "DRIVER"] as const;

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "danger";
    case "ADMIN":
      return "warning";
    case "DRIVER":
      return "info";
    default:
      return "default";
  }
};

export default function ManageRolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["all-users-roles"],
    queryFn: () => apiFetch<UserWithRole[]>("/admin/all-users"),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/admin/change-role/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users-roles"] });
      toast({
        title: "Role updated",
        description: "User role has been changed successfully.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to change role.",
        variant: "error",
      });
    },
  });

  const users = (data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (u.fullName ?? "").toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.role.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manage Users & Roles</h1>
        <p className="text-sm text-(--muted)">
          View all users and change their roles. Only Super Admins can access
          this page.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted)" />
          <Input
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Change Role</TableHead>
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
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-(--muted)">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.fullName || "—"}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(user.role) as any}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.role === "CUSTOMER" || user.role === "SUPER_ADMIN" ? (
                    <span className="text-xs text-(--muted)">N/A</span>
                  ) : user.approved ? (
                    <Badge variant="default">Yes</Badge>
                  ) : (
                    <Badge variant="danger">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <select
                    className="rounded-lg border border-(--border) bg-(--surface) px-3 py-1.5 text-sm text-(--foreground)"
                    value={user.role}
                    onChange={(e) =>
                      changeRoleMutation.mutate({
                        id: user.id,
                        role: e.target.value,
                      })
                    }
                    disabled={changeRoleMutation.isPending}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
