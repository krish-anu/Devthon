'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PricingItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';

export default function AdminPricingPage() {
  const { data } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => apiFetch<PricingItem[]>('/admin/pricing'),
  });

  const [items, setItems] = useState<PricingItem[]>([]);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const updateItem = (id: string, patch: Partial<PricingItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSave = async () => {
    try {
      await apiFetch('/admin/pricing', {
        method: 'PATCH',
        body: JSON.stringify({
          items: items.map((item) => ({
            wasteCategoryId: item.wasteCategory.id,
            minPriceLkrPerKg: Number(item.minPriceLkrPerKg),
            maxPriceLkrPerKg: Number(item.maxPriceLkrPerKg),
            isActive: item.isActive,
          })),
        }),
      });
      toast({ title: 'Pricing updated', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message, variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{item.wasteCategory.name}</h3>
              <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                <Checkbox
                  checked={item.isActive}
                  onCheckedChange={(checked) => updateItem(item.id, { isActive: Boolean(checked) })}
                />
                Active
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-[color:var(--muted)]">Min Price (LKR/kg)</label>
                <Input
                  type="number"
                  value={item.minPriceLkrPerKg}
                  onChange={(event) => updateItem(item.id, { minPriceLkrPerKg: Number(event.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-[color:var(--muted)]">Max Price (LKR/kg)</label>
                <Input
                  type="number"
                  value={item.maxPriceLkrPerKg}
                  onChange={(event) => updateItem(item.id, { maxPriceLkrPerKg: Number(event.target.value) })}
                />
              </div>
            </div>
          </div>
        ))}
      </Card>
      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  );
}

