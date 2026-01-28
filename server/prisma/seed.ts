import { PrismaClient, BookingStatus, DriverStatus, NotificationLevel, PaymentMethod, PaymentStatus, Role, UserStatus, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.paymentTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.pricing.deleteMany();
  await prisma.wasteCategory.deleteMany();
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

  const categories = await prisma.$transaction([
    prisma.wasteCategory.create({
      data: { name: 'Plastic', description: 'PET bottles, HDPE, mixed plastics' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'Paper', description: 'Cardboard and paper packaging' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'Metal', description: 'Aluminum cans and scrap metal' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'E-Waste', description: 'Old electronics and devices' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'Glass', description: 'Glass bottles and jars' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'Organic', description: 'Food waste and compostables' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'Copper Wire', description: 'Copper wiring and cables' },
    }),
    prisma.wasteCategory.create({
      data: { name: 'Batteries', description: 'Household batteries' },
    }),
  ]);

  await prisma.$transaction([
    prisma.pricing.create({
      data: {
        wasteCategoryId: categories[0].id,
        minPriceLkrPerKg: 45,
        maxPriceLkrPerKg: 70,
      },
    }),
    prisma.pricing.create({
      data: {
        wasteCategoryId: categories[2].id,
        minPriceLkrPerKg: 160,
        maxPriceLkrPerKg: 240,
      },
    }),
    prisma.pricing.create({
      data: {
        wasteCategoryId: categories[1].id,
        minPriceLkrPerKg: 30,
        maxPriceLkrPerKg: 55,
      },
    }),
    prisma.pricing.create({
      data: {
        wasteCategoryId: categories[3].id,
        minPriceLkrPerKg: 220,
        maxPriceLkrPerKg: 450,
      },
    }),
  ]);

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
