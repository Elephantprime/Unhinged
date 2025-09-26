// public/js/profile-gate.js
import { auth, db } from "/js/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ---- Profile completeness check ---- */
function isComplete(d) {
  if (!d) return false;
  
  // Required fields for profile completion
  const hasDisplayName = d.displayName && d.displayName.trim();
  const hasAge = d.age && d.age >= 18;
  const hasLocation = d.location && d.location.trim();
  const hasPhotos = d.hasPhotos || (Array.isArray(d.photos) && d.photos.length > 0) || d.photoURL;
  
  const isComplete = hasDisplayName && hasAge && hasLocation && hasPhotos;
  
  console.log('📋 Profile completion check:', {
    uid: d.uid?.slice(0, 8) || 'no-uid',
    hasDisplayName: !!hasDisplayName,
    hasAge: !!hasAge,
    hasLocation: !!hasLocation, 
    hasPhotos: !!hasPhotos,
    complete: isComplete
  });
  
  return isComplete;
}

/* ---- Get current form data ---- */
function getFormData() {
  const displayName = document.getElementById('displayName')?.value?.trim() || '';
  const age = parseInt(document.getElementById('age')?.value) || 0;
  const gender = document.getElementById('gender')?.value?.trim() || '';
  const bio = document.getElementById('bio')?.value?.trim() || '';
  const location = document.getElementById('location')?.value?.trim() || '';
  const photoFiles = document.getElementById('avatar')?.files || [];
  const existingPhotos = document.querySelectorAll('.saved-photo').length > 0;
  
  // Get hobbies and interests from form
  const hobbiesEl = document.getElementById('hobbies');
  const interestsEl = document.getElementById('interests');
  const hobbies = hobbiesEl?.value ? hobbiesEl.value.split(',').map(h => h.trim()).filter(h => h) : [];
  const interests = interestsEl?.value ? interestsEl.value.split(',').map(i => i.trim()).filter(i => i) : [];
  
  return {
    displayName,
    age,
    gender,
    bio,
    location,
    photoURL: existingPhotos ? 'has-photos' : '',
    photos: photoFiles.length > 0 || existingPhotos ? ['has-photos'] : [],
    hobbies,
    interests
  };
}

/* ---- Get missing fields for user feedback ---- */
function getMissingFields(d) {
  const missing = [];
  if (!d) return ['Display Name', 'Age (18+)', 'Location', 'Profile Photo'];
  
  // Core required fields only - must match isComplete() logic
  if (!d.displayName || !d.displayName.trim()) missing.push('Display Name');
  if (!d.age || d.age < 18) missing.push('Age (18+)');
  if (!d.location || !d.location.trim()) missing.push('Location');
  if (!d.hasPhotos && !d.photoURL && (!Array.isArray(d.photos) || d.photos.length === 0)) missing.push('Profile Photo');
  
  return missing;
}

/* ---- Restore the helpful banner (this one you want to keep) ---- */
function ensureBanner(missingFields = []) {
  // Store missing fields for later use when modal opens
  window._pendingBannerFields = missingFields;
  
  const editModal = document.getElementById('editModal');
  if (!editModal) {
    console.log('📋 Modal not found, fields stored for later:', missingFields);
    return null;
  }
  
  // Check if modal is actually visible using computed styles
  const modalStyles = window.getComputedStyle(editModal);
  const modalContent = editModal.querySelector('.modal');
  const isVisible = modalStyles.display !== 'none' && modalContent && modalContent.offsetHeight > 0;
  
  if (isVisible) {
    return createBannerInModal(missingFields);
  }
  
  // Setup observer to watch for modal opening if not already watching
  if (!window._modalObserver) {
    setupModalObserver();
  }
  
  console.log('📋 Banner fields stored, observer watching for modal:', missingFields);
  return null;
}

