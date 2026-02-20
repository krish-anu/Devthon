"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import {
  formatPhoneForDisplay,
  isValidSriLankaPhone,
  normalizeSriLankaPhone,
} from "@/lib/phone";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  type?: "HOUSEHOLD" | "BUSINESS";
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  status?: "ACTIVE" | "INACTIVE";
  _count?: { bookings: number };
}

type AdminUsersResponse = {
  items: User[];
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore?: boolean;
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | "HOUSEHOLD" | "BUSINESS">("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    type: "HOUSEHOLD" as "HOUSEHOLD" | "BUSINESS",
    role: "CUSTOMER" as "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  const queryClient = useQueryClient();

  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  // reset cursors when search/type change
  useEffect(() => {
    setAfterCursor(null);
    setBeforeCursor(null);
  }, [search, type]);

  const { data, isLoading, isFetching } = useQuery<AdminUsersResponse>({
    queryKey: ["admin-users", search, type, afterCursor, beforeCursor, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("limit", String(limit));
      if (search) params.append("search", search);
      if (type !== "ALL") params.append("type", type);
      if (afterCursor) params.append("after", afterCursor);
      if (beforeCursor) params.append("before", beforeCursor);

      const res = await apiFetch<User[] | AdminUsersResponse>(
        `/admin/users?${params.toString()}`,
      );

      // Support legacy array response for non-paginated callers
      if (Array.isArray(res)) {
        return { items: res, nextCursor: null, prevCursor: null };
      }

      return res;
    },
    placeholderData: (previousData) => previousData,
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: typeof formData) =>
      apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify(userData),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      resetForm();
      setShowModal(false);
      toast({ title: "User created", variant: "success" });
    },
    onError: (error: any) => {
      toast({
        title: "Create user failed",
        description: error?.message ?? "Failed to create user",
        variant: "error",
      });
      console.error("Create user failed", error);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (userData: Partial<typeof formData>) =>
      apiFetch(`/admin/users/${editingUser?.id}`, {
        method: "PATCH",
        body: JSON.stringify(userData),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      resetForm();
      setShowModal(false);
      toast({ title: "User updated", variant: "success" });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error?.message ?? "Failed to update user",
        variant: "error",
      });
      console.error("Update user failed", error);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error?.message ?? "Failed to delete user",
        variant: "error",
      });
      console.error("Delete user failed", error);
    },
  });

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      type: "HOUSEHOLD",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    setEditingUser(null);
  };

  const handleAddUser = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      password: "",
      type: user.type ?? "HOUSEHOLD",
      role: user.role,
      status: user.status ?? "ACTIVE",
    });
    setShowModal(true);
  };

  const openDeleteConfirm = (user: User) => {
    setConfirmDeleteUser(user);
  };

  const confirmDelete = () => {
    if (!confirmDeleteUser) return;
    const id = confirmDeleteUser.id;
    setDeletingUserId(id);
    deleteUserMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "User deleted", variant: "success" });
        setConfirmDeleteUser(null);
      },
      onError: (error: any) => {
        toast({
          title: "Delete failed",
          description: error?.message ?? "Unable to delete user",
          variant: "error",
        });
      },
      onSettled: () => setDeletingUserId(null),
    });
  };

  const handleSubmit = () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      alert("Please fill all required fields");
      return;
    }

    if (!isValidSriLankaPhone(formData.phone)) {
      alert(
        "Please enter a valid Sri Lanka phone number (e.g. +94 77 123 4567)",
      );
      return;
    }

    if (editingUser) {
      const updateData: Partial<typeof formData> = { ...formData };
      if (!updateData.password) delete (updateData as any).password;
      updateData.phone =
        normalizeSriLankaPhone(updateData.phone) ?? updateData.phone;
      updateUserMutation.mutate(updateData);
    } else {
      if (!formData.password) {
        alert("Password is required for new users");
        return;
      }
      const createData = {
        ...formData,
        phone: normalizeSriLankaPhone(formData.phone) ?? formData.phone,
      };
      createUserMutation.mutate(createData);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value as "ALL" | "HOUSEHOLD" | "BUSINESS")
          }
          className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)"
        >
          <option value="ALL">All Types</option>
          <option value="HOUSEHOLD">Household</option>
          <option value="BUSINESS">Business</option>
        </select>
        <Input
          placeholder="Search users"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button onClick={handleAddUser}>+ Add User</Button>
      </Card>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={7} rows={6} />
        </Card>
      ) : (
        <>
          <Card>
            <Table className="md:min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{formatPhoneForDisplay(user.phone)}</TableCell>
                    <TableCell>{user.type}</TableCell>
                    <TableCell>{user._count?.bookings ?? "--"}</TableCell>
                    <TableCell>{user.status}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-full border border-(--border) p-2 text-(--muted)">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteConfirm(user)}
                            disabled={deletingUserId === user.id}
                            className="text-red-600 flex items-center"
                          >
                            {deletingUserId === user.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Delete"
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Pagination
            nextCursor={data?.nextCursor ?? null}
            prevCursor={data?.prevCursor ?? null}
            onNext={() => {
              setAfterCursor(data?.nextCursor ?? null);
              setBeforeCursor(null);
            }}
            onPrev={() => {
              setBeforeCursor(data?.prevCursor ?? null);
              setAfterCursor(null);
            }}
            limit={limit}
            onLimitChange={(n) => {
              setLimit(n);
              setAfterCursor(null);
              setBeforeCursor(null);
            }}
            loading={isFetching}
          />
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md space-y-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingUser ? "Edit User" : "Add User"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Full Name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Phone</label>
                <PhoneInput
                  value={formData.phone}
                  onChange={(e: any) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+94 77 123 4567"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Password (min 6 characters)"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">User Type</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as "HOUSEHOLD" | "BUSINESS",
                    })
                  }
                  className="h-10 w-full rounded-lg border border-(--border) bg-(--surface-soft) px-3 text-sm"
                >
                  <option value="HOUSEHOLD">HOUSEHOLD</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as
                        | "CUSTOMER"
                        | "ADMIN"
                        | "SUPER_ADMIN"
                        | "DRIVER",
                    })
                  }
                  className="h-10 w-full rounded-lg border border-(--border) bg-(--surface-soft) px-3 text-sm"
                >
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="DRIVER">DRIVER</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "ACTIVE" | "INACTIVE",
                    })
                  }
                  className="h-10 w-full rounded-lg border border-(--border) bg-(--surface-soft) px-3 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-300 text-gray-800 hover:bg-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={
                  createUserMutation.isPending || updateUserMutation.isPending
                }
              >
                {createUserMutation.isPending || updateUserMutation.isPending
                  ? "Loading..."
                  : "Save"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <Dialog
        open={!!confirmDeleteUser}
        onOpenChange={(val) => {
          if (!val) setConfirmDeleteUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {confirmDeleteUser?.fullName}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setConfirmDeleteUser(null)}
              className="flex-1 bg-gray-300 text-gray-800 hover:bg-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="flex-1 bg-red-600"
              disabled={deletingUserId === confirmDeleteUser?.id}
            >
              {deletingUserId === confirmDeleteUser?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
