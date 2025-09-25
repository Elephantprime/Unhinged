
// profile-modal.js — click card/photo → full gallery + details

import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Utility function to safely serialize objects with potential circular references
function safeStringify(obj, space = 2) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular Reference]';
      }
      cache.add(value);
      // Remove known Firebase circular reference properties
      if (key === '_firestoreDoc' || key === '_document' || key === '_converter' || key === '_key') {
        return '[Firebase Document Reference - Removed]';
      }
    }
    return value;
  }, space);
}

export function showProfileModal(user) {
  const u = user || {};
  console.log('🖼️ Opening profile modal for user:', u.uid?.substring(0, 8), 'with data:', {
    photoURL: u.photoURL?.substring(0, 50),
    photos: u.photos?.length || 0,
    loungeAvatar: u.loungeAvatar?.substring(0, 50),
    displayName: u.displayName
  });
  
  // CRITICAL FIX: Write to Firebase 'views' collection for notification system
  if (u.uid && window.auth?.currentUser && u.uid !== window.auth.currentUser.uid) {
    const viewerUid = window.auth.currentUser.uid;
    const viewedUid = u.uid;
    
    try {
      const db = window.db || window.firebaseDb;
      if (db) {
        // CRITICAL FIX: Use deterministic view ID to prevent duplicate views from concurrent actions
        const viewDocId = `${viewerUid}_${viewedUid}`;
        const viewDoc = {
          viewerUid: viewerUid,
          viewedUid: viewedUid,
          createdAt: serverTimestamp()
        };
        
        setDoc(doc(db, 'views', viewDocId), viewDoc).then(() => {
          console.log('✅ Profile view recorded in Firebase (deterministic ID):', viewerUid, '→', viewedUid, 'ID:', viewDocId);
        }).catch(error => {
          console.error('❌ Error recording profile view:', error);
        });
      } else {
        console.warn('⚠️ Cannot record profile view: Firebase db not available');
      }
    } catch (error) {
      console.error('❌ Error writing profile view to Firebase:', error);
    }
  }
  
  // 🐛 DEBUG: Log the complete user object to identify contamination source (safe from circular references)
  console.log('🐛 FULL USER OBJECT PASSED TO MODAL (safe):', {
    uid: u.uid?.substring(0, 8),
    displayName: u.displayName,
    photoURL: u.photoURL?.substring(0, 50),
    photos: u.photos?.length || 0,
    loungeAvatar: u.loungeAvatar?.substring(0, 50),
    hasFirestoreDoc: !!u._firestoreDoc,
    // Avoid circular reference by only logging safe properties
    safeKeys: Object.keys(u || {}).filter(key => key !== '_firestoreDoc')
  });
  
  // NO FALLBACK AVATARS - show "No Photo" instead
  
  // Helper function to check if URL is a real photo (not generated SVG)
  const isRealPhotoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:image/svg+xml')) return false;
    return url.startsWith('http') || url.includes('firebasestorage.googleapis.com');
  };

  // PROFILE MATCHING: Show user photos directly (no avatar filtering)
  const photos = [];
  
  // CRITICAL FIX: Get all available user photos for profile modal
  // EXPLICITLY exclude World Hub avatars (loungeAvatar) to prevent contamination
  const allPhotoCandidates = [
    u.photoURL,
    ...(Array.isArray(u.photos) ? u.photos : [])
  ].filter(url => {
    return url && 
           url.trim() && 
           url !== 'undefined' && 
           url !== 'null' &&
           url !== u.loungeAvatar && // CRITICAL: Exclude World Hub avatar
           isRealPhotoUrl(url);
  });
  
  // Additional safety check: Remove any URLs that match loungeAvatar
  const cleanedPhotoCandidates = allPhotoCandidates.filter(url => {
    if (u.loungeAvatar && url === u.loungeAvatar) {
      console.log('🚫 Filtered out World Hub avatar from dating profile:', url.substring(0, 50) + '...');
      return false;
    }
    return true;
  });
  
  photos.push(...cleanedPhotoCandidates);
  
  if (photos.length > 0) {
    console.log('✅ Profile modal showing user photos:', photos.length, 'photos found');
    console.log('📸 Clean profile photos (no World Hub avatars):', photos.map(p => p && p.length > 50 ? p.substring(0, 50) + '...' : p));
  } else {
    console.log('⚠️ No photos available for profile modal - showing text-only modal');
    showTextOnlyProfileModal(u);
    return;
  }

  document.querySelectorAll('.profile-modal-backdrop').forEach(n => n.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'profile-modal-backdrop';
  backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:10000;padding:12px;backdrop-filter:blur(4px)";
  const card = document.createElement('div');
  card.style.cssText = "width:100%;max-width:720px;max-height:92vh;overflow:auto;background:#181a22;color:#fff;border-radius:16px;border:1px solid #2a2a2a;box-shadow:0 12px 40px rgba(0,0,0,.45)";
  backdrop.appendChild(card); document.body.appendChild(backdrop);

  let i = 0;
  // SECURITY: Sanitize user content to prevent XSS
  const sanitize = (str) => {
    if (!str) return '';
    return String(str).replace(/[<>&"']/g, (char) => {
      const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' };
      return entities[char];
    });
  };

  const name = sanitize(u.displayName || 'Member');
  const handle = u.username ? `@${sanitize(u.username)}` : '';
  const age = Number.isFinite(+u.age) ? `, ${u.age}` : '';
  const loc = sanitize(u.location || '');

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #2a2a2a">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div style="font-size:1.3rem;font-weight:800">${name}${age}</div>
        <div style="opacity:.8">${[handle, loc].filter(Boolean).join(' • ')}</div>
      </div>
      <button id="pmClose" class="btn secondary" style="padding:.4rem .8rem">Close</button>
    </div>
    <div style="position:relative">
      <img id="pmPhoto" src="" alt="Profile photo" style="width:100%;max-width:100%;max-height:60vh;height:auto;object-fit:contain;display:block;margin:0 auto;background:#000">
      <button id="pmPrev" class="btn pill small" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.9">‹</button>
      <button id="pmNext" class="btn pill small" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);opacity:.9">›</button>
      <div id="pmDots" style="position:absolute;left:12px;right:12px;bottom:10px;display:flex;gap:6px;justify-content:center"></div>
    </div>
    <div id="pmThumbs" style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px">
      ${photos.map((p,idx)=>`<img data-i="${idx}" data-src="${p}" src="" alt="Photo ${idx + 1}" style="width:74px;height:74px;object-fit:cover;border-radius:8px;border:${idx===0?'2px solid #E11D2A':'2px solid transparent'};background:#0b0b0f;cursor:pointer">`).join('')}
    </div>
    <div style="padding:8px 12px 16px;display:grid;gap:10px">
      ${u.bio?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">About</div><div style="line-height:1.4">${sanitize(u.bio)}</div></div>`:''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${u.hobbies?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Hobbies</div><div>${sanitize(u.hobbies)}</div></div>`:''}
        ${u.interests?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Interests</div><div>${sanitize(u.interests)}</div></div>`:''}
        ${u.gender?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Gender</div><div>${sanitize(u.gender)}</div></div>`:''}
        ${u.mood?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Mood</div><div>${sanitize(u.mood)}</div></div>`:''}
      </div>
    </div>
  `;

  const pmPhoto  = card.querySelector('#pmPhoto');
  const pmPrev   = card.querySelector('#pmPrev');
  const pmNext   = card.querySelector('#pmNext');
  const pmClose  = card.querySelector('#pmClose');
  const pmDots   = card.querySelector('#pmDots');
  const pmThumbs = card.querySelector('#pmThumbs');

  function renderDots(){ pmDots.innerHTML = photos.map((_,k)=>`<div style="width:28px;height:3px;border-radius:2px;background:${k===i?'#fff':'#ffffff44'}"></div>`).join(''); }
  
  function setIndex(k){
    i = (k+photos.length)%photos.length;
    const photoUrl = photos[i] || '';
    console.log('🖼️ Loading photo', i+1, 'of', photos.length, ':', photoUrl.length > 50 ? photoUrl.substring(0, 50) + '...' : photoUrl);
    
    // CRITICAL FIX: Always use PhotoUtils for reliable photo loading with user-specific context
    if (window.PhotoUtils) {
      window.PhotoUtils.loadImageWithFallback(pmPhoto, photos[i], 'profile', 
        (img) => console.log('✅ Profile photo loaded successfully for user:', u.uid?.substring(0, 8)),
        (img) => console.warn('⚠️ Profile photo failed to load for user:', u.uid?.substring(0, 8), 'falling back to placeholder')
      );
    } else {
      console.warn('⚠️ PhotoUtils not available, using direct assignment');
      pmPhoto.src = photos[i];
    }
    
    renderDots();
    pmThumbs.querySelectorAll('img').forEach((t,j)=> t.style.border = j===i ? '2px solid #E11D2A' : '2px solid transparent');
  }
  
  // Initialize thumbnail images using PhotoUtils for proper loading
  function initThumbnails() {
    const thumbnails = pmThumbs.querySelectorAll('img[data-src]');
    thumbnails.forEach((thumb, idx) => {
      const photoUrl = thumb.getAttribute('data-src') || '';
      console.log('🖼️ Loading thumbnail', idx+1, ':', photoUrl.length > 50 ? photoUrl.substring(0, 50) + '...' : photoUrl);
      
      if (window.PhotoUtils) {
        window.PhotoUtils.loadImageWithFallback(thumb, photoUrl, 'thumbnail');
      } else {
        thumb.src = photoUrl;
      }
    });
  }
  pmPrev.onclick  = ()=> setIndex(i-1);
  pmNext.onclick  = ()=> setIndex(i+1);
  pmClose.onclick = ()=> backdrop.remove();
  pmThumbs.addEventListener('click', (e)=>{ const t=e.target.closest('img[data-i]'); if (t) setIndex(+t.dataset.i); });
  backdrop.addEventListener('click', (e)=>{ if (e.target===backdrop) backdrop.remove(); });
  const onKey = (e)=>{ if (e.key==='Escape') backdrop.remove(); if (e.key==='ArrowLeft') setIndex(i-1); if (e.key==='ArrowRight') setIndex(i+1); };
  document.addEventListener('keydown', onKey);
  new MutationObserver(()=>{ if (!document.body.contains(backdrop)) document.removeEventListener('keydown', onKey); })
    .observe(document.body,{childList:true});

  // Initialize thumbnails with proper PhotoUtils loading
  initThumbnails();
  
  // Initialize the modal with the first photo
  renderDots(); 
  setIndex(0);
}

// Text-only profile modal for users with no photos
function showTextOnlyProfileModal(u) {
  document.querySelectorAll('.profile-modal-backdrop').forEach(n => n.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'profile-modal-backdrop';
  backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:10000;padding:12px;backdrop-filter:blur(4px)";
  
  const card = document.createElement('div');
  card.style.cssText = "width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#181a22;color:#fff;border-radius:16px;border:1px solid #2a2a2a;box-shadow:0 12px 40px rgba(0,0,0,.45)";
  backdrop.appendChild(card); 
  document.body.appendChild(backdrop);

  // SECURITY: Sanitize user content to prevent XSS
  const sanitize = (str) => {
    if (!str) return '';
    return String(str).replace(/[<>&"']/g, (char) => {
      const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' };
      return entities[char];
    });
  };

  const name = sanitize(u.displayName || 'Member');
  const handle = u.username ? `@${sanitize(u.username)}` : '';
  const age = Number.isFinite(+u.age) ? `, ${u.age}` : '';
  const loc = sanitize(u.location || '');

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #2a2a2a">
      <div style="display:flex;flex-direction:column;gap:2px">
        <div style="font-size:1.3rem;font-weight:800">${name}${age}</div>
        <div style="opacity:.8">${[handle, loc].filter(Boolean).join(' • ')}</div>
      </div>
      <button id="pmClose" class="btn secondary" style="padding:.4rem .8rem">Close</button>
    </div>
    <div style="padding:20px;text-align:center;">
      <div style="width:120px;height:120px;background:#2a2a2a;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:48px;color:#666;">
        👤
      </div>
      <div style="color:#999;margin-bottom:20px;">No profile photo available</div>
    </div>
    <div style="padding:8px 12px 16px;display:grid;gap:10px">
      ${u.bio?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">About</div><div style="line-height:1.4">${sanitize(u.bio)}</div></div>`:''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${u.hobbies?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Hobbies</div><div>${sanitize(u.hobbies)}</div></div>`:''}
        ${u.interests?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Interests</div><div>${sanitize(u.interests)}</div></div>`:''}
        ${u.gender?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Gender</div><div>${sanitize(u.gender)}</div></div>`:''}
        ${u.mood?`<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px"><div style="font-weight:700;margin-bottom:6px">Mood</div><div>${sanitize(u.mood)}</div></div>`:''}
      </div>
    </div>
  `;

  const pmClose = card.querySelector('#pmClose');
  pmClose.onclick = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  
  const onKey = (e) => { if (e.key === 'Escape') backdrop.remove(); };
  document.addEventListener('keydown', onKey);
  new MutationObserver(() => { 
    if (!document.body.contains(backdrop)) document.removeEventListener('keydown', onKey); 
  }).observe(document.body, {childList: true});
}

/* FIXED: Delegated, capture-phase profile click handler that survives re-renders */
export function wireProfileClicks(getCurrent) {
  const frame = document.getElementById('cardFrame');
  
  const fetchCurrent = async () => {
    // PRIORITY 1: Check if mainPhoto has stored user data (prevents contamination)
    const mainPhoto = document.getElementById('candidate-photo');
    if (mainPhoto && mainPhoto._userData) {
      console.log('✅ Using stored user data from mainPhoto element:', {
        uid: mainPhoto._userData.uid?.substring(0, 8),
        displayName: mainPhoto._userData.displayName,
        photoURL: mainPhoto._userData.photoURL?.substring(0, 50)
      });
      return mainPhoto._userData;
    }
    
    // CRITICAL FIX: Use getCurrent() to get the DISPLAYED profile, not the authenticated user
    const cur = getCurrent?.();
    if (cur) {
      console.log('👤 Opening profile modal for:', cur.displayName, 'UID:', cur.uid?.substring(0, 8));
      console.log('✅ Profile click handler using displayed profile:', {
        uid: cur?.uid?.substring(0, 8),
        displayName: cur?.displayName,
        photoURL: cur?.photoURL?.substring(0, 50)
      });
      return cur;
    }
    
    console.error('❌ CRITICAL ERROR: No profile data available - neither stored nor from getCurrent()');
    console.error('❌ This means the photo click system cannot determine which profile was clicked');
    return null;
  };

  if (frame && !frame.__profileBoundFixed) {
    frame.__profileBoundFixed = true;
    
    // CRITICAL FIX: Only wire clicks if app.js handlers aren't already present
    // Check if app.js already handles profile clicks
    if (window.showPublicProfile && typeof window.showPublicProfile === 'function') {
      console.log('✅ app.js profile click handlers detected - skipping wireProfileClicks to avoid conflicts');
      console.log('📝 Profile clicks will be handled by app.js showPublicProfile() system');
      return;
    }
    
    // FIXED: Delegated click handler with capture phase (survives re-renders)
    frame.addEventListener('click', async (e) => {
      // Ignore clicks on action buttons
      if (e.target.closest('.action-btn') || e.target.closest('button')) return;
      
      // Only handle clicks on profile elements (main photo or profile areas)
      if (e.target.closest('#candidate-photo') || e.target.closest('.profile-photo') || e.target.closest('.info-overlay')) {
        console.log('🖼️ Profile area clicked - opening modal via profile-modal.js');
        
        e.stopImmediatePropagation(); // Prevent swipe handlers from interfering
        e.preventDefault(); // Prevent default mobile behaviors
        
        const cur = await fetchCurrent();
        
        console.log('🐛 DEBUG: About to show modal for user:', {
          uid: cur?.uid,
          displayName: cur?.displayName,
          photoURL: cur?.photoURL
        });
        
        if (cur) {
          showProfileModal(cur);
        } else {
          console.log('⚠️ No user data available for modal');
        }
      }
    }, { capture: true }); // Capture phase intercepts before swipe handlers
    
    // MOBILE FALLBACK: Handle touch events for mobile tap detection
    frame.addEventListener('touchend', async (e) => {
      // Only handle single-finger taps (not swipes)
      if (e.changedTouches.length === 1 && !e.target.closest('.action-btn') && !e.target.closest('button')) {
        if (e.target.closest('#candidate-photo') || e.target.closest('.profile-photo') || e.target.closest('.info-overlay')) {
          console.log('📱 Mobile tap on profile - opening modal via profile-modal.js');
          
          e.stopImmediatePropagation();
          e.preventDefault();
          
          const cur = await fetchCurrent();
          if (cur) showProfileModal(cur);
        }
      }
    }, { passive: false, capture: true });
  }
}

/* Additional fallback: Set direct onclick after each render */
export function ensureProfileClicksFallback(currentCandidate) {
  const mainPhoto = document.getElementById('main-photo');
  if (mainPhoto && currentCandidate) {
    mainPhoto.onclick = (e) => {
      e.stopPropagation();
      console.log('🔄 Fallback onclick triggered for:', currentCandidate.displayName);
      showProfileModal(currentCandidate);
    };
  }
}

// Make function globally available for CandidateManager
window.ensureProfileClicksFallback = ensureProfileClicksFallback;

/* Enhanced function to wire profile clicks for specific user elements */
export function wireUserProfileClick(element, userData) {
  if (!element || !userData || element.__userProfileBound) return;
  
  element.__userProfileBound = true;
  element.style.cursor = 'pointer';
  
  element.addEventListener('click', (e) => {
    if (e.target.closest('.action-btn') || e.target.closest('button')) return;
    e.stopPropagation();
    showProfileModal(userData);
  });
}

/* Enhanced function to wire profile clicks for user lists (chat members, viewers, etc.) */
export function wireUserListProfileClicks(container, getUserData) {
  if (!container || container.__userListBound) return;
  
  container.__userListBound = true;
  
  container.addEventListener('click', async (e) => {
    const userElement = e.target.closest('[data-user-uid]');
    if (!userElement) return;
    
    if (e.target.closest('.action-btn') || e.target.closest('button')) return;
    
    const uid = userElement.dataset.userUid;
    if (uid && getUserData) {
      const userData = await getUserData(uid);
      if (userData) {
        showProfileModal(userData);
      }
    }
  });
}
