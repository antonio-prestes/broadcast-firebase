import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const processScheduledBroadcasts = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const nowIso = new Date().toISOString();

    const snapshot = await db
      .collection("messages")
      .where("status", "==", "agendada")
      .where("scheduledFor", "<=", nowIso)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = db.batch();
    const sentTimestamp = new Date().toISOString();

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        status: "enviada",
        sentAt: sentTimestamp,
        updatedAt: sentTimestamp,
      });
    });

    await batch.commit();
  }
);
