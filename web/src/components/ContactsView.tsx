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
import { Connection, Contact } from '../types';
import { formatPhone } from '../utils/broadcastUtils';

interface ContactsViewProps {
  initialConnectionId?: string | null;
  onNavigateToConnections: () => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  initialConnectionId,
  onNavigateToConnections,
}) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    initialConnectionId || ''
  );
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteModalContact, setDeleteModalContact] = useState<Contact | null>(null);

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
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'contacts');
      }
    );

    return () => unsubscribe();
  }, [user, selectedConnectionId]);

  const handleOpenCreate = () => {
    setEditingContact(null);
    setName('');
    setPhone('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone);
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(formatPhone(val));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      setErrorMsg('Informe o nome do contato.');
      return;
    }
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 8) {
      setErrorMsg('Informe um telefone válido com DDD.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    const nowIso = new Date().toISOString();

    try {
      if (editingContact) {
        const docRef = doc(db, 'contacts', editingContact.id);
        await updateDoc(docRef, {
          name: name.trim(),
          phone: cleanPhone,
          updatedAt: nowIso,
        });
      } else {
        const id = 'contact_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const docRef = doc(db, 'contacts', id);
        await setDoc(docRef, {
          tenantId: user.uid,
          connectionId: selectedConnectionId,
          name: name.trim(),
          phone: cleanPhone,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      setDialogOpen(false);
    } catch (err) {
      console.error('Error saving contact:', err);
      handleFirestoreError(
        err,
        editingContact ? OperationType.UPDATE : OperationType.CREATE,
        'contacts'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalContact || !user) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'contacts', deleteModalContact.id));
      setDeleteModalContact(null);
    } catch (err) {
      console.error('Error deleting contact:', err);
      handleFirestoreError(err, OperationType.DELETE, 'contacts');
    } finally {
      setSaving(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const currentConnection = connections.find((c) => c.id === selectedConnectionId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Contatos</h1>
        {selectedConnectionId && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
          >
            + Novo contato
          </button>
        )}
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
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label htmlFor="conn-select" className="text-xs text-zinc-500">
                Conexão:
              </label>
              <select
                id="conn-select"
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-md text-zinc-900 focus:outline-none focus:border-zinc-900"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-md text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">Carregando...</div>
          ) : contacts.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-md p-6 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Nenhum contato em "{currentConnection?.name}".
              </span>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
              >
                Adicionar contato
              </button>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Nenhum resultado para "{searchQuery}".
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5">Nome</th>
                    <th className="px-4 py-2.5">Telefone</th>
                    <th className="px-4 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {contact.name}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-600">
                        {contact.phone}
                      </td>
                      <td className="px-4 py-3 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(contact)}
                          className="text-zinc-500 hover:text-zinc-900 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModalContact(contact)}
                          className="text-zinc-500 hover:text-red-600 cursor-pointer"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal Criar/Editar Contato */}
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '0.95rem', pb: 1 }}>
          {editingContact ? 'Editar contato' : 'Novo contato'}
        </DialogTitle>
        <form onSubmit={handleSave}>
          <DialogContent sx={{ pt: 1 }}>
            {errorMsg && (
              <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nome
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome do contato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  required
                  className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={saving}
                  required
                  className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>
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
        open={Boolean(deleteModalContact)}
        onClose={() => !saving && setDeleteModalContact(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '0.95rem', pb: 1 }}>
          Excluir contato
        </DialogTitle>
        <DialogContent>
          <p className="text-xs text-zinc-600">
            Deseja remover <strong>{deleteModalContact?.name}</strong> ({deleteModalContact?.phone})?
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <button
            type="button"
            onClick={() => setDeleteModalContact(null)}
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
