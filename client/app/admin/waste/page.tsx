"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PricingItem, WasteCategory } from "@/lib/types";
import { Card } from "@/components/ui/card";
import Skeleton, { SkeletonGrid, SkeletonTableRows } from "@/components/shared/Skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

export default function AdminWasteManagementPage() {
  const qc = useQueryClient();
  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => apiFetch<PricingItem[]>("/admin/pricing"),
  });
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["waste-categories"],
    queryFn: () => apiFetch<WasteCategory[]>("/admin/waste-categories"),
  });

  // Pricing state
  const [items, setItems] = useState<PricingItem[]>([]);
  useEffect(() => {
    if (pricing) setItems(pricing);
  }, [pricing]);

  // Ensure categories without pricing appear as editable rows
  useEffect(() => {
    if (!categories) return;
    setItems((prev) => {
      const existingCatIds = new Set(prev.map((it) => it.wasteCategory.id));
      const missing = categories
        .filter((c) => !existingCatIds.has(c.id))
        .map((c) => ({
          id: `new-${c.id}`,
          minPriceLkrPerKg: 0,
          maxPriceLkrPerKg: 0,
          isActive: false,
          wasteCategory: c,
        } as PricingItem));
      if (missing.length === 0) return prev;
      return [...prev, ...missing];
    });
  }, [categories]);

  const updateItem = (id: string, patch: Partial<PricingItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleSavePricing = async () => {
    try {
      await apiFetch("/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          items: items.map((item) => ({
            wasteCategoryId: item.wasteCategory.id,
            minPriceLkrPerKg: Number(item.minPriceLkrPerKg),
            maxPriceLkrPerKg: Number(item.maxPriceLkrPerKg),
            isActive: item.isActive,
          })),
        }),
      });
      toast({ title: "Pricing updated", variant: "success" });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message, variant: "error" });
    }
  };

  // Categories state & actions
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleCreateCategory = async () => {
    if (!newName.trim()) return toast({ title: "Name required", variant: "warning" });
    try {
      await apiFetch("/admin/waste-categories", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), isActive }),
      });
      toast({ title: "Category created", variant: "success" });
      setNewName("");
      setNewDesc("");
      setIsActive(true);
      qc.invalidateQueries({ queryKey: ["waste-categories"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    } catch (error: any) {
      toast({ title: "Create failed", description: error?.message, variant: "error" });
    }
  };

  const handleToggleActive = async (id: string, value: boolean) => {
    try {
      await apiFetch(`/admin/waste-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: value }),
      });
      toast({ title: "Category updated", variant: "success" });
      qc.invalidateQueries({ queryKey: ["waste-categories"] });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message, variant: "error" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await apiFetch(`/admin/waste-categories/${id}`, { method: "DELETE" });
      toast({ title: "Category deleted", variant: "success" });
      qc.invalidateQueries({ queryKey: ["waste-categories"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message, variant: "error" });
    }
  };

  return (
    <div className="space-y-6 md:grid md:grid-cols-3 md:gap-6">
      <div className="md:col-span-2 space-y-6">
        <h2 className="text-lg font-semibold">Pricing</h2>
        {pricingLoading ? (
          <Card className="p-6">
            <SkeletonGrid count={4} cardClass="h-28" />
          </Card>
        ) : (
          <Card className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-(--border) bg-(--surface) p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{item.wasteCategory.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-(--muted)">
                    <Checkbox checked={item.isActive} onCheckedChange={(checked) => updateItem(item.id, { isActive: Boolean(checked) })} />
                    Active
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-(--muted)">Min Price (LKR/kg)</label>
                    <Input type="number" value={item.minPriceLkrPerKg as any} onChange={(event) => updateItem(item.id, { minPriceLkrPerKg: Number(event.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-(--muted)">Max Price (LKR/kg)</label>
                    <Input type="number" value={item.maxPriceLkrPerKg as any} onChange={(event) => updateItem(item.id, { maxPriceLkrPerKg: Number(event.target.value) })} />
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
        <Button onClick={handleSavePricing}>Save Changes</Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Waste Categories</h2>
        <Card className="space-y-4 p-4">
          <div className="space-y-2">
            <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <div className="flex items-center gap-2">
              <Checkbox checked={isActive} onCheckedChange={(val) => setIsActive(Boolean(val))} />
              Active
            </div>
            <Button onClick={handleCreateCategory}>Add Category</Button>
          </div>

          {categoriesLoading ? (
            <div className="p-4"><SkeletonTableRows columns={2} rows={5} /></div>
          ) : (
            <div className="mt-2 space-y-2">
              {categories?.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-(--muted)">{c.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={Boolean(c.isActive)} onCheckedChange={(val) => handleToggleActive(c.id, Boolean(val))} />
                    <Button variant="danger" onClick={() => handleDeleteCategory(c.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
