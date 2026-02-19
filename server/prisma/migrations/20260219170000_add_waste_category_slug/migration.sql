-- Add slug column for canonical waste-type matching.
ALTER TABLE "WasteCategory"
ADD COLUMN "slug" TEXT;

-- Backfill slug from existing names.
UPDATE "WasteCategory"
SET "slug" = regexp_replace(
  lower(trim("name")),
  '[^a-z0-9]+',
  '-',
  'g'
);

UPDATE "WasteCategory"
SET "slug" = regexp_replace("slug", '(^-+|-+$)', '', 'g');

UPDATE "WasteCategory"
SET "slug" = 'waste'
WHERE "slug" IS NULL OR "slug" = '';

-- Resolve duplicates by appending row number suffix.
WITH ranked AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM "WasteCategory"
)
UPDATE "WasteCategory" wc
SET "slug" = CASE
  WHEN ranked.rn = 1 THEN ranked.slug
  ELSE ranked.slug || '-' || ranked.rn::text
END
FROM ranked
WHERE wc.id = ranked.id;

ALTER TABLE "WasteCategory"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "WasteCategory_slug_key" ON "WasteCategory"("slug");
