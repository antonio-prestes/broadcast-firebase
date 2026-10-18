import { describe, it, expect } from 'vitest';
import {
  formatPhone,
  isValidPhone,
  filterContacts,
  filterMessages,
  isFutureSchedule,
} from '../utils/broadcastUtils';
import { isBroadcastDue } from '../services/broadcastWorker';
import { Contact, BroadcastMessage } from '../types';

describe('formatPhone & isValidPhone', () => {
  it('formata números de celular com 11 dígitos corretamente', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formata números parciais durante a digitação', () => {
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('11987')).toBe('(11) 987');
  });

  it('valida se o telefone possui entre 10 e 11 dígitos numéricos', () => {
    expect(isValidPhone('(11) 98765-4321')).toBe(true);
    expect(isValidPhone('(11) 3456-7890')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
  });
});

describe('filterContacts', () => {
  const mockContacts: Contact[] = [
    {
      id: 'c1',
      tenantId: 't1',
      connectionId: 'conn1',
      name: 'Maria Oliveira',
      phone: '(11) 99999-1111',
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'c2',
      tenantId: 't1',
      connectionId: 'conn1',
      name: 'Carlos Souza',
      phone: '(21) 98888-2222',
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ];

  it('retorna todos os contatos quando a busca está vazia', () => {
    expect(filterContacts(mockContacts, '')).toHaveLength(2);
  });

  it('filtra contatos por nome ignorando maiúsculas/minúsculas', () => {
    const result = filterContacts(mockContacts, 'maria');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('filtra contatos por trecho do telefone', () => {
    const result = filterContacts(mockContacts, '98888');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });
});

describe('filterMessages', () => {
  const mockMessages: BroadcastMessage[] = [
    {
      id: 'm1',
      tenantId: 't1',
      connectionId: 'conn1',
      recipientContactIds: ['c1'],
      recipientNames: ['Maria'],
      content: 'Aviso 1',
      status: 'enviada',
      scheduledFor: null,
      sentAt: '2026-10-18T10:00:00.000Z',
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'm2',
      tenantId: 't1',
      connectionId: 'conn2',
      recipientContactIds: ['c2'],
      recipientNames: ['Carlos'],
      content: 'Aviso agendado',
      status: 'agendada',
      scheduledFor: '2026-10-18T15:00:00.000Z',
      sentAt: null,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ];

  it('filtra mensagens por status enviada ou agendada', () => {
    expect(filterMessages(mockMessages, 'enviada', 'all')).toHaveLength(1);
    expect(filterMessages(mockMessages, 'agendada', 'all')).toHaveLength(1);
    expect(filterMessages(mockMessages, 'all', 'all')).toHaveLength(2);
  });

  it('filtra mensagens por conexão selecionada', () => {
    const result = filterMessages(mockMessages, 'all', 'conn2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m2');
  });
});

describe('isFutureSchedule & isBroadcastDue', () => {
  it('verifica corretamente se o agendamento está no futuro', () => {
    const now = new Date('2026-10-18T12:00:00.000Z').getTime();
    expect(isFutureSchedule('2026-10-18T12:05:00.000Z', now)).toBe(true);
    expect(isFutureSchedule('2026-10-18T11:55:00.000Z', now)).toBe(false);
    expect(isFutureSchedule('', now)).toBe(false);
  });

  it('identifica quando uma mensagem agendada atingiu o horário de envio', () => {
    const nowIso = '2026-10-18T12:00:00.000Z';

    expect(
      isBroadcastDue(
        { status: 'agendada', scheduledFor: '2026-10-18T11:59:00.000Z' },
        nowIso
      )
    ).toBe(true);

    expect(
      isBroadcastDue(
        { status: 'agendada', scheduledFor: '2026-10-18T12:05:00.000Z' },
        nowIso
      )
    ).toBe(false);

    expect(
      isBroadcastDue(
        { status: 'enviada', scheduledFor: '2026-10-18T11:00:00.000Z' },
        nowIso
      )
    ).toBe(false);
  });
});
