const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  const started = Date.now();
  try {
    const pricing = await prisma.pricing.findMany({
      where: { isActive: true },
      include: { wasteCategory: true },
      orderBy: { updatedAt: 'desc' },
    });
    const categories = await prisma.wasteCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
    console.log('ok', Date.now() - started, pricing.length, categories.length);
  } catch (error) {
    console.error('error', Date.now() - started, error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
