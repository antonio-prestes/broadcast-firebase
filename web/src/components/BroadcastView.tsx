import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestoreErrors';
import { Connection, Contact } from '../types';
import { isFutureSchedule } from '../utils/broadcastUtils';

interface BroadcastViewProps {
  initialConnectionId?: string | null;
  onNavigateToConnections: () => void;
  onNavigateToContacts: (connectionId: string) => void;
  onBroadcastCreated: () => void;
}

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  initialConnectionId,
  onNavigateToConnections,
  onNavigateToContacts,
  onBroadcastCreated,
}) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    initialConnectionId || ''
  );
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [content, setContent] = useState<string>('');
  const [deliveryMode, setDeliveryMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'connections'), where('tenantId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Connection[] = snapshot.docs.map((d) => ({
          id: d.id,
          tenantId: d.data().tenantId,
          name: d.data().name,
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));
        setConnections(list);
        if (!selectedConnectionId && list.length > 0) {
          setSelectedConnectionId(list[0].id);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'connections');
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (initialConnectionId) {
      setSelectedConnectionId(initialConnectionId);
    }
  }, [initialConnectionId]);

  useEffect(() => {
    if (!user || !selectedConnectionId) {
      setContacts([]);
      setSelectedContactIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'contacts'),
      where('tenantId', '==', user.uid),
      where('connectionId', '==', selectedConnectionId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Contact[] = snapshot.docs.map((d) => ({
          id: d.id,
          tenantId: d.data().tenantId,
          connectionId: d.data().connectionId,
          name: d.data().name,
          phone: d.data().phone,
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));
        setContacts(list);
        setSelectedContactIds(list.map((c) => c.id));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'contacts');
      }
    );

    return () => unsubscribe();
  }, [user, selectedConnectionId]);

  const setQuickSchedule = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const tzOffset = target.getTimezoneOffset() * 60000;
    const localISOTime = new Date(target.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledDateTime(localISOTime);
  };

  const handleToggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map((c) => c.id));
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFeedback(null);

    if (!selectedConnectionId) {
      setFeedback({ type: 'error', message: 'Selecione uma conexão.' });
      return;
    }
    if (selectedContactIds.length === 0) {
      setFeedback({ type: 'error', message: 'Selecione ao menos um contato.' });
      return;
    }
    if (!content.trim()) {
      setFeedback({ type: 'error', message: 'Escreva a mensagem.' });
      return;
    }

    let scheduledIso: string | null = null;
    let initialStatus: 'agendada' | 'enviada' = 'enviada';
    let sentAtIso: string | null = null;
    const nowIso = new Date().toISOString();

    if (deliveryMode === 'scheduled') {
      if (!scheduledDateTime) {
        setFeedback({
          type: 'error',
          message: 'Defina a data e horário para o agendamento.',
        });
        return;
      }
      if (!isFutureSchedule(scheduledDateTime)) {
        setFeedback({
          type: 'error',
          message: 'O agendamento deve ser em uma data e hora futura.',
        });
        return;
      }
      initialStatus = 'agendada';
      scheduledIso = new Date(scheduledDateTime).toISOString();
    } else {
      sentAtIso = nowIso;
    }

    setSubmitting(true);
    try {
      const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const recipientNames = contacts
        .filter((c) => selectedContactIds.includes(c.id))
        .map((c) => c.name);

      const msgDocRef = doc(db, 'messages', messageId);
      await setDoc(msgDocRef, {
        tenantId: user.uid,
        connectionId: selectedConnectionId,
        recipientContactIds: selectedContactIds,
        recipientNames,
        content: content.trim(),
        status: initialStatus,
        scheduledFor: scheduledIso,
        sentAt: sentAtIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      setContent('');
      onBroadcastCreated();
    } catch (err) {
      console.error('Error creating broadcast message:', err);
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Novo Envio</h1>
      </div>

      {connections.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-md p-6 flex items-center justify-between">
          <span className="text-sm text-zinc-500">Nenhuma conexão disponível.</span>
          <button
            type="button"
            onClick={onNavigateToConnections}
            className="text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
          >
            Criar conexão
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSendBroadcast}
          className="bg-white border border-zinc-200 rounded-md p-6 space-y-5"
        >
          {feedback && (
            <div
              className={`px-3 py-2 rounded border text-xs ${
                feedback.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div>
            <label htmlFor="broadcast-conn" className="block text-xs font-medium text-zinc-700 mb-1.5">
              Conexão
            </label>
            <select
              id="broadcast-conn"
              value={selectedConnectionId}
              onChange={(e) => setSelectedConnectionId(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md text-zinc-900 focus:outline-none focus:border-zinc-900"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-700">
                Destinatários ({selectedContactIds.length}/{contacts.length})
              </label>
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  {selectedContactIds.length === contacts.length
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-zinc-500">Carregando contatos...</div>
            ) : contacts.length === 0 ? (
              <div className="p-4 border border-zinc-200 rounded-md flex items-center justify-between">
                <span className="text-xs text-zinc-500">Nenhum contato nesta conexão.</span>
                <button
                  type="button"
                  onClick={() => onNavigateToContacts(selectedConnectionId)}
                  className="text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
                >
                  Adicionar contatos
                </button>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-md divide-y divide-zinc-100">
                {contacts.map((contact) => {
                  const isChecked = selectedContactIds.includes(contact.id);
                  return (
                    <label
                      key={contact.id}
                      className="flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 text-zinc-900">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleContact(contact.id)}
                          className="rounded border-zinc-300 text-zinc-900 focus:ring-0"
                        />
                        <span>{contact.name}</span>
                      </span>
                      <span className="font-mono text-zinc-500">{contact.phone}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="broadcast-msg" className="text-xs font-medium text-zinc-700">
                Mensagem
              </label>
              <span className="text-[11px] text-zinc-400">{content.length} caracteres</span>
            </div>
            <textarea
              id="broadcast-msg"
              rows={4}
              placeholder="Digite a mensagem..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md text-zinc-900 focus:outline-none focus:border-zinc-900 resize-y"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <label className="block text-xs font-medium text-zinc-700 mb-2">
              Envio
            </label>
            <div className="flex items-center gap-6 text-xs text-zinc-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deliveryMode"
                  value="immediate"
                  checked={deliveryMode === 'immediate'}
                  onChange={() => setDeliveryMode('immediate')}
                  className="text-zinc-900 focus:ring-0"
                />
                Enviar agora
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deliveryMode"
                  value="scheduled"
                  checked={deliveryMode === 'scheduled'}
                  onChange={() => setDeliveryMode('scheduled')}
                  className="text-zinc-900 focus:ring-0"
                />
                Agendar
              </label>
            </div>

            {deliveryMode === 'scheduled' && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-md text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setQuickSchedule(1)}
                    className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
                  >
                    +1 min
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSchedule(3)}
                    className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
                  >
                    +3 min
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || contacts.length === 0}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? 'Processando...'
                : deliveryMode === 'immediate'
                ? 'Enviar agora'
                : 'Agendar envio'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
