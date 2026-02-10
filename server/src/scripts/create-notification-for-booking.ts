import { PrismaClient, NotificationLevel } from '@prisma/client';

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
  const bookingId = params.bookingId;
  if (!bookingId) {
    console.error('Usage: ts-node src/scripts/create-notification-for-booking.ts --bookingId=<id> [--title=...] [--message=...]');
    process.exit(2);
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    console.error('Booking not found:', bookingId);
    process.exit(2);
  }

  const title = params.title ?? 'Booking completed (manual) 🎉';
  const message = params.message ?? `Your pickup #${booking.id.slice(0, 8)} is complete (manual).`;

  const created = await prisma.notification.create({
    data: {
      userId: booking.userId,
      bookingId: bookingId,
      title,
      message,
      level: NotificationLevel.SUCCESS,
    },
  });

  console.log('Created notification:', created.id);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });