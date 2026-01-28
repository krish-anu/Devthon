export type UserRole = 'USER' | 'ADMIN' | 'DRIVER';
export type UserType = 'HOUSEHOLD' | 'BUSINESS';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  type: UserType;
  address?: string | null;
  status: UserStatus;
  createdAt: string;
}

export type BookingStatus =
  | 'SCHEDULED'
  | 'COLLECTED'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface WasteCategory {
  id: string;
  name: string;
  description?: string | null;
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
  driver?: {
    id: string;
    name: string;
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
  createdAt: string;
}
