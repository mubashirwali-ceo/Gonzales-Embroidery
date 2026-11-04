import { db } from "./fb.js";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Creates the client profile + gives the next sequential client ID (GE-1001, GE-1002 ...)
export async function createProfile(user, data) {
  const counterRef = doc(db, "meta", "clientCounter");
  const userRef = doc(db, "users", user.uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists()) return;
    const snap = await tx.get(counterRef);
    const n = snap.exists() ? Number(snap.data().n) + 1 : 1;
    tx.set(counterRef, { n });
    tx.set(userRef, {
      clientId: "GE-" + (1000 + n),
      name: data.name || user.displayName || "",
      email: user.email,
      phone: data.phone || "",
      address: data.address || "",
      work: data.work || "",
      createdAt: serverTimestamp()
    });
  });
}
