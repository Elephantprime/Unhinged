// Clean Simple Matching System - User's Exact Implementation
// ❌ X button → dislike → goes into views + recycling
// ❤️ Heart button → like → goes into likes + recycling (+ match check)
// ♻️ Recycle button → puts seen profiles back into the pool

import { db } from './firebase.js';
import { 
  doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Put a profile into the recycling bin */
async function recycleProfile(myUid, targetUid, action) {
  const recycleRef = doc(db, "recycling", `${myUid}_${targetUid}`);
  await setDoc(recycleRef, {
    from: myUid,
    to: targetUid,
    action, // "like" or "dislike"
    createdAt: serverTimestamp(),
    recycled: false
  });
}

/** Like */
export async function likeUser(myUid, targetUid) {
  await recycleProfile(myUid, targetUid, "like");

  const likeRef = doc(db, "likes", `${myUid}_${targetUid}`);
  await setDoc(likeRef, { from: myUid, to: targetUid, createdAt: serverTimestamp() });

  // check reciprocal like for match
  const reciprocalRef = doc(db, "likes", `${targetUid}_${myUid}`);
  const snap = await getDoc(reciprocalRef);
  if (snap.exists()) {
    const matchId = [myUid, targetUid].sort().join("_");
    const matchRef = doc(db, "matches", matchId);
    await setDoc(matchRef, { uids: [myUid, targetUid], createdAt: serverTimestamp() });

    // create chat
    const chatRef = doc(db, "chats", matchId);
    await setDoc(chatRef, { uids: [myUid, targetUid], createdAt: serverTimestamp() });
  }
}

/** Dislike */
export async function dislikeUser(myUid, targetUid) {
  await recycleProfile(myUid, targetUid, "dislike");
  const viewRef = doc(db, "views", `${myUid}_${targetUid}`);
  await setDoc(viewRef, { from: myUid, to: targetUid, createdAt: serverTimestamp() });
}

/** Load recycled UIDs for a user */
export async function loadRecycledUids(myUid) {
  const q = query(
    collection(db, "recycling"),
    where("from", "==", myUid),
    where("recycled", "==", false)
  );
  const snap = await getDocs(q);
  const uids = new Set();
  snap.forEach(doc => {
    const data = doc.data();
    if (data?.to) uids.add(data.to);
  });
  return uids;
}

/** Apply deck filters - exclude self and recycled profiles */
export function applyDeckFilters(deck, selfUid, recycledUids = new Set()) {
  return deck.filter(profile => profile.uid !== selfUid && !recycledUids.has(profile.uid));
}

/** Recycle back profiles */
export async function recycleAll(myUid) {
  const q = query(
    collection(db, "recycling"),
    where("from", "==", myUid),
    where("recycled", "==", false)
  );
  const snap = await getDocs(q);
  const recycled = [];
  snap.forEach((docSnap) => {
    recycled.push(docSnap.data());
  });

  for (const item of recycled) {
    const ref = doc(db, "recycling", `${item.from}_${item.to}`);
    await setDoc(ref, { ...item, recycled: true }, { merge: true });
  }

  return recycled;
}

/** Send a chat message */
export async function sendMessage(chatId, fromUid, text) {
  try {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      from: fromUid,
      text: text,
      createdAt: serverTimestamp()
    });
    console.log('💬 Message sent to chat:', chatId);
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}