/* ---- Create banner inside the modal (only when modal is visible) ---- */
function createBannerInModal(missingFields) {
  let bar = document.getElementById("profileLockBanner");
  if (bar) {
    updateBannerContent(bar, missingFields);
    return bar;
  }
  
  // Create banner inside the edit modal
  const editModal = document.getElementById('editModal');
  const modalContent = editModal?.querySelector('.modal');
  
  if (!modalContent) {
    console.warn('⚠️ Edit modal content not found - cannot place banner inside modal');
    return null;
  }
  
  console.log('✅ Creating banner inside modal content');
  
  bar = document.createElement("div");
  bar.id = "profileLockBanner";
  bar.style.cssText = `
    background: linear-gradient(135deg, #2a1a1c 0%, #201a1c 100%);
    color: #fff;
    border: 2px solid #E11D2A;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    display: flex !important;
    visibility: visible !important;
    flex-direction: column;
    gap: 8px;
    font: 600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    box-shadow: 0 4px 16px rgba(225, 29, 42, 0.3);
    animation: profileBannerPulse 2s ease-in-out infinite;
    position: relative;
    z-index: 10;
    opacity: 1;
  `;
  updateBannerContent(bar, missingFields);
  
  // Insert banner as first child after the modal header
  const modalHeader = modalContent.querySelector('h3');
  if (modalHeader && modalHeader.nextSibling) {
    modalContent.insertBefore(bar, modalHeader.nextSibling);
  } else {
    modalContent.insertBefore(bar, modalContent.firstChild);
  }
  
  console.log('✅ Banner successfully placed inside modal');
  return bar;
}

/* ---- Setup MutationObserver for robust modal detection ---- */
function setupModalObserver() {
  const editModal = document.getElementById('editModal');
  if (!editModal || window._modalObserver) return;
  
  console.log('👁️ Setting up modal observer for robust detection');
  
  window._modalObserver = new MutationObserver((mutations) => {
    const modalStyles = window.getComputedStyle(editModal);
    const modalContent = editModal.querySelector('.modal');
    const isVisible = modalStyles.display !== 'none' && modalContent && modalContent.offsetHeight > 0;
    
    if (isVisible && window._pendingBannerFields) {
      console.log('👁️ Modal opened, creating banner and ensuring file input visibility');
      createBannerInModal(window._pendingBannerFields);
      ensureFileInputVisible();
      window._pendingBannerFields = null; // Clear stored fields
    }
  });
  
  // Observe changes to the modal's attributes and display
  window._modalObserver.observe(editModal, {
    attributes: true,
    attributeFilter: ['style', 'class'],
    childList: true,
    subtree: true
  });
  
  // Also observe style changes on the document
  window._modalObserver.observe(document.head, {
    childList: true,
    subtree: true
  });
}

/* ---- Ensure file input visibility with minimal styling ---- */
function ensureFileInputVisible() {
  const fileInput = document.getElementById('avatar');
  if (!fileInput) {
    console.warn('⚠️ File input not found');
    return;
  }
  
  // Apply minimal but effective visibility fixes
  fileInput.style.display = 'block';
  fileInput.style.visibility = 'visible';
  fileInput.style.opacity = '1';
  fileInput.style.width = '100%';
  fileInput.style.position = 'relative';
  fileInput.style.zIndex = '10';
  
  // Ensure it's clickable and visible
  fileInput.removeAttribute('hidden');
  fileInput.disabled = false;
  
  console.log('✅ File input visibility ensured with minimal styling');
}

