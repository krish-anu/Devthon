import {
  PrismaClient,
  BookingStatus,
  CustomerStatus,
  CustomerType,
  DriverStatus,
  NotificationLevel,
  PaymentMethod,
  PaymentStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const prisma = new PrismaClient();

async function main() {
  // Delete in reverse-dependency order
  await prisma.paymentTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.passkeyCredential.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.roleChangeLog.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.launchNotify.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Create admin user + admin profile
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@trash2cash.lk',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  await prisma.admin.create({
    data: {
      id: adminUser.id,
      fullName: 'Admin Team',
      phone: '+94 77 000 0000',
      address: 'Trash2Cash HQ, Colombo',
      approved: true,
    },
  });

  // Create customer user: Rajesh
  const rajeshUser = await prisma.user.create({
    data: {
      email: 'rajesh@trash2cash.lk',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });
  await prisma.customer.create({
    data: {
      id: rajeshUser.id,
      fullName: 'Rajesh Perera',
      phone: '+94 77 111 2222',
      type: CustomerType.HOUSEHOLD,
      status: CustomerStatus.ACTIVE,
      address: '45 Galle Road, Colombo 03',
      type: CustomerType.HOUSEHOLD,
      status: CustomerStatus.ACTIVE,
    },
  });

  // Create customer user: Samantha
  const samanthaUser = await prisma.user.create({
    data: {
      email: 'samantha@trash2cash.lk',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });
  await prisma.customer.create({
    data: {
      id: samanthaUser.id,
      fullName: 'Samantha Silva',
      phone: '+94 77 333 4444',
      type: CustomerType.BUSINESS,
      status: CustomerStatus.ACTIVE,
      address: 'Industrial Park, Negombo',
      type: CustomerType.BUSINESS,
      status: CustomerStatus.ACTIVE,
    },
  });

  // Create driver users + driver profiles (1:1 with User)
  const driverData = [
    {
      email: 'sunil@trash2cash.lk',
      fullName: 'Sunil Jayasinghe',
      phone: '+94 77 555 0101',
      rating: 4.8,
      pickupCount: 128,
      vehicle: 'Truck',
      status: DriverStatus.ON_PICKUP,
    },
    {
      email: 'nimali@trash2cash.lk',
      fullName: 'Nimali Fernando',
      phone: '+94 77 555 0202',
      rating: 4.6,
      pickupCount: 94,
      vehicle: 'Van',
      status: DriverStatus.ONLINE,
    },
    {
      email: 'kasun@trash2cash.lk',
      fullName: 'Kasun Abeysekera',
      phone: '+94 77 555 0303',
      rating: 4.4,
      pickupCount: 64,
      vehicle: 'Three-wheeler',
      status: DriverStatus.OFFLINE,
    },
  ];

  const drivers: any[] = [];
  for (const dd of driverData) {
    const driverUser = await prisma.user.create({
      data: {
        email: dd.email,
        passwordHash,
        role: Role.DRIVER,
      },
    });
    const driver = await prisma.driver.create({
      data: {
        id: driverUser.id,
        fullName: dd.fullName,
        phone: dd.phone,
        rating: dd.rating,
        pickupCount: dd.pickupCount,
        vehicle: dd.vehicle,
        status: dd.status,
      },
    });
    drivers.push(driver);
  }

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

  // Ensure each category has a pricing entry
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
      userId: rajeshUser.id,
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
      userId: rajeshUser.id,
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
      userId: samanthaUser.id,
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
        userId: rajeshUser.id,
        title: 'Pickup completed',
        message: 'Your metal pickup is complete. Payment processed.',
        level: NotificationLevel.SUCCESS,
      },
      {
        userId: rajeshUser.id,
        title: 'Driver en route',
        message: 'Driver Nimali is 15 minutes away.',
        level: NotificationLevel.INFO,
      },
      {
        userId: samanthaUser.id,
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
    admin: adminUser.email,
    rajesh: rajeshUser.email,
    samantha: samanthaUser.email,
    drivers: drivers.map((d) => d.fullName),
  });

  // If Supabase credentials are available, mirror the seeded rows to Supabase
  if (supabaseClient) {
    const supabase = supabaseClient;

    try {
      // Upsert users
      const allUsers = await prisma.user.findMany({
        include: { customer: true, admin: true, driver: true },
      });
      const supUsers = allUsers.map((u) => {
        const profile = u.customer || u.admin || u.driver;
        return {
          id: u.id,
          email: u.email,
          role: u.role,
          fullName: (profile as any)?.fullName ?? null,
          phone: (profile as any)?.phone ?? null,
        };
      });
      await supabase.from('users').upsert(supUsers, { onConflict: 'id' });

      // Upsert customers
      const allCustomers = await prisma.customer.findMany();
      const supCustomers = allCustomers.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        address: c.address,
        type: c.type,
        status: c.status,
      }));
      if (supCustomers.length)
        await supabase.from('customers').upsert(supCustomers, { onConflict: 'id' });

      // Upsert admins
      const allAdmins = await prisma.admin.findMany();
      const supAdmins = allAdmins.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        phone: a.phone,
        address: a.address,
        approved: a.approved,
      }));
      if (supAdmins.length)
        await supabase.from('admins').upsert(supAdmins, { onConflict: 'id' });

      // Upsert drivers
      const supDrivers = drivers.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        phone: d.phone,
        rating: d.rating,
        pickupCount: d.pickupCount,
        vehicle: d.vehicle,
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
    console.warn('No Supabase credentials found; skipping external sync.');
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
