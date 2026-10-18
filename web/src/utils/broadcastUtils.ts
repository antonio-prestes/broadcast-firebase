import { Contact, BroadcastMessage } from '../types';

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

export function filterContacts(contacts: Contact[], searchQuery: string): Contact[] {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return contacts;

  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(normalized) ||
      c.phone.toLowerCase().includes(normalized)
  );
}

export function filterMessages(
  messages: BroadcastMessage[],
  statusFilter: 'all' | 'enviada' | 'agendada',
  connectionFilter: string
): BroadcastMessage[] {
  return messages.filter((msg) => {
    if (statusFilter !== 'all' && msg.status !== statusFilter) {
      return false;
    }
    if (connectionFilter !== 'all' && msg.connectionId !== connectionFilter) {
      return false;
    }
    return true;
  });
}

export function isFutureSchedule(scheduledDateTime: string, nowMs: number = Date.now()): boolean {
  if (!scheduledDateTime) return false;
  const timestamp = new Date(scheduledDateTime).getTime();
  return !Number.isNaN(timestamp) && timestamp > nowMs;
}
