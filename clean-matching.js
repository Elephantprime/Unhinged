// Clean Simple Matching System - User's Exact Implementation
// ❌ X button → dislike → goes into views + recycling
// ❤️ Heart button → like → goes into likes + recycling (+ match check)
// ♻️ Recycle button → puts seen profiles back into the pool

import { db } from './firebase.js';
import { 
  doc, setDoc, getDoc, addDoc, collection, query, getDocs, serverTimestamp
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

/** Recycle back profiles */
export async function recycleAll(myUid) {
  const q = query(collection(db, "recycling"));
  const snap = await getDocs(q);
  const recycled = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.from === myUid && !data.recycled) {
      recycled.push(data);
    }
  });

  for (const item of recycled) {
    const ref = doc(db, "recycling", `${item.from}_${item.to}`);
    await setDoc(ref, { ...item, recycled: true }, { merge: true });
  }

  return recycled;
}