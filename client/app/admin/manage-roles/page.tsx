"use client";

import React, { useState } from "react";
import Pagination from '@/components/ui/pagination';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

const ROLE_OPTIONS = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "DRIVER", "RECYCLER", "CORPORATE"];

export default function ManageRolesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [nonCustomerOnly, setNonCustomerOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-all-users", afterCursor, beforeCursor, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', String(limit));
      if (afterCursor) params.append('after', afterCursor);
      if (beforeCursor) params.append('before', beforeCursor);
      return apiFetch<any>(`/admin/all-users?${params.toString()}`);
    },
    placeholderData: (previousData) => previousData,
  });

  const users = (data?.items ?? data) ?? [];

  const displayedUsers = users.filter((u: any) => {
    if (nonCustomerOnly && u.role === "CUSTOMER") return false;
    if (search && !(u.email?.toLowerCase().includes(search.toLowerCase()) || (u.fullName ?? "").toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/admin/change-role/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      toast({ title: "Role updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err?.message ?? "Unable to change role", variant: "error" });
    },
  });

  const handleSave = (id: string) => {
    const role = editing[id];
    if (!role) return;
    changeRoleMutation.mutate({ id, role });
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Manage Roles</h2>
          <p className="text-sm text-(--muted)">View all users and change roles (Super Admin only).</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <Input
            className="w-full sm:w-72"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="text-sm text-(--muted) sm:whitespace-nowrap">
            <input type="checkbox" className="mr-2" checked={nonCustomerOnly} onChange={(e) => setNonCustomerOnly(e.target.checked)} />
            Show non-customers only
          </label>
        </div>
      </Card> 

      <Card>
        {isLoading ? (
          <div className="py-8 text-center text-(--muted)">Loading users...</div>
        ) : (
          <>
            <Table className="md:min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.fullName ?? "-"}</TableCell>
                    <TableCell>
                      <select
                        value={editing[u.id] ?? u.role}
                        onChange={(e) => setEditing((s) => ({ ...s, [u.id]: e.target.value }))}
                        className="h-9 rounded-xl border border-(--border) bg-(--surface-soft) px-2 text-sm"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option value={r} key={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(u.id)} disabled={changeRoleMutation.isPending}>
                          Save
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              nextCursor={(data as any)?.nextCursor ?? null}
              prevCursor={(data as any)?.prevCursor ?? null}
              onNext={() => { setAfterCursor((data as any)?.nextCursor ?? null); setBeforeCursor(null); }}
              onPrev={() => { setBeforeCursor((data as any)?.prevCursor ?? null); setAfterCursor(null); }}
              limit={limit}
              onLimitChange={(n) => { setLimit(n); setAfterCursor(null); setBeforeCursor(null); }}
              loading={isFetching}
            />
          </>
        )}
      </Card>
    </div>
  );
}
