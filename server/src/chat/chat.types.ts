import { Role } from '@prisma/client';

export type AssistantAuthRole = Role | 'GUEST';

export type ChatMode = 'knowledge' | 'data' | 'mixed';
export type ChatLanguage = 'EN' | 'SI' | 'TA';
export type ChatLanguagePreference = ChatLanguage | 'AUTO';

export type SuggestedAction = {
  label: string;
  href: string;
};

export type BookingAssistantDraft = {
  wasteCategoryId?: string;
  wasteCategoryName?: string;
  quantityKg?: number;
  weightRangeLabel?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  specialInstructions?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  lat?: number;
  lng?: number;
  locationPicked?: boolean;
};

export type AuthContext = {
  isAuthenticated: boolean;
  userId: string | null;
  role: AssistantAuthRole;
};

export type StoredChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type KnowledgeChunk = {
  id: string;
  sourceFile: string;
  section: string;
  text: string;
};

export type RetrievedKnowledgeChunk = KnowledgeChunk & {
  score: number;
};
