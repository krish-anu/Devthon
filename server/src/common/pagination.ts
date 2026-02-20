/**
 * Simple cursor encode/decode using base64 JSON. Cursor payload should be small
 * (e.g. { id: string }).
 */
export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor<T = any>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as T;
  } catch (err) {
    return null;
  }
}

export type CursorPage<T> = {
  items: T[];
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore: boolean;
};

type CursorId = string | number;

type CursorFindManyArgs = {
  where?: unknown;
  orderBy?: unknown;
  cursor?: { id: CursorId };
  skip?: number;
  take?: number;
};

/**
 * Build a Prisma findMany call that supports `after` / `before` cursors (by id)
 * and returns a CursorPage result. This uses Prisma's `cursor` + `take`
 * behaviour and reverses results for `before` queries so callers always receive
 * items in the requested `orderBy`.
 *
 * NOTE: cursor must reference a unique field (we use `id`). The `orderBy`
 * provided by the caller is preserved.
 */
export async function cursorPaginate<T extends { id: CursorId }>(
  findManyFn: (args: CursorFindManyArgs) => Promise<T[]>,
  countFn: (where?: unknown) => Promise<number>,
  args: {
    where?: unknown;
    orderBy?: unknown;
    after?: string | null;
    before?: string | null;
    limit?: number;
  },
): Promise<CursorPage<T>> {
  const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 10)));
  const where = args.where;
  const orderBy = args.orderBy ?? { createdAt: 'desc' };
  const pageSize = limit + 1;

  // If `before` is provided we will query backwards by using a negative `take`
  // then reverse the returned rows to keep the client-facing order stable.
  // We fetch one extra row to know if another previous page exists.
  if (args.before) {
    const cursorPayload = decodeCursor<{ id: string }>(args.before);
    const cursorId = cursorPayload?.id;
    const items = await findManyFn({
      where,
      orderBy,
      cursor: cursorId ? { id: cursorId } : undefined,
      skip: cursorId ? 1 : undefined,
      take: -pageSize,
    });

    const ordered = items.reverse();
    const hasPrev = ordered.length > limit;
    const pageItems = hasPrev ? ordered.slice(1) : ordered;
    const nextCursor = pageItems.length
      ? encodeCursor({ id: pageItems[pageItems.length - 1].id })
      : null;
    const prevCursor =
      hasPrev && pageItems.length
        ? encodeCursor({ id: pageItems[0].id })
        : null;

    return {
      items: pageItems,
      nextCursor,
      prevCursor,
      hasMore: hasPrev,
    };
  }

  // Default / `after` handling (forward pagination)
  const cursorPayload = args.after
    ? decodeCursor<{ id: string }>(args.after)
    : null;
  const cursorId = cursorPayload?.id;
  const items = await findManyFn({
    where,
    orderBy,
    cursor: cursorId ? { id: cursorId } : undefined,
    skip: cursorId ? 1 : undefined,
    take: pageSize,
  });

  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && pageItems.length
      ? encodeCursor({ id: pageItems[pageItems.length - 1].id })
      : null;
  const prevCursor =
    cursorId && pageItems.length ? encodeCursor({ id: pageItems[0].id }) : null;

  return {
    items: pageItems,
    nextCursor,
    prevCursor,
    hasMore,
  };
}
