import { recyclingBin } from "/js/recycling-bin.js";

// Self-only filter + per-user bin filter
export function applyDeckFilters(deck, selfUid) {
  const binSet = new Set(recyclingBin.list().map(p => p.uid)); // only YOUR bin
  const seen = new Set();
  const out = [];
  for (const u of deck || []) {
    if (!u || !u.uid) continue;
    if (u.uid === selfUid) continue;       // keep your own profile out of YOUR deck
    if (binSet.has(u.uid)) continue;       // keep recycled out until restore
    if (seen.has(u.uid)) continue;         // dedupe
    seen.add(u.uid);
    out.push(u);
  }
  return out;
}

// Wire pass/like so items are added to YOUR bin and removed from YOUR deck
export function wirePassLike({ getDeck, setDeck, getCurrent, onRender }) {
  window.passAction = async function () {
    console.log('❌ PASS ACTION CALLED - Starting dislike process');
    const deck = getDeck(); const cur = getCurrent();
    if (cur?.uid) {
      try {
        const { auth } = await import('./firebase.js');
        const { dislikeUser } = await import('./clean-matching.js');
        console.log('🎯 Disliking user:', cur.displayName, 'UID:', cur.uid);
        await dislikeUser(auth.currentUser.uid, cur.uid);
        console.log('✅ DISLIKE SUCCESS - Added to views + recycling');
        
        const next = deck.filter(x => x.uid !== cur.uid);
        setDeck(next);
        onRender?.(next[0] || null);
      } catch (error) {
        console.error('❌ DISLIKE FAILED:', error);
        recyclingBin.add(cur, "passed");
      }
    }
  };
  window.likeAction = async function () {
    console.log('❤️ LIKE ACTION CALLED - Starting like process');
    const deck = getDeck(); const cur = getCurrent();
    if (cur?.uid) {
      try {
        const { auth } = await import('./firebase.js');
        const { likeUser } = await import('./clean-matching.js');
        console.log('🎯 Liking user:', cur.displayName, 'UID:', cur.uid);
        await likeUser(auth.currentUser.uid, cur.uid);
        console.log('✅ LIKE SUCCESS - Added to likes + recycling, checked for match');
        
        const next = deck.filter(x => x.uid !== cur.uid);
        setDeck(next);
        onRender?.(next[0] || null);
      } catch (error) {
        console.error('❌ LIKE FAILED:', error);
        recyclingBin.add(cur, "liked");
      }
    }
  };
}

// Bring a profile back explicitly
export function restoreFromRecycle(profile, { getDeck, setDeck, onRender }) {
  if (!profile?.uid) return;
  recyclingBin.restore(profile.uid);
  const deck = getDeck();
  if (!deck.some(x => x.uid === profile.uid)) {
    const clean = { ...profile }; delete clean.recycledAt; delete clean.action;
    const next = [clean, ...deck];
    setDeck(next);
    onRender?.(next[0] || null);
  }
}

// Add missing recycle action for wire-clean-buttons.js
export function wireRecycleAction({ getDeck, setDeck, onRender }) {
  window.recycleAction = async function () {
    console.log('♻️ RECYCLE ACTION CALLED - Restoring seen profiles');
    try {
      const { auth, getUserDoc } = await import('./firebase.js');
      const { recycleAll } = await import('./clean-matching.js');
      console.log('🎯 Recycling all seen profiles for user:', auth.currentUser.uid);
      const recycled = await recycleAll(auth.currentUser.uid);
      console.log('✅ RECYCLE SUCCESS - Restored', recycled.length, 'profiles to pool');
      
      // Refresh the deck with recycled profiles - fetch full user documents
      if (recycled.length > 0) {
        const currentDeck = getDeck();
        
        // Fetch complete user documents for recycled profiles
        const fullProfiles = [];
        for (const item of recycled) {
          try {
            const userDoc = await getUserDoc(item.to);
            if (userDoc) {
              fullProfiles.push(userDoc);
              console.log('📋 Fetched full profile for:', userDoc.displayName || userDoc.uid);
            } else {
              console.warn('⚠️ No user document found for UID:', item.to);
              // Fallback with minimal data
              fullProfiles.push({ uid: item.to, displayName: 'Unknown User', photoURL: '', hasPhotos: false });
            }
          } catch (error) {
            console.error('❌ Error fetching user document for', item.to, ':', error);
            // Fallback with minimal data
            fullProfiles.push({ uid: item.to, displayName: 'Unknown User', photoURL: '', hasPhotos: false });
          }
        }
        
        // Add recycled profiles with complete data back to the deck
        const updatedDeck = [...currentDeck, ...fullProfiles];
        setDeck(updatedDeck);
        onRender?.(updatedDeck[0] || null);
      }
    } catch (error) {
      console.error('❌ RECYCLE FAILED:', error);
    }
  };
}