function updateBannerContent(banner, missingFields) {
  const missingText = missingFields.length > 0 
    ? `Required: ${missingFields.join(', ')}` 
    : 'Complete required fields';
  
  const detailText = missingFields.length > 0 
    ? `Please fill in the required fields above to unlock navigation to app features.`
    : `Navigation is blocked until required fields are saved.`;
  
  banner.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">⚠️</span>
        <span style="font-weight: 700; color: #ff6b00;">Profile gate active - complete profile required</span>
      </div>
      <span id="profileLockStatus" style="opacity:.9; font-size: 12px; color: #4CAF50;"></span>
    </div>
    <div style="font-size: 13px; color: #cfd0de; font-weight: 400; padding-left: 26px;">
      ${missingText}
    </div>
    <div style="font-size: 12px; color: #888; padding-left: 26px; margin-top: 4px;">
      ${detailText}
    </div>
  `;
}

/* ---- Global state for navigation blocking ---- */
let profileLockState = {
  installed: false,
  clickHandler: null,
  originalPushState: null,
  originalReplaceState: null,
  beforeUnloadHandler: null
};

/* ---- Enhanced navigation blocking with bulletproof protection ---- */
function installBlockers() {
  console.log('🔒 Profile gate ENABLED - installing navigation blockers');
  
  if (profileLockState.installed) return;
  profileLockState.installed = true;

  console.log('🔒 Installing bulletproof navigation blockers');

  // Store original history methods and current URL for restoration
  profileLockState.originalPushState = history.pushState.bind(history);
  profileLockState.originalReplaceState = history.replaceState.bind(history);
  profileLockState.lockedUrl = window.location.href;

  // Enhanced click handler with more comprehensive blocking
  profileLockState.clickHandler = (e) => {
    const a = e.target.closest("a[href]");
    const navBtn = e.target.closest("button,[data-nav],[data-route]");
    const form = e.target.closest("form");
    const saveBtn = e.target.closest("#saveEdit, [data-save], .save-btn");
    const cancelBtn = e.target.closest("#cancelEdit, [data-cancel], .cancel-btn");
    
    // Allow save operations, cancel operations, and form submissions
    if (saveBtn || cancelBtn || (form && !a)) {
      return true; // Allow these actions
    }
    
    // Block all other navigation attempts
    if (a || navBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const s = document.getElementById("profileLockStatus");
      if (s) s.textContent = "🚫 Navigation blocked - complete your profile first!";
      
      // Show visual feedback
      if (a) a.style.cssText += 'pointer-events: none; opacity: 0.5;';
      if (navBtn) navBtn.style.cssText += 'pointer-events: none; opacity: 0.5;';
      
      return false;
    }
  };

  // Install comprehensive navigation blockers
  document.addEventListener("click", profileLockState.clickHandler, true);
  document.addEventListener("mousedown", profileLockState.clickHandler, true);
  document.addEventListener("touchstart", profileLockState.clickHandler, true);

  // Block ALL history navigation attempts
  history.pushState = function (...args) {
    console.log('🚫 Blocked pushState navigation attempt');
    const s = document.getElementById("profileLockStatus");
    if (s) s.textContent = "🚫 Navigation blocked - complete your profile first!";
    return; // Completely prevent navigation
  };

  history.replaceState = function (...args) {
    console.log('🚫 Blocked replaceState navigation attempt');
    const s = document.getElementById("profileLockStatus");
    if (s) s.textContent = "🚫 Navigation blocked - complete your profile first!";
    return; // Completely prevent navigation
  };

  // Enhanced beforeunload handler
  profileLockState.beforeUnloadHandler = (e) => {
    // More precise detection of navigation vs refresh
    const navigation = e.currentTarget.performance?.navigation;
    if (navigation?.type === 1) return; // Allow refresh
    
    console.log('🚫 Blocked beforeunload navigation attempt');
    e.preventDefault();
    e.returnValue = '⚠️ Your profile is incomplete. Please complete all required fields before leaving.';
    return e.returnValue;
  };

  window.addEventListener('beforeunload', profileLockState.beforeUnloadHandler);

  // Enhanced popstate blocking
  profileLockState.popstateHandler = (e) => {
    console.log('🚫 Blocked popstate navigation attempt');
    e.preventDefault();
    e.stopPropagation();
    
    const s = document.getElementById("profileLockStatus");
    if (s) s.textContent = "🚫 Back/forward blocked - complete your profile first!";
    
    // Force return to locked URL
    setTimeout(() => {
      if (profileLockState.lockedUrl && window.location.href !== profileLockState.lockedUrl) {
        history.replaceState(null, '', profileLockState.lockedUrl);
      }
    }, 0);
  };
  
  window.addEventListener('popstate', profileLockState.popstateHandler);

  // Add hashchange blocking
  profileLockState.hashchangeHandler = (e) => {
    console.log('🚫 Blocked hashchange navigation attempt');
    e.preventDefault();
    const s = document.getElementById("profileLockStatus");
    if (s) s.textContent = "🚫 Hash navigation blocked - complete your profile first!";
  };
  
  window.addEventListener('hashchange', profileLockState.hashchangeHandler);

  // Enhanced URL monitoring with faster detection
  const checkUrlChange = setInterval(() => {
    if (profileLockState.installed && profileLockState.lockedUrl) {
      const currentUrl = window.location.href;
      const lockedUrl = profileLockState.lockedUrl;
      
      if (currentUrl !== lockedUrl) {
        console.log('🚫 URL change detected - forcing return to profile page');
        const s = document.getElementById("profileLockStatus");
        if (s) s.textContent = "🚫 URL change blocked - complete your profile first!";
        
        // Force immediate return to profile page
        window.location.href = '/profile.html';
      }
    }
  }, 50); // Check every 50ms for faster detection
  
  profileLockState.urlCheckInterval = checkUrlChange;

  // Add keyboard shortcut blocking
  profileLockState.keydownHandler = (e) => {
    // Block common navigation shortcuts
    const blockedKeys = [
      { key: 'F5' }, // Refresh (some cases)
      { key: 'r', ctrl: true }, // Ctrl+R refresh
      { key: 'l', ctrl: true }, // Ctrl+L (address bar)
      { key: 't', ctrl: true }, // Ctrl+T (new tab)
      { key: 'w', ctrl: true }, // Ctrl+W (close tab)
      { key: 'n', ctrl: true }, // Ctrl+N (new window)
      { key: 'Tab', alt: true }, // Alt+Tab
    ];
    
    const isBlocked = blockedKeys.some(combo => {
      return e.key === combo.key && 
             (!combo.ctrl || e.ctrlKey) && 
             (!combo.alt || e.altKey) && 
             (!combo.shift || e.shiftKey);
    });
    
    if (isBlocked) {
      console.log('🚫 Blocked keyboard navigation shortcut:', e.key);
      e.preventDefault();
      e.stopPropagation();
      const s = document.getElementById("profileLockStatus");
      if (s) s.textContent = "🚫 Keyboard shortcut blocked - complete your profile first!";
    }
  };
  
  document.addEventListener('keydown', profileLockState.keydownHandler, true);

  console.log('✅ Bulletproof navigation blockers installed successfully');
}

/* ---- Remove blockers (when complete) ---- */
function removeBlockers() {
  if (!profileLockState.installed) return;

  // Remove the warning banner (now inside modal)
  const bar = document.getElementById("profileLockBanner");
  if (bar) bar.remove();
  
  // Show success message
  const hint = document.createElement("div");
  hint.style.cssText = "position:sticky;top:0;background:#122116;color:#9fe6b6;border-bottom:1px solid #2b6141;padding:8px 12px;z-index:9998;font:600 14px system-ui";
  hint.textContent = "✅ Profile complete! You may now navigate freely.";
  document.body.prepend(hint);
  
  // Auto-remove success message after 3 seconds
  setTimeout(() => {
    if (hint && hint.parentNode) hint.remove();
  }, 3000);

  // Remove event listeners properly
  if (profileLockState.clickHandler) {
    document.removeEventListener("click", profileLockState.clickHandler, true);
    profileLockState.clickHandler = null;
  }

  if (profileLockState.beforeUnloadHandler) {
    window.removeEventListener('beforeunload', profileLockState.beforeUnloadHandler);
    profileLockState.beforeUnloadHandler = null;
  }

  if (profileLockState.popstateHandler) {
    window.removeEventListener('popstate', profileLockState.popstateHandler);
    profileLockState.popstateHandler = null;
  }

  if (profileLockState.hashchangeHandler) {
    window.removeEventListener('hashchange', profileLockState.hashchangeHandler);
    profileLockState.hashchangeHandler = null;
  }

  if (profileLockState.keydownHandler) {
    document.removeEventListener('keydown', profileLockState.keydownHandler, true);
    profileLockState.keydownHandler = null;
  }

  if (profileLockState.urlCheckInterval) {
    clearInterval(profileLockState.urlCheckInterval);
    profileLockState.urlCheckInterval = null;
  }

  // Restore original history methods
  if (profileLockState.originalPushState) {
    history.pushState = profileLockState.originalPushState;
    profileLockState.originalPushState = null;
  }

  if (profileLockState.originalReplaceState) {
    history.replaceState = profileLockState.originalReplaceState;
    profileLockState.originalReplaceState = null;
  }

  // Mark as uninstalled
  profileLockState.installed = false;
  
  console.log('✅ Profile completion blockers removed - navigation restored');
}

/* ---- Re-check after Save button ---- */
function bindSaveRecheck() {
  const saveBtn = document.getElementById("saveEdit");
  if (!saveBtn || saveBtn.__boundProfileCheck) return;
  saveBtn.__boundProfileCheck = true;
  saveBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    // Show loading state
    const status = document.getElementById("profileLockStatus");
    if (status) status.textContent = "Checking profile completion...";
    
    // Check form data instead of database data during save
    const formData = getFormData();
    const missingFields = getMissingFields(formData);
    
    if (isComplete(formData)) {
      console.log('✅ Profile form is now complete!');
      // Wait for Firestore write to land, then remove blockers
      setTimeout(() => removeBlockers(), 2000);
    } else {
      console.log('⚠️ Profile form still incomplete. Missing:', missingFields);
      // Update banner with current missing fields
      const banner = document.getElementById("profileLockBanner");
      if (banner) {
        updateBannerContent(banner, missingFields);
      }
      if (status) status.textContent = `Still missing: ${missingFields.join(', ')}`;
    }
  });
}

/* ---- Monitor profile completion continuously ---- */
function monitorProfileCompletion(user) {
  if (!user) return;
  
  const checkCompletion = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.data();
      const missingFields = getMissingFields(data);
      
      // Update banner with current status
      const banner = document.getElementById("profileLockBanner");
      if (banner) {
        updateBannerContent(banner, missingFields);
      }
      
      if (isComplete(data)) {
        console.log('✅ Profile complete - removing blockers');
        removeBlockers();
      }
    } catch (e) {
      console.error('❌ Error checking profile completion:', e);
    }
  };
  
  // Check immediately
  checkCompletion();
  
  // Check every 5 seconds while profile is incomplete
  const interval = setInterval(() => {
    if (!profileLockState.installed) {
      clearInterval(interval);
      return;
    }
    checkCompletion();
  }, 5000);
}

/* ---- Protected pages list ---- */
const getProtectedPages = () => [
  '/app.html',
  '/badges.html',
  '/reviews.html', 
  '/chaos.html',
  '/redflags.html',
  '/chat.html',
  '/casualties.html',
  '/dating-games.html',
  '/leaderboard.html',
  '/live-events.html',
  '/world/feed.html', 
  '/world/districts.html',
  '/world/world.html',
  '/world/passports.html',
  '/world/lounge.html',
  '/world/spotlight.html',
  '/world/stages.html',
  '/world/arcade.html',
  '/world/audio-room.html',
  '/world/video-pod.html',
  '/world/hot-seat.html',
  '/games/conversation-starters.html',
  '/games/dealbreaker-dice.html',
  '/games/red-flag-roulette.html',
  '/games/speed-dating.html',
  '/games/this-or-that.html',
  '/games/would-you-still.html'
];

/* ---- Check if current page requires complete profile ---- */
function requiresCompleteProfile() {
  const currentPage = window.location.pathname;
  return getProtectedPages().some(page => currentPage.includes(page));
}

/* ---- Check if page is allowed (profile, login, signup, home) ---- */
function isAllowedPage() {
  const currentPage = window.location.pathname;
  return currentPage.includes('/profile.html') || 
         currentPage.includes('/login.html') || 
         currentPage.includes('/signup.html') ||
         currentPage === '/' || 
         currentPage === '/index.html';
}

/* ---- Core profile check function ---- */
async function checkProfileCompletion(user, context = 'unknown') {
  // Early exit if navigation already in progress
  if (window.__navigating) {
    console.log(`🔒 [${context}] Navigation in progress - skipping check`);
    return false;
  }
  if (!user) {
    console.log(`🔒 [${context}] No authenticated user - allowing navigation`);
    return true; // Let login logic handle this
  }

  // Skip check for allowed pages
  if (isAllowedPage()) {
    console.log(`🔒 [${context}] Page allowed - skipping profile check`);
    return true;
  }

  // Only check for protected pages
  if (!requiresCompleteProfile()) {
    console.log(`🔒 [${context}] Page not protected - allowing navigation`);
    return true;
  }

  try {
    console.log(`🔒 [${context}] Checking profile completion for:`, window.location.pathname);
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data();
    
    if (isComplete(data)) {
      console.log(`✅ [${context}] Profile complete - access granted`);
      return true;
    }
    
    // Profile incomplete: block access
    console.log(`⚠️ [${context}] Profile incomplete - blocking access`);
    const missingFields = getMissingFields(data);
    console.log(`⚠️ [${context}] Missing fields:`, missingFields);
    
    // Show blocking banner
    ensureBanner(missingFields);
    
    // Redirect to profile page
    window.location.href = '/profile.html';
    return false;
    
  } catch (e) {
    console.error(`❌ [${context}] Error checking profile completion:`, e);
    // On error, redirect to profile page for safety
    window.location.href = '/profile.html';
    return false;
  }
}

/* ---- Immediate page load check (CRITICAL: fixes race condition) ---- */
async function immediatePageLoadCheck() {
  // Only run on protected pages
  if (!requiresCompleteProfile()) {
    return;
  }
  
  console.log('🚀 IMMEDIATE PAGE LOAD CHECK - preventing race condition bypass');
  
  // Get current user immediately
  const user = auth.currentUser;
  if (!user) {
    console.log('🔒 No user on page load - waiting for auth');
    return;
  }
  
  // Check profile immediately
  await checkProfileCompletion(user, 'PAGE_LOAD');
}

/* ---- Unified Auth state change handler ---- */
onAuthStateChanged(auth, async (user) => {
  // Prevent multiple simultaneous auth state changes
  if (window.__authChangePending) {
    console.log('🔒 Auth change already in progress - skipping');
    return;
  }
  window.__authChangePending = true;
  
  // Set login cookie for authenticated users
  if (user) {
    document.cookie = 'login_ok=1; path=/; max-age=86400; SameSite=Lax'; // 24 hours
    sessionStorage.setItem(`profile_visited_${user.uid}`, 'true');
    console.log('🍪 Login cookie set for authenticated user:', user.uid.slice(0, 8));
  }
  
  // Handle profile page specifically
  if (window.location.pathname.includes('/profile.html')) {
    console.log('🔒 Profile page detected - setting up profile completion');
    
    if (!user) {
      console.log('⚠️ No authenticated user - redirecting to login');
      window.location.href = '/login.html';
      window.__authChangePending = false;
      return;
    }
    
    // Profile page specific logic
    await handleProfilePageLogic(user);
  } else {
    // General page logic
    await checkProfileCompletion(user, 'AUTH_CHANGE');
  }
  
  window.__authChangePending = false;
});

/* ---- Profile page specific logic ---- */
async function handleProfilePageLogic(user) {
  try {
    console.log('🔍 Checking Firebase profile for user:', user.uid);
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.data();
    
    console.log('📊 Firebase query results:', {
      docExists: snap.exists(),
      dataExists: !!data,
      dataKeys: data ? Object.keys(data) : [],
      userUID: user.uid
    });
    
    // Check if user has an existing profile
    if (!data || !snap.exists()) {
      console.log('🆕 New user - complete profile creation required (no Firebase document found)');
      // NEW USER: No profile exists, guide them through creation
      const missingFields = getMissingFields(null);
      ensureBanner(missingFields);
      installBlockers();
      bindSaveRecheck();
      monitorProfileCompletion(user);
      
      // AUTO-OPEN EDIT MODAL for NEW users
      console.log('🔧 Auto-opening edit modal for new user profile creation');
      setTimeout(() => {
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
          console.log('✅ Found Edit Profile button - clicking automatically for new user');
          editBtn.click();
          
          setTimeout(() => {
            if (window._pendingBannerFields) {
              console.log('🔔 Modal opened for new user - creating banner inside modal');
              createBannerInModal(window._pendingBannerFields);
              ensureFileInputVisible();
            }
          }, 300);
        }
      }, 1000);
      return;
    }
    
    // EXISTING USER: Check if their profile is complete
    if (isComplete(data)) {
      console.log('✅ Existing user with complete profile - allowing normal navigation');
      // Show brief success message
      const hint = document.createElement("div");
      hint.style.cssText = "position:sticky;top:0;background:#122116;color:#9fe6b6;border-bottom:1px solid #2b6141;padding:8px 12px;z-index:9998;font:600 14px system-ui";
      hint.textContent = "✅ Welcome back! Your profile is complete.";
      document.body.prepend(hint);
      setTimeout(() => {
        if (hint && hint.parentNode) hint.remove();
      }, 3000);
      return;
    }
    
    // EXISTING USER with incomplete profile - guide them to complete it
    console.log('⚠️ Existing user with incomplete profile - guiding to complete all required fields');
    const missingFields = getMissingFields(data);
    ensureBanner(missingFields);
    installBlockers();
    bindSaveRecheck();
    monitorProfileCompletion(user);
    
    console.log('🔧 Auto-opening edit modal for existing user to complete profile');
    setTimeout(() => {
      const editBtn = document.getElementById('editBtn');
      if (editBtn) {
        editBtn.click();
        setTimeout(() => {
          if (window._pendingBannerFields) {
            createBannerInModal(window._pendingBannerFields);
            ensureFileInputVisible();
          }
        }, 300);
      }
    }, 1000);
    
  } catch (e) {
    console.error('❌ Error checking profile completion on profile page:', e);
    // On error, just show banner - no forced completion
    ensureBanner(['Unable to verify profile data']);
    console.log('✅ User can navigate freely despite error - profile completion optional');
  }
}

/* ---- Run immediate check to prevent race conditions ---- */
// This is CRITICAL - it catches users who are already authenticated
// when they directly navigate to protected pages
immediatePageLoadCheck();

// Export removeBlockers function globally for cancel button access
window.removeBlockers = removeBlockers;

/* ---- Export necessary functions ---- */
export { isComplete as isProfileComplete, checkProfileCompletion };
