"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { formatPhoneForDisplay, isValidSriLankaPhone, normalizeSriLankaPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/dialog";

interface AdminUser {
  id: string;
  fullName?: string;
  email: string;
  phone?: string;
  role: "ADMIN" | "SUPER_ADMIN" | string;
  approved?: boolean;
}

export default function AdminAdminsPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "ADMIN" as "ADMIN" | "SUPER_ADMIN",
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-admins", search],
    queryFn: async () => {
      const users = await apiFetch<AdminUser[]>('/admin/all-users');
      const filtered = (users ?? []).filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
      if (search?.trim()) {
        const t = search.trim().toLowerCase();
        return filtered.filter((u) => (u.fullName ?? '').toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
      }
      return filtered;
    },
  });

  const createMutation = useMutation({
    mutationFn: (userData: typeof formData) =>
      apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setShowModal(false);
      resetForm();
      toast({ title: 'Admin created', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Create failed', description: err?.message ?? 'Unable to create admin', variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (userData: Partial<typeof formData>) =>
      apiFetch(`/admin/users/${editingUser?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setShowModal(false);
      resetForm();
      toast({ title: 'Admin updated', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err?.message ?? 'Unable to update admin', variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
    },
    onError: (err: any) => {
      toast({ title: 'Delete failed', description: err?.message ?? 'Unable to delete admin', variant: 'error' });
    },
  });

  const resetForm = () => {
    setFormData({ fullName: '', email: '', phone: '', password: '', role: 'ADMIN' });
    setEditingUser(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({ fullName: user.fullName ?? '', email: user.email, phone: user.phone ?? '', password: '', role: (user.role as any) ?? 'ADMIN' });
    setShowModal(true);
  };

  const openDeleteConfirm = (user: AdminUser) => setConfirmDeleteUser(user);

  const confirmDelete = () => {
    if (!confirmDeleteUser) return;
    const id = confirmDeleteUser.id;
    setDeletingUserId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: 'Admin deleted', variant: 'success' });
        setConfirmDeleteUser(null);
      },
      onSettled: () => setDeletingUserId(null),
    });
  };

  const handleSubmit = () => {
    if (!formData.email || !formData.fullName) {
      alert('Please fill required fields');
      return;
    }

    if (formData.phone && !isValidSriLankaPhone(formData.phone)) {
      alert('Please enter a valid Sri Lanka phone');
      return;
    }

    const payload: any = { fullName: formData.fullName, email: formData.email, phone: normalizeSriLankaPhone(formData.phone) ?? formData.phone, role: formData.role };
    if (!editingUser) {
      if (!formData.password) {
        alert('Password is required for new admin');
        return;
      }
      payload.password = formData.password;
      createMutation.mutate(payload);
    } else {
      if (formData.password) payload.password = formData.password;
      updateMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search admins" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={handleAdd}>+ Add Admin</Button>
      </Card>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={5} rows={6} />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.fullName ?? '--'}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{formatPhoneForDisplay(u.phone ?? '')}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-full border border-(--border) p-2 text-(--muted)">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(u)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteConfirm(u)} className="text-red-600">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingUser ? 'Edit Admin' : 'Add Admin'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="Full Name" />
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email" />
              </div>

              <div>
                <label className="text-sm font-medium">Phone</label>
                <PhoneInput value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })} placeholder="+94 77 123 4567" />
              </div>

              {!editingUser && (
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Password (min 6)" />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Role</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })} className="h-10 w-full rounded-lg border border-(--border) bg-(--surface-soft) px-3 text-sm">
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setShowModal(false)} className="flex-1 bg-gray-300 text-gray-800 hover:bg-gray-400">Cancel</Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Loading...' : 'Save'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Delete */}
      <Dialog open={!!confirmDeleteUser} onOpenChange={(val) => { if (!val) setConfirmDeleteUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>Are you sure you want to delete {confirmDeleteUser?.fullName ?? confirmDeleteUser?.email}? This action cannot be undone.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 pt-4">
            <Button onClick={() => setConfirmDeleteUser(null)} className="flex-1 bg-gray-300 text-gray-800 hover:bg-gray-400">Cancel</Button>
            <Button onClick={confirmDelete} className="flex-1 bg-red-600" disabled={deletingUserId === confirmDeleteUser?.id}>{deletingUserId === confirmDeleteUser?.id ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : 'Delete'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
