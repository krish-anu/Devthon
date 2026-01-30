'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, X } from 'lucide-react';

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  type: 'HOUSEHOLD' | 'BUSINESS';
  role: 'USER' | 'ADMIN' | 'DRIVER';
  status: 'ACTIVE' | 'INACTIVE';
  _count?: { bookings: number };
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | 'HOUSEHOLD' | 'BUSINESS'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    type: 'HOUSEHOLD' as 'HOUSEHOLD' | 'BUSINESS',
    role: 'USER' as 'USER' | 'ADMIN' | 'DRIVER',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin-users', search, type],
    queryFn: () => {
      let url = '/admin/users';
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type !== 'ALL') params.append('type', type);
      if (params.toString()) url += `?${params.toString()}`;
      return apiFetch<User[]>(url);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: typeof formData) =>
      apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      resetForm();
      setShowModal(false);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (userData: Partial<typeof formData>) =>
      apiFetch(`/admin/users/${editingUser?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      resetForm();
      setShowModal(false);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      type: 'HOUSEHOLD',
      role: 'USER',
      status: 'ACTIVE',
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
      password: '',
      type: user.type,
      role: user.role,
      status: user.status,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      alert('Please fill all required fields');
      return;
    }

    if (editingUser) {
      const updateData = { ...formData };
      if (!updateData.password) delete (updateData as any).password;
      updateUserMutation.mutate(updateData);
    } else {
      if (!formData.password) {
        alert('Password is required for new users');
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        <select 
          value={type}
          onChange={(event) => setType(event.target.value as 'ALL' | 'HOUSEHOLD' | 'BUSINESS')}
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

      <Card>
        <Table>
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
            {(data ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.fullName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>{user.type}</TableCell>
                <TableCell>{user._count?.bookings ?? '--'}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-full border border-(--border) p-2 text-(--muted)">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditUser(user)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteUserMutation.mutate(user.id)} className="text-red-600">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Full Name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password (min 6 characters)"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">User Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'HOUSEHOLD' | 'BUSINESS' })}
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'USER' | 'ADMIN' | 'DRIVER' })}
                  className="h-10 w-full rounded-lg border border-(--border) bg-(--surface-soft) px-3 text-sm"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="DRIVER">DRIVER</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
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
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
              >
                {createUserMutation.isPending || updateUserMutation.isPending ? 'Loading...' : 'Save'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

