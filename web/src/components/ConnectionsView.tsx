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
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestoreErrors';
import { Connection } from '../types';

interface ConnectionsViewProps {
  onSelectConnectionForContacts: (connectionId: string) => void;
  onSelectConnectionForBroadcast: (connectionId: string) => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  onSelectConnectionForContacts,
  onSelectConnectionForBroadcast,
}) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [connectionName, setConnectionName] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteModalConn, setDeleteModalConn] = useState<Connection | null>(null);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    setLoading(true);

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
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'connections');
      }
    );

    const contactsQuery = query(collection(db, 'contacts'), where('tenantId', '==', user.uid));
    const unsubscribeContacts = onSnapshot(
      contactsQuery,
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((d) => {
          const connId = d.data().connectionId;
          if (connId) {
            counts[connId] = (counts[connId] || 0) + 1;
          }
        });
        setContactCounts(counts);
      },
      (error) => {
        console.warn('Error fetching contact counts:', error);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeContacts();
    };
  }, [user]);

  const handleOpenCreate = () => {
    setEditingConn(null);
    setConnectionName('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (conn: Connection) => {
    setEditingConn(conn);
    setConnectionName(conn.name);
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!connectionName.trim()) {
      setErrorMsg('Informe o nome da conexão.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    const nowIso = new Date().toISOString();

    try {
      if (editingConn) {
        const docRef = doc(db, 'connections', editingConn.id);
        await updateDoc(docRef, {
          name: connectionName.trim(),
          updatedAt: nowIso,
        });
      } else {
        const id = 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const docRef = doc(db, 'connections', id);
        await setDoc(docRef, {
          tenantId: user.uid,
          name: connectionName.trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      console.error('Error saving connection:', err);
      handleFirestoreError(
        err,
        editingConn ? OperationType.UPDATE : OperationType.CREATE,
        'connections'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalConn || !user) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'connections', deleteModalConn.id));
      setDeleteModalConn(null);
    } catch (err) {
      console.error('Error deleting connection:', err);
      handleFirestoreError(err, OperationType.DELETE, 'connections');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Conexões</h1>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
        >
          + Nova conexão
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500">Carregando...</div>
      ) : connections.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-md p-6 flex items-center justify-between">
          <span className="text-sm text-zinc-500">Nenhuma conexão cadastrada.</span>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
          >
            Criar primeira conexão
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-md divide-y divide-zinc-200">
          {connections.map((conn) => {
            const count = contactCounts[conn.id] || 0;
            return (
              <div
                key={conn.id}
                className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm text-zinc-900">{conn.name}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                    {count} {count === 1 ? 'contato' : 'contatos'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => onSelectConnectionForContacts(conn.id)}
                    className="text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                  >
                    Contatos
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectConnectionForBroadcast(conn.id)}
                    className="text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                  >
                    Enviar mensagem
                  </button>
                  <span className="text-zinc-200">|</span>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(conn)}
                    className="text-zinc-500 hover:text-zinc-900 cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModalConn(conn)}
                    className="text-zinc-500 hover:text-red-600 cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '0.95rem', pb: 1 }}>
          {editingConn ? 'Editar conexão' : 'Nova conexão'}
        </DialogTitle>
        <form onSubmit={handleSave}>
          <DialogContent sx={{ pt: 1 }}>
            {errorMsg && (
              <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Nome da conexão
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Ex: WhatsApp Comercial"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              disabled={saving}
              required
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Confirmação de Exclusão */}
      <Dialog
        open={Boolean(deleteModalConn)}
        onClose={() => !saving && setDeleteModalConn(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '0.95rem', pb: 1 }}>
          Excluir conexão
        </DialogTitle>
        <DialogContent>
          <p className="text-xs text-zinc-600">
            Deseja excluir a conexão <strong>{deleteModalConn?.name}</strong>?
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <button
            type="button"
            onClick={() => setDeleteModalConn(null)}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Excluindo...' : 'Excluir'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
