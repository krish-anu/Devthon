'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(6),
  type: z.enum(['HOUSEHOLD', 'BUSINESS']),
  terms: z.boolean().refine((v) => v === true, {
    message: 'You must accept the terms.',
  }),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const { register, handleSubmit, setValue, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'HOUSEHOLD', terms: false },
  });
  const { errors, isSubmitting } = formState;
  const { register: registerUser } = useAuth();
  const termsChecked = watch('terms');

  const onSubmit = async (values: FormValues) => {
    try {
      const { terms, ...payload } = values;
      await registerUser(payload);
      toast({ title: 'Account created', description: 'Welcome to Trash2Cash.', variant: 'success' });
      window.location.href = '/verify';
    } catch (error: any) {
      toast({
        title: 'Signup failed',
        description: error?.message ?? 'Please check your details.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <ThemeToggle className="fixed right-6 top-6" />
      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-brand">Join the Green Revolution</p>
          <h1 className="text-2xl font-semibold">Create your account</h1>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            toast({ title: 'Google sign-up', description: 'OAuth not configured in demo.', variant: 'info' })
          }
        >
          Continue with Google
        </Button>
        <div className="text-xs text-muted">or sign up with email</div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="Rajesh Perera" {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-rose-400">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="you@email.com" {...register('email')} />
            {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="+94 77 123 4567" {...register('phone')} />
            {errors.phone && <p className="text-xs text-rose-400">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="Create a password" {...register('password')} />
            {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Account Type</Label>
            <div className="flex gap-2">
              {['HOUSEHOLD', 'BUSINESS'].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setValue('type', type as 'HOUSEHOLD' | 'BUSINESS')}
                  className={`rounded-full border px-4 py-2 text-xs ${
                    watch('type') === type
                      ? 'border-emerald-400 bg-emerald-400/20 text-emerald-100'
                          : 'border-border text-muted'
                  }`}
                >
                  {type === 'HOUSEHOLD' ? 'Household' : 'Business'}
                </button>
              ))}
            </div>
          </div>
              <div className="flex items-start gap-3 text-xs text-muted">
            <Checkbox checked={termsChecked} onCheckedChange={(checked) => setValue('terms', Boolean(checked))} />
            <span>
              I agree to the terms and privacy policy.
              {errors.terms && <span className="block text-rose-400">{errors.terms.message}</span>}
            </span>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
        <div className="text-xs text-muted">
          Already have an account? <Link href="/login" className="text-brand">Login</Link>
        </div>
      </Card>
    </div>
  );
}
