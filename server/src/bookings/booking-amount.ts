export type PricingLike = {
  minPriceLkrPerKg: number;
  maxPriceLkrPerKg: number;
};

export function calculateMidpointAmountLkr(
  weightKg: number,
  pricing?: PricingLike | null,
) {
  if (!pricing) return null;
  const weight = Math.max(0, Number(weightKg) || 0);
  const min = Number(pricing.minPriceLkrPerKg) || 0;
  const max = Number(pricing.maxPriceLkrPerKg) || 0;
  const midpoint = (min + max) / 2;
  const amount = midpoint * weight;
  return Math.round(amount * 100) / 100;
}
