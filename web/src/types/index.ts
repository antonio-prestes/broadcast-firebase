export interface Connection {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  connectionId: string;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export type BroadcastStatus = 'agendada' | 'enviada';

export interface BroadcastMessage {
  id: string;
  tenantId: string;
  connectionId: string;
  recipientContactIds: string[];
  recipientNames: string[];
  content: string;
  status: BroadcastStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
