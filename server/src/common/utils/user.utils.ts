/**
 * Shared utility for User + profile relation flattening.
 * All services that return user data should use this.
 */

/** Prisma `include` object to fetch all profile relations */
export const USER_PROFILE_INCLUDE = {
  customer: true,
  admin: true,
  driver: true,
  recycler: true,
  corporate: true,
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
        }
      : {}),
  };
}
