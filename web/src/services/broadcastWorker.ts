import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

let workerIntervalId: ReturnType<typeof setInterval> | null = null;

export function isBroadcastDue(
  message: { status?: string; scheduledFor?: string | null },
  nowIso: string
): boolean {
  return Boolean(
    message.status === 'agendada' &&
      message.scheduledFor &&
      message.scheduledFor <= nowIso
  );
}

export async function processDueBroadcasts(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;

  const nowIso = new Date().toISOString();
  const messagesRef = collection(db, 'messages');

  try {
    const q = query(
      messagesRef,
      where('tenantId', '==', user.uid),
      where('status', '==', 'agendada')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return 0;
    }

    const dueDocs = snapshot.docs.filter((d) => isBroadcastDue(d.data(), nowIso));

    if (dueDocs.length === 0) {
      return 0;
    }

    const batch = writeBatch(db);
    const sentAt = new Date().toISOString();

    dueDocs.forEach((docSnap) => {
      const docRef = doc(db, 'messages', docSnap.id);
      batch.update(docRef, {
        status: 'enviada',
        sentAt,
        updatedAt: sentAt,
      });
    });

    await batch.commit();
    return dueDocs.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'messages');
  }
}

export function startBroadcastWorker(intervalMs: number = 5000): void {
  if (workerIntervalId) return;

  processDueBroadcasts().catch((err) => console.warn('Erro ao processar agendamentos:', err));

  workerIntervalId = setInterval(() => {
    processDueBroadcasts().catch((err) => console.warn('Erro ao processar agendamentos:', err));
  }, intervalMs);
}

export function stopBroadcastWorker(): void {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }
}
