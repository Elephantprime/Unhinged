// 🔧 MATCHING + CHAT FULL WIRING BASED ON PROFILE.HTML LAYOUT

import { auth, db, getDoc, doc, setDoc, getDocs, collection, serverTimestamp, query, where, addDoc } from "./firebase.js";

import { applyDeckFilters, wirePassLike, restoreFromRecycle, wireRecycleAction } from "./deck-filters.js"; 
import { likeUser, dislikeUser, recycleAll, sendMessage } from "./clean-matching.js";

// 🔄 STATE 
let currentDeck = []; 
let currentProfile = null;

export function getDeck() { return currentDeck; }

export function setDeck(newDeck) { currentDeck = newDeck; }

export function getCurrent() { return currentProfile; }

export function onRender(profile) { 
  if (!profile) { 
    document.getElementById("main-photo").src = ""; 
    document.getElementById("name").textContent = "No matches"; 
    return; 
  } 
  currentProfile = profile; 
  document.getElementById("main-photo").src = profile.photoURL || ""; 
  document.getElementById("name").textContent = profile.displayName || "User"; 
  document.getElementById("handle").textContent = `(${profile.uid.slice(0, 6)})`; 
}

export async function loadDeck() { 
  const user = auth.currentUser; 
  if (!user) return; 
  const q = query(collection(db, "users"), where("hasPhotos", "==", true)); 
  const snap = await getDocs(q); 
  let deck = []; 
  snap.forEach((d) => { 
    const data = d.data(); 
    if (data.uid !== user.uid) deck.push(data); 
  }); 
  deck = applyDeckFilters(deck, user.uid); 
  setDeck(deck); 
  onRender(deck[0] || null); 
}

// Wire buttons 
wirePassLike({ getDeck, setDeck, getCurrent, onRender }); 
wireRecycleAction({ getDeck, setDeck, onRender });

// INITIALIZE DECK ON AUTH 
import { onAuthStateChanged } from "./firebase.js"; 
onAuthStateChanged(auth, async (user) => { 
  if (user) { 
    await loadDeck(); 
  } 
});

// EXPOSE SEND MESSAGE 
export async function sendChatMessage(text) { 
  const fromUid = auth.currentUser?.uid; 
  const toUid = getCurrent()?.uid; 
  if (!fromUid || !toUid) return; 
  const chatId = [fromUid, toUid].sort().join("_"); 
  await sendMessage(chatId, fromUid, text); 
}

// INBOX LOADING 
export async function getInboxMatches() { 
  const uid = auth.currentUser?.uid; 
  if (!uid) return []; 
  const q1 = query(collection(db, "matches"), where("uids", "array-contains", uid)); 
  const snap = await getDocs(q1); 
  const ids = new Set(); 
  snap.forEach((doc) => { 
    const pair = doc.data().uids; 
    const other = pair.find((x) => x !== uid); 
    if (other) ids.add(other); 
  }); 
  const matches = []; 
  for (const id of ids) { 
    const u = await getDoc(doc(db, "users", id)); 
    if (u.exists()) matches.push(u.data()); 
  } 
  return matches; 
}
