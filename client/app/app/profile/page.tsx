'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/components/auth/auth-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().min(3),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const names = (user?.fullName ?? '').split(' ');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: names[0] ?? '',
      lastName: names[1] ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      address: user?.address ?? '',
    },
  });

  useEffect(() => {
    reset({
      firstName: names[0] ?? '',
      lastName: names[1] ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      address: user?.address ?? '',
    });
  }, [user, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: `${values.firstName} ${values.lastName}`.trim(),
          email: values.email,
          phone: values.phone,
          address: values.address,
        }),
      });
      await refreshProfile();
      toast({ title: 'Profile updated', description: 'Changes saved.', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message, variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-xl font-semibold">
          {user?.fullName?.[0] ?? 'U'}
        </div>
        <div>
          <h3 className="text-xl font-semibold">{user?.fullName ?? 'User'}</h3>
          <p className="text-sm text-white/70">{user?.email}</p>
          <p className="text-xs text-white/50">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '--'}</p>
        </div>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal info</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input {...register('firstName')} />
                {errors.firstName && <p className="text-xs text-rose-400">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-rose-400">{errors.lastName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...register('email')} />
                {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...register('phone')} />
                {errors.phone && <p className="text-xs text-rose-400">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input {...register('address')} />
                {errors.address && <p className="text-xs text-rose-400">{errors.address.message}</p>}
              </div>
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>Save Changes</Button>
                <Button type="button" variant="outline">Cancel</Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <p className="text-sm text-white/70">Security settings coming soon.</p>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <p className="text-sm text-white/70">Notification preferences coming soon.</p>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <p className="text-sm text-white/70">Manage your payout methods soon.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
