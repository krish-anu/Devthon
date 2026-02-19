import { normalizeWasteName } from '../lib/wasteTypeUtils';

export type WasteItem = {
  categoryName: string;
  categorySlug?: string | null;
  weightKg: number;
};

export type PointsCalculationInput = {
  items: WasteItem[];
  includesEwaste?: boolean;
  isFirstBooking: boolean;
  hasWeeklyStreak: boolean;
};

export type PointsCalculationResult = {
  basePoints: number;
  bonusPoints: number;
  multiplier: number;
  finalPoints: number;
  breakdown: {
    items: Array<{
      categoryName: string;
      weightKg: number;
      rate: number;
      points: number;
    }>;
    multiplierReason: 'weekly_streak' | 'first_booking' | 'standard';
    rawBasePoints: number;
  };
};

export const BASE_POINT_RATES = {
  plastic: 10,
  metal: 20,
} as const;

export const E_WASTE_BONUS_POINTS = 30;

export const MULTIPLIERS = {
  weekly: 2.0,
  firstBooking: 1.5,
  standard: 1.0,
} as const;

export function normalizeCategoryName(name: string) {
  return normalizeWasteName(name);
}

export function isPlasticCategory(name: string, slug?: string | null) {
  const normalized = normalizeCategoryName(slug || name);
  return normalized.includes('plastic') || normalized.includes('pet');
}

export function isMetalCategory(name: string, slug?: string | null) {
  const normalized = normalizeCategoryName(slug || name);
  return (
    normalized.includes('metal') ||
    normalized.includes('aluminum') ||
    normalized.includes('aluminium')
  );
}

export function isEwasteCategory(name: string, slug?: string | null) {
  const normalized = normalizeCategoryName(slug || name);
  if (!normalized) return false;
  if (normalized === 'e-waste') return true;

  return (
    normalized.includes('electronic') ||
    normalized.includes('ewaste') ||
    normalized.includes('electrical-waste') ||
    normalized.includes('reusable-electronics')
  );
}

export function getBaseRate(categoryName: string, categorySlug?: string | null) {
  if (isPlasticCategory(categoryName, categorySlug)) return BASE_POINT_RATES.plastic;
  if (isMetalCategory(categoryName, categorySlug)) return BASE_POINT_RATES.metal;
  return 0;
}

export function calculatePoints(
  input: PointsCalculationInput,
): PointsCalculationResult {
  const safeItems = input.items ?? [];
  let rawBasePoints = 0;

  const itemBreakdown = safeItems.map((item) => {
    const rate = getBaseRate(item.categoryName, item.categorySlug);
    const weightKg = Math.max(0, Number(item.weightKg) || 0);
    const points = weightKg * rate;
    rawBasePoints += points;
    return {
      categoryName: item.categoryName,
      weightKg,
      rate,
      points,
    };
  });

  const basePoints = Math.max(0, Math.round(rawBasePoints));
  const bonusPoints = input.includesEwaste ? E_WASTE_BONUS_POINTS : 0;

  const multiplierReason = input.hasWeeklyStreak
    ? 'weekly_streak'
    : input.isFirstBooking
      ? 'first_booking'
      : 'standard';

  const multiplier = input.hasWeeklyStreak
    ? MULTIPLIERS.weekly
    : input.isFirstBooking
      ? MULTIPLIERS.firstBooking
      : MULTIPLIERS.standard;

  const finalPoints = Math.max(
    0,
    Math.round((basePoints + bonusPoints) * multiplier),
  );

  return {
    basePoints,
    bonusPoints,
    multiplier,
    finalPoints,
    breakdown: {
      items: itemBreakdown,
      multiplierReason,
      rawBasePoints,
    },
  };
}
