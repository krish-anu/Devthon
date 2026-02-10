import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [k, v] = arg.slice(2).split('=');
    params[k] = v ?? 'true';
  }
  return params;
}

async function main() {
  const params = parseArgs();
  const where: any = {};

  if (params.userId) where.userId = params.userId;
  if (params.bookingId) where.bookingId = params.bookingId;
  if (params.since) {
    const d = new Date(params.since);
    if (!isNaN(d.getTime())) where.createdAt = { gte: d };
  }

  const limit = parseInt(params.limit ?? '20', 10) || 20;

  console.log('Querying notifications with', JSON.stringify({ where, limit }, null, 2));

  // Try the Prisma model query first; if the DB schema is behind and the bookingId
  // column doesn't exist we fall back to a raw SQL query that selects known columns
  // and optionally searches title/message for a booking id (useful when the column
  // hasn't been migrated yet).
  let items: any[] = [];
  try {
    items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err: any) {
    if (err?.code === 'P2022') {
      console.warn('Notification.bookingId column missing in DB; falling back to raw SQL search.');

      // If bookingId filter was provided, search text in title/message as a fallback
      if (params.bookingId) {
        const like = `%${params.bookingId}%`;
        items = (await prisma.$queryRaw`
          SELECT id, "userId", title, message, "isRead", level, "createdAt"
          FROM "Notification"
          WHERE title ILIKE ${like} OR message ILIKE ${like}
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `) as any[];
      } else if (params.userId && params.since) {
        const sinceDate = new Date(params.since);
        items = (await prisma.$queryRaw`
          SELECT id, "userId", title, message, "isRead", level, "createdAt"
          FROM "Notification"
          WHERE "userId" = ${params.userId} AND "createdAt" >= ${sinceDate}
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `) as any[];
      } else if (params.userId) {
        items = (await prisma.$queryRaw`
          SELECT id, "userId", title, message, "isRead", level, "createdAt"
          FROM "Notification"
          WHERE "userId" = ${params.userId}
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `) as any[];
      } else if (params.since) {
        const sinceDate = new Date(params.since);
        items = (await prisma.$queryRaw`
          SELECT id, "userId", title, message, "isRead", level, "createdAt"
          FROM "Notification"
          WHERE "createdAt" >= ${sinceDate}
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `) as any[];
      } else {
        items = (await prisma.$queryRaw`
          SELECT id, "userId", title, message, "isRead", level, "createdAt"
          FROM "Notification"
          ORDER BY "createdAt" DESC
          LIMIT ${limit}
        `) as any[];
      }

      // Normalize raw rows to the same shape the Prisma model would have
      items = items.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        bookingId: r.bookingId ?? null, // will be undefined if column missing
        level: r.level,
        isRead: r.isRead,
        createdAt: r.createdAt,
        title: r.title,
        message: r.message,
      }));
    } else {
      throw err;
    }
  }

  if (!items.length) {
    console.log('No notifications found for the given filters.');
  } else {
    for (const n of items) {
      console.log('---');
      console.log(`id: ${n.id}`);
      console.log(`userId: ${n.userId}`);
      console.log(`bookingId: ${n.bookingId ?? 'n/a'}`);
      console.log(`level: ${n.level}`);
      console.log(`isRead: ${n.isRead}`);
      console.log(`createdAt: ${n.createdAt.toISOString()}`);
      console.log(`title: ${n.title}`);
      console.log(`message: ${n.message}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Error querying notifications:', err);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
