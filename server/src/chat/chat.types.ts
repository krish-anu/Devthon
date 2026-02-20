import { Role } from '@prisma/client';

export type AssistantAuthRole = Role | 'GUEST';

export type ChatMode = 'knowledge' | 'data' | 'mixed';

export type SuggestedAction = {
  label: string;
  href: string;
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

