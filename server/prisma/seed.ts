import {
  PrismaClient,
  BookingStatus,
  DriverStatus,
  NotificationLevel,
  PaymentMethod,
  PaymentStatus,
  Role,
  UserStatus,
  UserType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const prisma = new PrismaClient();

async function main() {
  await prisma.paymentTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  // Keep existing pricing and waste categories to avoid accidental data loss.
  // We'll upsert categories below and only create pricing when missing.
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.launchNotify.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      fullName: 'Admin Team',
      email: 'admin@trash2cash.lk',
      phone: '+94 77 000 0000',
      passwordHash,
      role: Role.ADMIN,
      type: UserType.BUSINESS,
      status: UserStatus.ACTIVE,
      address: 'Trash2Cash HQ, Colombo',
    },
  });

  const rajesh = await prisma.user.create({
    data: {
      fullName: 'Rajesh Perera',
      email: 'rajesh@trash2cash.lk',
      phone: '+94 77 111 2222',
      passwordHash,
      role: Role.USER,
      type: UserType.HOUSEHOLD,
      status: UserStatus.ACTIVE,
      address: '45 Galle Road, Colombo 03',
    },
  });

  const samantha = await prisma.user.create({
    data: {
      fullName: 'Samantha Silva',
      email: 'samantha@trash2cash.lk',
      phone: '+94 77 333 4444',
      passwordHash,
      role: Role.USER,
      type: UserType.BUSINESS,
      status: UserStatus.ACTIVE,
      address: 'Industrial Park, Negombo',
    },
  });

  const drivers = await prisma.$transaction([
    prisma.driver.create({
      data: {
        name: 'Sunil Jayasinghe',
        phone: '+94 77 555 0101',
        rating: 4.8,
        pickupCount: 128,
        vehicleType: 'Truck',
        status: DriverStatus.ON_PICKUP,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Nimali Fernando',
        phone: '+94 77 555 0202',
        rating: 4.6,
        pickupCount: 94,
        vehicleType: 'Van',
        status: DriverStatus.ONLINE,
      },
    }),
    prisma.driver.create({
      data: {
        name: 'Kasun Abeysekera',
        phone: '+94 77 555 0303',
        rating: 4.4,
        pickupCount: 64,
        vehicleType: 'Three-wheeler',
        status: DriverStatus.OFFLINE,
      },
    }),
  ]);

  // Upsert (create if missing) the known categories so seed is idempotent
  const categoryDefs = [
    { name: 'Plastic', description: 'PET bottles, HDPE, mixed plastics' },
    { name: 'Paper', description: 'Cardboard and paper packaging' },
    { name: 'Metal', description: 'Aluminum cans and scrap metal' },
    { name: 'E-Waste', description: 'Old electronics and devices' },
    { name: 'Glass', description: 'Glass bottles and jars' },
    { name: 'Organic', description: 'Food waste and compostables' },
    { name: 'Copper Wire', description: 'Copper wiring and cables' },
    { name: 'Batteries', description: 'Household batteries' },
  ];

  const categories = [] as any[];
  for (const def of categoryDefs) {
    const cat = await prisma.wasteCategory.upsert({
      where: { name: def.name },
      update: { description: def.description },
      create: { name: def.name, description: def.description },
    });
    categories.push(cat);
  }

  // Ensure each category has a pricing entry. Use sensible defaults where specific prices are not provided.
  const defaultPricingMap: Record<string, { min: number; max: number }> = {
    Plastic: { min: 45, max: 70 },
    Paper: { min: 30, max: 55 },
    Metal: { min: 160, max: 240 },
    'E-Waste': { min: 220, max: 450 },
    Glass: { min: 20, max: 40 },
    Organic: { min: 5, max: 15 },
    'Copper Wire': { min: 300, max: 550 },
    Batteries: { min: 80, max: 160 },
  };

  for (const cat of categories) {
    const existingPrice = await prisma.pricing.findUnique({
      where: { wasteCategoryId: cat.id } as any,
    });
    if (!existingPrice) {
      const mapping = defaultPricingMap[cat.name] ?? { min: 20, max: 50 };
      await prisma.pricing.create({
        data: {
          wasteCategoryId: cat.id,
          minPriceLkrPerKg: mapping.min,
          maxPriceLkrPerKg: mapping.max,
          updatedAt: new Date(),
        },
      });
    }
  }

  const booking1 = await prisma.booking.create({
    data: {
      userId: rajesh.id,
      wasteCategoryId: categories[0].id,
      estimatedWeightRange: '10-15 kg',
      estimatedMinAmount: 450,
      estimatedMaxAmount: 900,
      addressLine1: '45 Galle Road',
      city: 'Colombo',
      postalCode: '00300',
      scheduledDate: new Date(),
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      status: BookingStatus.SCHEDULED,
      driverId: drivers[1].id,
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: rajesh.id,
      wasteCategoryId: categories[2].id,
      estimatedWeightRange: '25-30 kg',
      estimatedMinAmount: 1250,
      estimatedMaxAmount: 2100,
      addressLine1: '45 Galle Road',
      city: 'Colombo',
      postalCode: '00300',
      scheduledDate: new Date(new Date().setDate(new Date().getDate() - 7)),
      scheduledTimeSlot: '2:00 PM - 4:00 PM',
      status: BookingStatus.COMPLETED,
      actualWeightKg: 27,
      finalAmountLkr: 1780,
      driverId: drivers[0].id,
    },
  });

  const booking3 = await prisma.booking.create({
    data: {
      userId: samantha.id,
      wasteCategoryId: categories[1].id,
      estimatedWeightRange: '50-60 kg',
      estimatedMinAmount: 1500,
      estimatedMaxAmount: 2500,
      addressLine1: 'Industrial Park',
      city: 'Negombo',
      postalCode: '11500',
      scheduledDate: new Date(new Date().setDate(new Date().getDate() - 2)),
      scheduledTimeSlot: '9:00 AM - 11:00 AM',
      status: BookingStatus.REFUNDED,
      driverId: drivers[2].id,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      bookingId: booking2.id,
      amountLkr: 1780,
      method: PaymentMethod.MOBILE_WALLET,
      status: PaymentStatus.PROCESSED,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: rajesh.id,
        title: 'Pickup completed',
        message: 'Your metal pickup is complete. Payment processed.',
        level: NotificationLevel.SUCCESS,
      },
      {
        userId: rajesh.id,
        title: 'Driver en route',
        message: 'Driver Nimali is 15 minutes away.',
        level: NotificationLevel.INFO,
      },
      {
        userId: samantha.id,
        title: 'Refund issued',
        message: 'Refund for booking ' + booking3.id + ' has been issued.',
        level: NotificationLevel.WARNING,
      },
      {
        title: 'Inventory alert',
        message: 'E-waste storage reached 85% capacity.',
        level: NotificationLevel.ERROR,
      },
    ],
  });

  await prisma.launchNotify.create({
    data: { email: 'hello@trash2cash.lk' },
  });

  console.log('Seed data created:', {
    admin: admin.email,
    rajesh: rajesh.email,
    samantha: samantha.email,
  });

  // If Supabase credentials are available, mirror the seeded rows to Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    try {
      // Upsert users
      const supUsers = [admin, rajesh, samantha].map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        type: u.type,
        status: u.status,
        address: u.address,
      }));
      await supabase.from('users').upsert(supUsers, { onConflict: 'id' });

      // Upsert drivers
      const supDrivers = drivers.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        rating: d.rating,
        pickupCount: d.pickupCount,
        vehicleType: d.vehicleType,
        status: d.status,
      }));
      await supabase.from('drivers').upsert(supDrivers, { onConflict: 'id' });

      // Upsert categories
      const supCategories = categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      }));
      await supabase
        .from('waste_categories')
        .upsert(supCategories, { onConflict: 'id' });

      // Upsert pricing (read from prisma to ensure correct fields)
      const allPricing = await prisma.pricing.findMany();
      const supPricing = allPricing.map((p) => ({
        id: p.id,
        wasteCategoryId: p.wasteCategoryId,
        minPriceLkrPerKg: p.minPriceLkrPerKg,
        maxPriceLkrPerKg: p.maxPriceLkrPerKg,
        updatedAt: p.updatedAt,
      }));
      if (supPricing.length)
        await supabase.from('pricing').upsert(supPricing, { onConflict: 'id' });

      // Upsert bookings
      const supBookings = [booking1, booking2, booking3].map((b) => ({
        id: b.id,
        userId: b.userId,
        wasteCategoryId: b.wasteCategoryId,
        estimatedWeightRange: b.estimatedWeightRange,
        estimatedMinAmount: b.estimatedMinAmount,
        estimatedMaxAmount: b.estimatedMaxAmount,
        addressLine1: b.addressLine1,
        city: b.city,
        postalCode: b.postalCode,
        scheduledDate: b.scheduledDate,
        scheduledTimeSlot: b.scheduledTimeSlot,
        status: b.status,
        driverId: b.driverId,
        actualWeightKg: b.actualWeightKg ?? null,
        finalAmountLkr: b.finalAmountLkr ?? null,
      }));
      await supabase.from('bookings').upsert(supBookings, { onConflict: 'id' });

      // Upsert payment transactions
      const payments = await prisma.paymentTransaction.findMany();
      const supPayments = payments.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        amountLkr: p.amountLkr,
        method: p.method,
        status: p.status,
      }));
      if (supPayments.length)
        await supabase
          .from('payment_transactions')
          .upsert(supPayments, { onConflict: 'id' });

      // Upsert notifications
      const notifications = await prisma.notification.findMany();
      const supNotifications = notifications.map((n) => ({
        id: n.id,
        userId: n.userId ?? null,
        title: n.title,
        message: n.message,
        level: n.level,
      }));
      if (supNotifications.length)
        await supabase
          .from('notifications')
          .upsert(supNotifications, { onConflict: 'id' });

      // Upsert launch notifications
      const launchList = await prisma.launchNotify.findMany();
      const supLaunch = launchList.map((l) => ({ id: l.id, email: l.email }));
      if (supLaunch.length)
        await supabase
          .from('launch_notify')
          .upsert(supLaunch, { onConflict: 'id' });

      console.log('Supabase sync completed.');
    } catch (supErr) {
      console.error('Error syncing to Supabase:', supErr);
    }
  } else {
    const databaseUrl =
      process.env.SUPABASE_URL ??
      process.env.DATABASE_URL ??
      process.env.DATABASEURL ??
      process.env.Databaseurl ??
      process.env.DatabaseURL ??
      process.env.databaseurl;
    if (databaseUrl) {
      // Fallback: connect directly to the Postgres database (Supabase is Postgres-compatible)
      const pool = new Pool({ connectionString: databaseUrl });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const upsert = async (table: string, row: Record<string, any>) => {
          const cols = Object.keys(row);
          const vals = Object.values(row);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          const updates = cols
            .filter((c) => c !== 'id')
            .map((c) => `${c}=EXCLUDED.${c}`)
            .join(', ');
          const query = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`;
          await client.query(query, vals);
        };

        // Check which target tables actually exist in the connected database
        const targetTables = [
          'users',
          'drivers',
          'waste_categories',
          'pricing',
          'bookings',
          'payment_transactions',
          'notifications',
          'launch_notify',
        ];
        const foundRes = await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])",
          [targetTables],
        );
        const existingTables = new Set(
          foundRes.rows.map((r: any) => r.table_name),
        );
        const missingTables: string[] = targetTables.filter(
          (t) => !existingTables.has(t),
        );

        // Users
        if (existingTables.has('users')) {
          for (const u of [admin, rajesh, samantha]) {
            await upsert('users', {
              id: u.id,
              fullName: u.fullName,
              email: u.email,
              phone: u.phone,
              role: u.role,
              type: u.type,
              status: u.status,
              address: u.address,
            });
          }
        }

        // Drivers
        if (existingTables.has('drivers')) {
          for (const d of drivers) {
            await upsert('drivers', {
              id: d.id,
              name: d.name,
              phone: d.phone,
              rating: d.rating,
              pickupCount: d.pickupCount,
              vehicleType: d.vehicleType,
              status: d.status,
            });
          }
        }

        // Categories
        if (existingTables.has('waste_categories')) {
          for (const c of categories) {
            await upsert('waste_categories', {
              id: c.id,
              name: c.name,
              description: c.description,
            });
          }
        }

        // Pricing
        if (existingTables.has('pricing')) {
          const allPricing = await prisma.pricing.findMany();
          for (const p of allPricing) {
            await upsert('pricing', {
              id: p.id,
              wasteCategoryId: p.wasteCategoryId,
              minPriceLkrPerKg: p.minPriceLkrPerKg,
              maxPriceLkrPerKg: p.maxPriceLkrPerKg,
              updatedAt: p.updatedAt,
            });
          }
        }

        // Bookings
        if (existingTables.has('bookings')) {
          for (const b of [booking1, booking2, booking3]) {
            await upsert('bookings', {
              id: b.id,
              userId: b.userId,
              wasteCategoryId: b.wasteCategoryId,
              estimatedWeightRange: b.estimatedWeightRange,
              estimatedMinAmount: b.estimatedMinAmount,
              estimatedMaxAmount: b.estimatedMaxAmount,
              addressLine1: b.addressLine1,
              city: b.city,
              postalCode: b.postalCode,
              scheduledDate: b.scheduledDate,
              scheduledTimeSlot: b.scheduledTimeSlot,
              status: b.status,
              driverId: b.driverId,
              actualWeightKg: b.actualWeightKg ?? null,
              finalAmountLkr: b.finalAmountLkr ?? null,
            });
          }
        }

        // Payment transactions
        if (existingTables.has('payment_transactions')) {
          const payments = await prisma.paymentTransaction.findMany();
          for (const p of payments) {
            await upsert('payment_transactions', {
              id: p.id,
              bookingId: p.bookingId,
              amountLkr: p.amountLkr,
              method: p.method,
              status: p.status,
            });
          }
        }

        // Notifications
        if (existingTables.has('notifications')) {
          const notifications = await prisma.notification.findMany();
          for (const n of notifications) {
            await upsert('notifications', {
              id: n.id,
              userId: n.userId ?? null,
              title: n.title,
              message: n.message,
              level: n.level,
            });
          }
        }

        // Launch notify
        if (existingTables.has('launch_notify')) {
          const launchList = await prisma.launchNotify.findMany();
          for (const l of launchList) {
            await upsert('launch_notify', { id: l.id, email: l.email });
          }
        }

        if (missingTables.length) {
          console.warn(
            'The following tables were not found in the target database and were skipped:',
            missingTables,
          );
          console.warn(
            'If you expect these tables to exist in Supabase, create them or run the appropriate migrations. No external sync was performed for missing tables.',
          );
        }

        await client.query('COMMIT');
        console.log('Postgres (DATABASE_URL) sync completed.');
      } catch (pgErr) {
        await client.query('ROLLBACK');
        console.error('Error syncing to Postgres via DATABASE_URL:', pgErr);
      } finally {
        client.release();
        await pool.end();
      }
    } else {
      console.warn(
        'No Supabase credentials or DATABASE_URL found; skipping external sync.',
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
