import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestoreErrors';
import { BroadcastMessage, Connection } from '../types';
import { filterMessages } from '../utils/broadcastUtils';

interface MessagesFeedProps {
  onNavigateToBroadcast: () => void;
}

export const MessagesFeed: React.FC<MessagesFeedProps> = ({ onNavigateToBroadcast }) => {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'enviada' | 'agendada'>('all');
  const [selectedConnectionFilter, setSelectedConnectionFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const [editingMsg, setEditingMsg] = useState<BroadcastMessage | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editScheduleTime, setEditScheduleTime] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteModalMsg, setDeleteModalMsg] = useState<BroadcastMessage | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'connections'), where('tenantId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Connection[] = snapshot.docs.map((d) => ({
        id: d.id,
        tenantId: d.data().tenantId,
        name: d.data().name,
        createdAt: d.data().createdAt,
        updatedAt: d.data().updatedAt,
      }));
      setConnections(list);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'messages'), where('tenantId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: BroadcastMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          tenantId: d.data().tenantId,
          connectionId: d.data().connectionId,
          recipientContactIds: d.data().recipientContactIds || [],
          recipientNames: d.data().recipientNames || [],
          content: d.data().content,
          status: d.data().status,
          scheduledFor: d.data().scheduledFor || null,
          sentAt: d.data().sentAt || null,
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));

        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMessages(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'messages');
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleOpenEdit = (msg: BroadcastMessage) => {
    setEditingMsg(msg);
    setEditContent(msg.content);
    if (msg.scheduledFor) {
      const target = new Date(msg.scheduledFor);
      const tzOffset = target.getTimezoneOffset() * 60000;
      const localISOTime = new Date(target.getTime() - tzOffset).toISOString().slice(0, 16);
      setEditScheduleTime(localISOTime);
    } else {
      setEditScheduleTime('');
    }
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMsg || !user) return;
    if (!editContent.trim()) {
      setEditError('A mensagem não pode ficar vazia.');
      return;
    }

    let newScheduledIso = editingMsg.scheduledFor;
    if (editingMsg.status === 'agendada' && editScheduleTime) {
      const selected = new Date(editScheduleTime);
      if (isNaN(selected.getTime()) || selected.getTime() <= Date.now()) {
        setEditError('A data/hora de agendamento deve ser futura.');
        return;
      }
      newScheduledIso = selected.toISOString();
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      const docRef = doc(db, 'messages', editingMsg.id);
      await updateDoc(docRef, {
        content: editContent.trim(),
        scheduledFor: newScheduledIso,
        updatedAt: new Date().toISOString(),
      });
      setEditingMsg(null);
    } catch (err) {
      console.error('Error updating message:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'messages');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteModalMsg || !user) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'messages', deleteModalMsg.id));
      setDeleteModalMsg(null);
    } catch (err) {
      console.error('Error deleting message:', err);
      handleFirestoreError(err, OperationType.DELETE, 'messages');
    } finally {
      setDeleting(false);
    }
  };

  const filteredMessages = filterMessages(messages, statusFilter, selectedConnectionFilter);

  const getConnName = (connId: string) => {
    return connections.find((c) => c.id === connId)?.name || '—';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Histórico</h1>
        <button
          type="button"
          onClick={onNavigateToBroadcast}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
        >
          + Novo envio
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 self-start">
          {(
            [
              { id: 'all', label: `Todas (${messages.length})` },
              {
                id: 'enviada',
                label: `Enviadas (${messages.filter((m) => m.status === 'enviada').length})`,
              },
              {
                id: 'agendada',
                label: `Agendadas (${messages.filter((m) => m.status === 'agendada').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {connections.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="history-conn-filter" className="text-xs text-zinc-500">
              Conexão:
            </label>
            <select
              id="history-conn-filter"
              value={selectedConnectionFilter}
              onChange={(e) => setSelectedConnectionFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-md text-zinc-900 focus:outline-none focus:border-zinc-900"
            >
              <option value="all">Todas</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500">Carregando...</div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-md p-6 flex items-center justify-between">
          <span className="text-sm text-zinc-500">Nenhuma mensagem encontrada.</span>
          <button
            type="button"
            onClick={onNavigateToBroadcast}
            className="text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
          >
            Novo envio
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-md divide-y divide-zinc-200">
          {filteredMessages.map((msg) => {
            const isAgendada = msg.status === 'agendada';
            const connName = getConnName(msg.connectionId);

            return (
              <div key={msg.id} className="p-4 hover:bg-zinc-50/50 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 text-xs flex-wrap">
                    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isAgendada ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                      />
                      {isAgendada ? 'Agendada' : 'Enviada'}
                    </span>
                    <span className="text-zinc-300">·</span>
                    <span className="text-zinc-600">{connName}</span>
                    <span className="text-zinc-300">·</span>
                    <span className="text-zinc-500">
                      {msg.recipientContactIds.length}{' '}
                      {msg.recipientContactIds.length === 1 ? 'destinatário' : 'destinatários'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {isAgendada && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(msg)}
                        className="text-zinc-500 hover:text-zinc-900 cursor-pointer"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteModalMsg(msg)}
                      className="text-zinc-500 hover:text-red-600 cursor-pointer"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                <p className="text-sm text-zinc-900 whitespace-pre-wrap break-words mb-2">
                  {msg.content}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                  <div>
                    {msg.recipientNames && msg.recipientNames.length > 0 && (
                      <span>
                        Para: {msg.recipientNames.slice(0, 5).join(', ')}
                        {msg.recipientNames.length > 5 && ` (+${msg.recipientNames.length - 5})`}
                      </span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums space-x-2">
                    {isAgendada && msg.scheduledFor ? (
                      <span className="text-amber-700">
                        Agendada: {new Date(msg.scheduledFor).toLocaleString()}
                      </span>
                    ) : msg.sentAt ? (
                      <span>Enviada: {new Date(msg.sentAt).toLocaleString()}</span>
                    ) : (
                      <span>Criada: {new Date(msg.createdAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Editar Mensagem */}
      <Dialog
        open={Boolean(editingMsg)}
        onClose={() => !savingEdit && setEditingMsg(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '0.95rem', pb: 1 }}>
          Editar mensagem
        </DialogTitle>
        <form onSubmit={handleSaveEdit}>
          <DialogContent sx={{ pt: 1 }}>
            {editError && (
              <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                {editError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  disabled={savingEdit}
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900"
                />
              </div>

              {editingMsg?.status === 'agendada' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Data e horário
                  </label>
                  <input
                    type="datetime-local"
                    value={editScheduleTime}
                    onChange={(e) => setEditScheduleTime(e.target.value)}
                    disabled={savingEdit}
                    required
                    className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900"
                  />
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <button
              type="button"
              onClick={() => setEditingMsg(null)}
              disabled={savingEdit}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md cursor-pointer disabled:opacity-50"
            >
              {savingEdit ? 'Salvando...' : 'Salvar'}
            </button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Excluir Mensagem */}
      <Dialog
        open={Boolean(deleteModalMsg)}
        onClose={() => !deleting && setDeleteModalMsg(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '0.95rem', pb: 1 }}>
          Excluir mensagem
        </DialogTitle>
        <DialogContent>
          <p className="text-xs text-zinc-600">
            Deseja excluir este registro de mensagem?
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <button
            type="button"
            onClick={() => setDeleteModalMsg(null)}
            disabled={deleting}
            className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDeleteMessage}
            disabled={deleting}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md cursor-pointer disabled:opacity-50"
          >
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
