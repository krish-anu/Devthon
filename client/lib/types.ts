export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN' | 'DRIVER';
export type CustomerType = 'HOUSEHOLD' | 'BUSINESS';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  type?: CustomerType;
  address?: string | null;
  status?: CustomerStatus;
  approved?: boolean;
  driverStatus?: 'ONLINE' | 'OFFLINE' | 'ON_PICKUP';
  createdAt: string;
  avatar?: string | null;
  totalPoints?: number;
}

export type BookingStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COLLECTED'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface WasteCategory {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface Booking {
  id: string;
  wasteCategory: WasteCategory;
  estimatedWeightRange: string;
  estimatedMinAmount: number;
  estimatedMaxAmount: number;
  addressLine1: string;
  city: string;
  postalCode: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  status: BookingStatus;
  actualWeightKg?: number | null;
  finalAmountLkr?: number | null;
  user?: {
    id?: string;
    fullName?: string | null;
    phone?: string | null;
    email?: string;
  } | null;
  driver?: {
    id: string;
    fullName: string;
    rating: number;
    phone: string;
  } | null;
  createdAt: string;
}

export interface PricingItem {
  id: string;
  minPriceLkrPerKg: number;
  maxPriceLkrPerKg: number;
  isActive: boolean;
  wasteCategory: WasteCategory;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  bookingId?: string | null;
  createdAt: string;
}

export interface RewardsSummary {
  totalPoints: number;
  monthPoints: number;
  monthRange: {
    yearMonth: string;
    start: string;
    end: string;
  };
  howToEarn: Array<{ label: string; value: string }>;
  recentPointsTransactions?: Array<{
    id: string;
    bookingId: string;
    pointsAwarded: number;
    basePoints: number;
    bonusPoints: number;
    multiplier: number;
    awardedAt: string;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  points: number;
}

export interface LeaderboardResponse {
  items: LeaderboardEntry[];
  monthRange?: {
    yearMonth: string;
    start: string;
    end: string;
  };
}
