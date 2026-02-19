export type WasteLike = {
  id: string;
  name?: string | null;
  slug?: string | null;
};

export function normalizeWasteName(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getWasteById<T extends { id: string }>(
  wasteTypes: T[],
  id?: string | null,
) {
  if (!id) return undefined;
  return wasteTypes.find((waste) => waste.id === id);
}

export function getWasteBySlug<T extends WasteLike>(
  wasteTypes: T[],
  slug?: string | null,
) {
  const normalizedSlug = normalizeWasteName(slug);
  if (!normalizedSlug) return undefined;

  return wasteTypes.find((waste) => {
    const candidate = waste.slug || waste.name || '';
    return normalizeWasteName(candidate) === normalizedSlug;
  });
}
