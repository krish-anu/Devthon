/**
 * Shared utility for User + profile relation flattening.
 * All services that return user data should use this.
 */

/** Prisma `include` object to fetch all profile relations */
// Explicitly select profile fields to avoid runtime failures on databases
// that may be missing newer optional columns (e.g. `avatarUrl`). Selecting
// fields explicitly prevents Prisma from requesting non-existent columns.
export const USER_PROFILE_INCLUDE = {
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      address: true,
      avatarUrl: true,
      type: true,
      status: true,
      createdAt: true,
    },
  },
  admin: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      address: true,
      avatarUrl: true,
      approved: true,
    },
  },
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      rating: true,
      pickupCount: true,
      vehicle: true,
      status: true,
      approved: true,
      createdAt: true,
    },
  },
  recycler: {
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      phone: true,
      materialTypes: true,
      createdAt: true,
    },
  },
  corporate: {
    select: {
      id: true,
      organizationName: true,
      contactName: true,
      phone: true,
      requirements: true,
      createdAt: true,
    },
  },
} as const;

/**
 * Flatten a User record (with profile relations) into a single API-friendly
 * object. Strips sensitive fields (passwordHash, refreshTokenHash,
 * passkeyCredentials).
 */
export function flattenUser(user: any) {
  if (!user) return user;
  const {
    passwordHash,
    refreshTokenHash,
    customer,
    admin,
    driver,
    recycler,
    corporate,
    passkeyCredentials,
    userPermissions,
    roleChangeLogs,
    ...base
  } = user;

  const profile = customer || admin || driver || recycler || corporate || {};

  return {
    ...base,
    fullName: profile.fullName ?? null,
    phone: profile.phone ?? null,
    address: profile.address ?? null,
    avatar: profile.avatarUrl ?? null,
    // Customer-specific
    ...(customer ? { type: customer.type, status: customer.status } : {}),
    // Admin-specific
    ...(admin ? { approved: admin.approved } : {}),
    // Driver-specific
    ...(driver
      ? {
          vehicle: driver.vehicle,
          rating: driver.rating,
          pickupCount: driver.pickupCount,
          driverStatus: driver.status,
          approved: driver.approved,
        }
      : {}),
  };
}
