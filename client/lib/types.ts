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
  createdAt: string;
  avatar?: string | null;
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
