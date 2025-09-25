import { db, doc, setDoc, getDoc, addDoc, collection, getDocs } from './firebase.js';

async function recycleProfile(myUid, targetUid, action) {
  const recycleRef = doc(db, "recycling", `${myUid}_${targetUid}`);
  await setDoc(recycleRef, {
    from: myUid, to: targetUid, action, createdAt: Date.now(), recycled: false
  });
}

export async function likeUser(myUid, targetUid) {
  await recycleProfile(myUid, targetUid, "like");
  await setDoc(doc(db, "likes", `${myUid}_${targetUid}`), { from: myUid, to: targetUid, createdAt: Date.now() });

  const reciprocal = await getDoc(doc(db, "likes", `${targetUid}_${myUid}`));
  if (reciprocal.exists()) {
    const matchId = [myUid, targetUid].sort().join("_");
    await setDoc(doc(db, "matches", matchId), { users: [myUid, targetUid], createdAt: Date.now() });
    await setDoc(doc(db, "chats", matchId), { uids: [myUid, targetUid], createdAt: Date.now() });
  }
}

export async function dislikeUser(myUid, targetUid) {
  await recycleProfile(myUid, targetUid, "dislike");
  await setDoc(doc(db, "views", `${myUid}_${targetUid}`), { from: myUid, to: targetUid, createdAt: Date.now() });
}

export async function recycleAll(myUid) {
  const snap = await getDocs(collection(db, "recycling"));
  const mine = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.from === myUid && !data.recycled) mine.push(data);
  });
  for (const item of mine) {
    await setDoc(doc(db, "recycling", `${item.from}_${item.to}`), { ...item, recycled: true }, { merge: true });
  }
  return mine;
}

export async function sendMessage(chatId, fromUid, text) {
  await addDoc(collection(db, "chats", chatId, "messages"), { from: fromUid, text, createdAt: Date.now() });
}

// Export missing functions to fix import errors
export function applyDeckFilters(deck, selfUid) {
  // Simple filter to remove own profile from deck
  return deck.filter(profile => profile.uid !== selfUid);
}

export function getCurrentProfile() {
  // Get current profile from global state or DOM
  if (window.currentProfile) {
    return window.currentProfile;
  }
  // Try to get from mainPhoto element
  const mainPhoto = document.getElementById('candidate-photo');
  if (mainPhoto && mainPhoto.userData) {
    return mainPhoto.userData;
  }
  return null;
}

export function setCurrentProfile(profile) {
  window.currentProfile = profile;
}

// Additional missing exports needed by profile.html
let deck = [];
let matchingState = {};

export function initializeMatching() {
  deck = [];
  matchingState = {};
  console.log('Matching initialized');
}

export function setDeck(newDeck) {
  deck = newDeck;
  console.log('Deck set with', deck.length, 'profiles');
}

export function getDeck() {
  return deck;
}

export function wirePassLikeActions() {
  // Wire up button actions - placeholder for now
  console.log('Wire pass/like actions called');
}

export function getMatchingState() {
  return matchingState;
}
