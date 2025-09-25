// Import Firebase authentication and real-time functionality
import { 
  auth, 
  db, 
  getUserDoc, 
  userRef, 
  storage, 
  uploadUserPhoto,
  onAuthStateChanged,
  setDoc, 
  getDoc, 
  serverTimestamp, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  where, 
  deleteDoc, 
  getDocs,
  waitForAuth,
} from '../js/firebase.js';

// Import District Chat Engine for confession functionality
import { 
  DistrictChatEngine,
  ConfessionEngine
} from '../js/districts-chat-engine.js';

// Import Safe DOM utilities to prevent null reference errors
import {
  safeGetById,
  safeQuerySelector,
  safeAppendChild,
  safeSetInnerHTML,
  safeSetTextContent,
  safeAddEventListener,
  safeDOMReady,
  waitForElement
} from '../js/safe-dom-utils.js';

// Import points display utility
import { addPointsToNavigation } from '../js/points-display.js';

// ==============================================
// GLOBAL STATE MANAGEMENT
// =====================================================

let currentUser = {
  name: "Loading...",
  avatar: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>'),
  currentTable: null,
  uid: null
};

let authUser = null;
let onlineUsers = {};
let tableOccupancy = {};
let presenceListeners = [];
let chatListeners = [];
let currentChatMode = 'global'; // 'global', 'table', or 'whisper'
let whisperTarget = null;
let loungeInitialized = false;
let userMessageCount = 0;
let userTableHistory = new Set();
let userWhisperHistory = new Set();

// District engines for confession functionality
let confessionEngine = null;

// Table mapping for themed tables
const tableNames = {
  // Dating Energy
  'love-seat': '💖 The Love Seat',
  'thirst-trap': '🔥 Thirst Trap',
  'situationship': '😵‍💫 Situationship',
  'swipe-right': '👉 Swipe Right',
  'first-date': '🌹 First Date Table',
  'complicated': '🤷‍♀️ It\'s Complicated',
  
  // Lounge / Nightlife Vibes
  'barstool': '🍺 The Barstool',
  'vip-booth': '👑 VIP Booth',
  'dance-floor': '💃 The Dance Floor',
  'champagne-corner': '🥂 Champagne Corner',
  'late-night': '🌙 Late Night Confessions',
  'candlelight': '🕯️ Candlelight Table',
  
  // Unhinged / Chaotic Fun
  'red-flag': '🚩 The Red Flag Table',
  'ghosting-central': '👻 Ghosting Central',
  'toxic-exes': '☠️ Toxic Exes Anonymous',
  'gaslight-grill': '💡 Gaslight Grill',
  'delulu-den': '🤡 Delulu Den',
  'drama-table': '🎭 The Drama Table',
  
  // Icebreaker / Conversation Prompts
  'truth-dare': '🎯 Truth or Dare Table',
  'hot-take': '🔥 Hot Take HQ',
  'unpopular-opinions': '🗣️ Unpopular Opinions',
  'dealbreaker-diner': '💔 Dealbreaker Diner',
  'would-rather': '🤔 Would You Rather Booth',
  'storytime': '📚 Storytime Spot'
};

// =====================================================
// CRITICAL FIX 1: DETERMINISTIC AUTHENTICATION FLOW
// =====================================================

async function initializeWithDeterministicAuth() {
  console.log('🔐 Starting deterministic authentication flow...');
  
  try {
    // Step 1: Wait for Firebase auth to be ready using centralized waitForAuth
    console.log('⏳ Waiting for auth...');
    authUser = await waitForAuth();
    
    if (authUser) {
      console.log('✅ Auth user received:', authUser.uid);
      
      // Step 2: Get user document from Firestore (read-only)
      const userDoc = await getUserDoc(authUser.uid);
      console.log('✅ User document loaded:', !!userDoc);
      
      // Step 3: Load saved avatar using AvatarUtils for consistency - FIXED UID PASSING
      console.log('🎭 Loading avatar for FULL UID:', authUser.uid);
      const savedAvatar = await window.AvatarUtils.loadAvatar(authUser.uid);
      console.log('🎭 Loaded avatar result:', savedAvatar?.substring(0, 50) + '...');
      
      // CRITICAL FIX: If avatar loading failed, try using photoURL/loungeAvatar from userDoc directly
      let finalAvatar = savedAvatar;
      if (!savedAvatar || savedAvatar.startsWith('data:image/svg+xml')) {
        console.log('🔧 Avatar fallback triggered, trying userDoc photos...');
        if (userDoc?.photoURL && window.PhotoUtils?.isRealPhotoUrl(userDoc.photoURL)) {
          finalAvatar = userDoc.photoURL;
          console.log('✅ Using photoURL as avatar:', finalAvatar.substring(0, 50) + '...');
        } else if (userDoc?.loungeAvatar && window.PhotoUtils?.isRealPhotoUrl(userDoc.loungeAvatar)) {
          finalAvatar = userDoc.loungeAvatar;
          console.log('✅ Using loungeAvatar as avatar:', finalAvatar.substring(0, 50) + '...');
        } else {
          console.log('⚠️ No real photos found, keeping fallback avatar');
        }
      }
      
      // Step 4: Create currentUser object with all required data
      currentUser = {
        name: userDoc?.displayName || authUser.displayName || authUser.email?.split('@')[0] || `User${authUser.uid.substring(0, 8)}`,
        avatar: finalAvatar,
        currentTable: null,
        uid: authUser.uid
      };
      
      console.log('✅ currentUser created with avatar:', currentUser.avatar?.substring(0, 50) + '...');
      
      console.log('✅ currentUser created:', { name: currentUser.name, uid: currentUser.uid });
      
    } else {
      console.log('❌ No authenticated user - using guest mode');
      
      // Guest mode with unique ID
      const guestId = 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      currentUser = {
        name: `Guest${Math.floor(Math.random() * 1000)}`,
        avatar: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>'),
        currentTable: null,
        uid: guestId
      };
    }
    
    // Step 5: Initialize lounge with fully prepared user
    await initializeLounge();
    
  } catch (error) {
    console.error('❌ Critical error in authentication flow:', error);
    // Emergency fallback
    currentUser = {
      name: 'Error User',
      avatar: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>'),
      currentTable: null,
      uid: 'error_' + Date.now()
    };
    await initializeLounge();
  }
}

// =====================================================
// CRITICAL FIX 3: COMPLETE AVATAR PERSISTENCE
// =====================================================

async function saveAvatarSelection(avatarUrl) {
  console.log('💾 Saving avatar selection:', avatarUrl.substring(0, 50) + '...');
  
  try {
    // Use AvatarUtils for consistent saving across the app
    if (window.AvatarUtils && authUser?.uid) {
      await window.AvatarUtils.saveAvatar(avatarUrl, authUser.uid);
      console.log('✅ Avatar saved via AvatarUtils');
    } else {
      console.warn('⚠️ AvatarUtils not available or no user authenticated');
    }
    
    // Update current user
    currentUser.avatar = avatarUrl;
    updateUserDisplay();
    
    // Update presence with new avatar
    if (currentUser.uid) {
      await updateUserPresence(currentUser.currentTable);
    }
    
  } catch (error) {
    console.error('❌ Error saving avatar:', error);
  }
}

// =====================================================
// FIX 4: REAL-TIME TABLE DISPLAY WITH COUNTERS
// =====================================================

function updateTableDisplay() {
  console.log('🪑 Updating table displays with real-time counters');
  
  // Update all table elements with real-time occupancy
  document.querySelectorAll('.table').forEach(tableElement => {
    const tableId = tableElement.dataset.table;
    if (!tableId) return;
    
    const occupants = tableOccupancy[tableId] || [];
    const occupantCount = occupants.length;
    
    // Remove existing counter if any
    const existingCounter = tableElement.querySelector('.table-eye-counter');
    if (existingCounter) {
      existingCounter.remove();
    }
    
    // Remove existing occupancy text
    const existingOccupancy = tableElement.querySelector('.table-occupancy');
    if (existingOccupancy) {
      existingOccupancy.remove();
    }
    
    // Create real-time counter
    const counterElement = document.createElement('div');
    counterElement.className = 'table-eye-counter';
    counterElement.innerHTML = `
      <span class="table-eye-icon">👀</span>
      <span class="table-counter">${occupantCount}</span>
    `;
    
    // Add click event to show who's at the table
    counterElement.onclick = (e) => {
      e.stopPropagation();
      showTableOccupants(tableId, occupants);
    };
    
    safeAppendChild(tableElement, counterElement, `table counter for ${tableId}`);
    
    // Add occupancy text
    const occupancyElement = document.createElement('div');
    occupancyElement.className = 'table-occupancy';
    
    if (occupantCount === 0) {
      occupancyElement.textContent = 'Empty table';
    } else if (occupantCount === 1) {
      occupancyElement.textContent = `${occupants[0].name} is here`;
    } else {
      occupancyElement.textContent = `${occupantCount} people chatting`;
    }
    
    safeAppendChild(tableElement, occupancyElement, `table occupancy for ${tableId}`);
    
    // Visual feedback for occupied tables
    if (occupantCount > 0) {
      tableElement.classList.add('occupied');
    } else {
      tableElement.classList.remove('occupied');
    }
    
    console.log(`✅ Table ${tableId} updated: ${occupantCount} occupants`);
  });
}

function updateRealTimeCounters() {
  // Update total online count
  const totalOnlineElement = document.getElementById('total-online');
  if (totalOnlineElement) {
    totalOnlineElement.textContent = Object.keys(onlineUsers).length;
  }
  
  // Update active tables count
  const activeTablesElement = document.getElementById('active-tables');
  if (activeTablesElement) {
    const activeTables = Object.keys(tableOccupancy).filter(table => tableOccupancy[table].length > 0);
    activeTablesElement.textContent = activeTables.length;
  }
  
  console.log('📊 Real-time counters updated');
}

function showTableOccupants(tableId, occupants) {
  const tableName = tableNames[tableId] || tableId;
  
  if (occupants.length === 0) {
    showToast(`${tableName} is empty`, 'info');
    return;
  }
  
  const occupantsList = occupants.map(user => `👤 ${user.name}`).join('\n');
  const message = `${tableName}\n\n${occupantsList}`;
  
  // Use the existing user list modal if available
  const modal = document.getElementById('user-list-modal');
  const titleElement = document.getElementById('user-list-title');
  const containerElement = document.getElementById('user-list-container');
  
  if (modal && titleElement && containerElement) {
    titleElement.textContent = `${tableName} (${occupants.length})`;
    
    containerElement.innerHTML = occupants.map(user => `
      <div class="user-item" onclick="startWhisper('${user.uid}', '${user.name}')">
        <img src="${user.avatar}" alt="${user.name}" class="popup-avatar" onerror="this.src='data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 80 80\\"><rect width=\\"100%\\" height=\\"100%\\" fill=\\"#1a1b22\\"/><circle cx=\\"40\\" cy=\\"30\\" r=\\"16\\" fill=\\"#2a2a2a\\"/><path d=\\"M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z\\" fill=\\"#2a2a2a\\"/></svg>')")
        <span class="user-name">${user.name}</span>
        <span class="whisper-hint">💬 Click to whisper</span>
      </div>
    `).join('');
    
    modal.style.display = 'flex';
    
    // CRITICAL FIX: Setup close button and outside-click handlers
    setupModalCloseHandlers(modal);
  } else {
    showToast(message, 'info');
  }
}

function updateOnlineUsersList() {
  const onlineUsersList = document.getElementById('online-users-list');
  if (!onlineUsersList) return;
  
  const usersArray = Object.values(onlineUsers);
  
  if (usersArray.length === 0) {
    onlineUsersList.innerHTML = '<div class="no-users">No one else is online</div>';
    return;
  }
  
  onlineUsersList.innerHTML = usersArray.map(user => {
    const tableInfo = user.currentTable ? ` at ${tableNames[user.currentTable] || user.currentTable}` : '';
    return `
      <div class="online-user" onclick="startWhisper('${user.uid}', '${user.name}')">
        <img src="${user.avatar}" alt="${user.name}" class="popup-avatar" onerror="this.src='data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 80 80\\"><rect width=\\"100%\\" height=\\"100%\\" fill=\\"#1a1b22\\"/><circle cx=\\"40\\" cy=\\"30\\" r=\\"16\\" fill=\\"#2a2a2a\\"/><path d=\\"M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z\\" fill=\\"#2a2a2a\\"/></svg>')")
        <div class="user-info">
          <div class="user-name">${user.name}</div>
          <div class="user-status">${tableInfo || 'In lounge'}</div>
        </div>
        <div class="whisper-btn">💬</div>
      </div>
    `;
  }).join('');
  
  console.log('👥 Online users list updated with', usersArray.length, 'users');
}

// updateStatsDisplay function moved to line 1083 to avoid duplication

function updateUserDisplay() {
  const currentAvatarDisplay = document.getElementById('current-avatar-display');
  const currentUserName = document.getElementById('current-user-name');
  
  if (currentAvatarDisplay && currentUser.avatar) {
    currentAvatarDisplay.src = currentUser.avatar;
    currentAvatarDisplay.onerror = function() {
      console.warn('⚠️ Avatar failed to load, hiding image (no fallback)');
      this.style.display = 'none';
    };
  }
  
  if (currentUserName && currentUser.name) {
    currentUserName.textContent = currentUser.name;
  }
}

// =====================================================
// PRESENCE SYSTEM WITH EXPLICIT BINDINGS
// =====================================================

async function updateUserPresence(table = null, online = true) {
  if (!currentUser.uid) {
    console.warn('⚠️ No UID available for presence update');
    return;
  }
  
  const presenceRef = doc(db, 'lounge_presence', currentUser.uid);
  const presenceData = {
    uid: currentUser.uid,
    name: currentUser.name,
    avatar: currentUser.avatar,
    currentTable: table,
    lastSeen: serverTimestamp(),
    online: online
  };
  
  console.log('🔄 Updating presence with avatar:', currentUser.avatar?.substring(0, 50) + '...', 'Online:', online);
  
  try {
    if (online) {
      await setDoc(presenceRef, presenceData);
      console.log('✅ Presence updated:', { uid: currentUser.uid, table, online });
    } else {
      // When going offline, update the record to show offline status
      await setDoc(presenceRef, { ...presenceData, online: false });
      console.log('✅ Presence set to offline:', { uid: currentUser.uid, table });
    }
    
    // Track location visit for passport (only when online)
    if (online && typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('lounge', table ? `Joined ${tableNames[table] || table}` : 'Browsing lounge');
      
      if (table) {
        userTableHistory.add(table);
        if (userTableHistory.size >= 5) {
          window.PassportAPI.awardStamp('table_hopper', 'lounge', 'Joined 5 different tables');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error updating presence:', error);
  }
}

async function removeUserPresence() {
  if (!currentUser.uid) return;
  
  try {
    await deleteDoc(doc(db, 'lounge_presence', currentUser.uid));
    console.log('✅ Presence removed for user:', currentUser.uid);
  } catch (error) {
    console.error('❌ Error removing presence:', error);
  }
}

// CRITICAL FIX: Automatic presence cleanup when users leave
function setupPresenceCleanup() {
  console.log('🧹 Setting up automatic presence cleanup...');
  
  // Remove presence when user leaves the page
  const cleanup = async () => {
    console.log('🔄 User leaving - cleaning up presence...');
    await removeUserPresence();
  };
  
  // Handle various ways users can leave
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);
  window.addEventListener('pagehide', cleanup);
  
  // Handle tab visibility changes (user switching tabs or minimizing)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      console.log('👁️ Page hidden - user may be leaving');
      // Set offline status but don't remove completely (they might come back)
      if (currentUser.uid) {
        updateUserPresence(currentUser.currentTable, false); // false = offline
      }
    } else if (document.visibilityState === 'visible') {
      console.log('👁️ Page visible - user returned');
      // Re-establish presence
      if (currentUser.uid) {
        updateUserPresence(currentUser.currentTable, true); // true = online
      }
    }
  });
  
  // Heartbeat to keep presence alive and detect disconnections
  setInterval(() => {
    if (currentUser.uid && document.visibilityState === 'visible') {
      updateUserPresence(currentUser.currentTable, true);
    }
  }, 30000); // Update every 30 seconds
  
  console.log('✅ Presence cleanup handlers installed');
}

function setupPresenceListener() {
  if (!db) {
    console.error('❌ Firebase db not available for presence listener');
    return;
  }

  console.log('🔍 Setting up presence listener...');
  
  try {
    const presenceRef = collection(db, 'lounge_presence');
    // Only show users who are actually online
    const q = query(presenceRef, where('online', '==', true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('👥 Presence snapshot received, size:', snapshot.size);
      
      onlineUsers = {};
      tableOccupancy = {};
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        // Only include users who are actually online
        if (userData.online) {
          onlineUsers[userData.uid] = userData;
          
          if (userData.currentTable) {
            if (!tableOccupancy[userData.currentTable]) {
              tableOccupancy[userData.currentTable] = [];
            }
            tableOccupancy[userData.currentTable].push({
              name: userData.name,
              avatar: userData.avatar,
              uid: userData.uid
            });
          }
        }
      });
      
      console.log('👥 Online users updated:', Object.keys(onlineUsers).length);
      console.log('🪑 Active tables:', Object.keys(tableOccupancy).length);
      
      // Update all displays with real-time data
      updateTableDisplay();
      updateOnlineUsersList();
      updateStatsDisplay();
      updateRealTimeCounters();
    }, (error) => {
      console.error('❌ Presence listener error:', error);
    });
    
    presenceListeners.push(unsubscribe);
  } catch (error) {
    console.error('❌ Error setting up presence listener:', error);
  }
}

// =====================================================
// CRITICAL FIX 2: CENTRALIZED CHAT MODE CONTROLLER
// =====================================================

function cleanupAllChatListeners() {
  console.log('🧹 Cleaning up all chat listeners:', chatListeners.length);
  chatListeners.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('⚠️ Error unsubscribing listener:', error);
    }
  });
  chatListeners = [];
}

// MISSING FUNCTIONALITY 1: ENHANCED CENTRALIZED CHAT MODE CONTROLLER
function switchChatMode(mode, options = {}) {
  console.log('🔄 Switching chat mode from', currentChatMode, 'to', mode, 'with options:', options);
  
  // STEP 1: ALWAYS cleanup ALL listeners first to prevent bleeding
  console.log('🧹 Cleaning up all existing listeners before mode switch...');
  cleanupAllChatListeners();
  console.log('✅ All listeners cleaned up, count after cleanup:', chatListeners.length);
  
  // STEP 2: Update global state
  currentChatMode = mode;
  if (options.targetUid) whisperTarget = options.targetUid;
  if (options.table) currentUser.currentTable = options.table;
  
  // STEP 3: COMPREHENSIVE DOM element validation with safety
  const chatTitle = document.getElementById('chat-title');
  const chatInput = document.getElementById('chat-input');
  const chatDisplay = document.getElementById('chat-display');
  
  if (!chatDisplay) {
    console.error('❌ CRITICAL: chat-display element missing from DOM');
    return false;
  }
  
  // STEP 4: COMPLETE UI RESET
  console.log('🔄 Resetting UI for mode:', mode);
  chatDisplay.innerHTML = '<div class="chat-loading">🔄 Switching chat mode...</div>';
  
  try {
    switch (mode) {
      case 'global':
        console.log('🌍 Setting up global chat mode...');
        if (chatTitle) chatTitle.textContent = '🌍 Global Lounge Chat';
        if (chatInput) chatInput.placeholder = 'Say something to everyone...';
        setupGlobalChatListener();
        console.log('✅ Global chat listener started, total listeners:', chatListeners.length);
        break;
        
      case 'table':
        console.log('🪑 Setting up table chat mode for table:', options.table);
        if (options.table) {
          const tableName = tableNames[options.table] || options.table;
          if (chatTitle) chatTitle.textContent = `🪑 ${tableName} Chat`;
          if (chatInput) chatInput.placeholder = `Chat with people at ${tableName}...`;
          setupTableChatListener(options.table);
          console.log('✅ Table chat listener started for:', tableName, 'total listeners:', chatListeners.length);
        } else {
          if (chatTitle) chatTitle.textContent = '🪑 Join a table to chat';
          if (chatInput) chatInput.placeholder = 'Join a table first...';
          if (chatDisplay) chatDisplay.innerHTML = '<div class="chat-empty">Join a table to start chatting!</div>';
          console.log('⚠️ No table specified for table chat mode');
        }
        break;
        
      case 'whisper':
        console.log('💬 Setting up whisper mode for user:', options.targetUid);
        if (options.targetUid) {
          const targetUser = onlineUsers[options.targetUid];
          if (chatTitle) chatTitle.textContent = `💬 Whispering with ${targetUser?.name || 'User'}`;
          if (chatInput) chatInput.placeholder = 'Send a private message...';
          setupWhisperListener(options.targetUid);
          console.log('✅ Whisper listener started for:', targetUser?.name, 'total listeners:', chatListeners.length);
        } else {
          if (chatTitle) chatTitle.textContent = '💬 Select a user to whisper';
          if (chatInput) chatInput.placeholder = 'Select someone to whisper...';
          if (chatDisplay) chatDisplay.innerHTML = '<div class="chat-empty">Select a user to start whispering!</div>';
          console.log('⚠️ No target user specified for whisper mode');
        }
        break;
        
      default:
        console.warn('⚠️ Unknown chat mode:', mode, '- falling back to global');
        return switchChatMode('global');
    }
    
    // STEP 5: Update mode button states with DOM safety
    const modeButtons = document.querySelectorAll('.chat-mode-btn');
    console.log('🔘 Updating mode button states, found', modeButtons.length, 'buttons');
    modeButtons.forEach(btn => {
      if (btn && btn.dataset) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      }
    });
    
    console.log('✅ Chat mode successfully switched to:', currentChatMode, 'with', chatListeners.length, 'active listeners');
    return true;
    
  } catch (error) {
    console.error('❌ Error switching chat mode:', error);
    if (chatDisplay) {
      chatDisplay.innerHTML = '<div class="chat-error">❌ Error loading chat. Please refresh the page.</div>';
    }
    return false;
  }
}

// Chat listener setup functions
function setupGlobalChatListener() {
  console.log('💬 Setting up global chat listener...');
  const chatRef = collection(db, 'lounge_chat');
  const q = query(chatRef, orderBy('timestamp', 'desc'), limit(50));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.unshift(doc.data());
    });
    displayChat(messages);
  });
  
  chatListeners.push(unsubscribe);
}

function setupTableChatListener(table) {
  console.log('🪑 Setting up table chat listener for:', table);
  const chatRef = collection(db, 'table_chats', table, 'messages');
  const q = query(chatRef, orderBy('timestamp', 'desc'), limit(30));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.unshift(doc.data());
    });
    displayChat(messages);
  });
  
  chatListeners.push(unsubscribe);
}

function setupWhisperListener(targetUid) {
  console.log('💬 Setting up whisper listener for:', targetUid);
  const conversationId = [currentUser.uid, targetUid].sort().join('_');
  const chatRef = collection(db, 'whispers', conversationId, 'messages');
  const q = query(chatRef, orderBy('timestamp', 'desc'), limit(30));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      const msgData = doc.data();
      // Format whisper messages for display
      const formattedMsg = {
        ...msgData,
        name: msgData.fromName,
        avatar: msgData.fromAvatar,
        message: msgData.message,
        timestamp: msgData.timestamp,
        isFromMe: msgData.fromUid === currentUser.uid
      };
      messages.unshift(formattedMsg);
    });
    displayChat(messages);
  });
  
  chatListeners.push(unsubscribe);
}

// =====================================================
// CHAT DISPLAY AND MESSAGING
// =====================================================

// MISSING FUNCTIONALITY 4: COMPREHENSIVE DOM SAFETY IN CHAT RENDERING
function displayChat(messages) {
  console.log('💬 Displaying', messages.length, 'chat messages with comprehensive DOM safety...');
  
  const chatDisplay = document.getElementById('chat-display');
  if (!chatDisplay) {
    console.error('❌ CRITICAL: chat-display element missing - cannot render messages');
    return;
  }
  
  // Clear existing messages safely
  try {
    chatDisplay.innerHTML = '';
  } catch (error) {
    console.error('❌ Error clearing chat display:', error);
    return;
  }
  
  if (!messages || messages.length === 0) {
    try {
      chatDisplay.innerHTML = '<div class="chat-empty">💬 No messages yet. Be the first to say hello!</div>';
    } catch (error) {
      console.error('❌ Error setting empty chat message:', error);
    }
    return;
  }
  
  console.log('🔄 Rendering', messages.length, 'chat messages...');
  
  messages.forEach((msg, index) => {
    if (!msg) {
      console.warn('⚠️ Skipping null message at index:', index);
      return;
    }
    
    try {
      // Create message element with DOM safety
      const msgEl = document.createElement('div');
      if (!msgEl) {
        console.error('❌ Failed to create message element');
        return;
      }
      
      msgEl.className = `chat-message ${msg.isFromMe ? 'own-message' : ''}`;
      
      // Create avatar with comprehensive error handling
      const avatar = document.createElement('img');
      if (avatar) {
        avatar.src = msg.avatar || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>');
        avatar.className = 'message-avatar';
        avatar.onerror = () => {
          console.warn('⚠️ Avatar failed to load for message:', index);
          avatar.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>');
        };
      }
      
      // Create message content container
      const messageContent = document.createElement('div');
      if (!messageContent) {
        console.error('❌ Failed to create message content container');
        return;
      }
      messageContent.className = 'message-content';
      
      // Create name span with safety
      const nameSpan = document.createElement('span');
      if (nameSpan) {
        nameSpan.className = 'message-name';
        nameSpan.textContent = msg.name || 'Anonymous';
      }
      
      // Create text span with safety
      const textSpan = document.createElement('span');
      if (textSpan) {
        textSpan.className = 'message-text';
        textSpan.textContent = msg.message || '';
      }
      
      // Create time span with safety
      const timeSpan = document.createElement('span');
      if (timeSpan) {
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(msg.timestamp);
      }
      
      // Use safe DOM operations for message construction
      try {
        safeAppendChild(messageContent, nameSpan, 'message name span');
        safeAppendChild(messageContent, textSpan, 'message text span');
        safeAppendChild(messageContent, timeSpan, 'message time span');
        
        safeAppendChild(msgEl, avatar, 'message avatar');
        safeAppendChild(msgEl, messageContent, 'message content');
        
        // Use safe append for final message insertion
        if (!safeAppendChild(chatDisplay, msgEl, 'chat message')) {
          console.error('❌ DOM safety check failed for message:', index);
        }
      } catch (appendError) {
        console.error('❌ Error appending message elements:', appendError);
      }
      
    } catch (error) {
      console.error('❌ Error rendering message at index', index, ':', error);
    }
  });
  
  // Scroll to bottom with safety
  try {
    if (chatDisplay && typeof chatDisplay.scrollTop !== 'undefined') {
      chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }
  } catch (scrollError) {
    console.error('❌ Error scrolling chat display:', scrollError);
  }
  
  console.log('✅ Chat display updated with', messages.length, 'messages');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '';
  }
}

// =====================================================
// CRITICAL FIX 4: VERIFIED MESSAGE SENDING
// =====================================================

// MISSING FUNCTIONALITY 3: CONFESSION CORNER COMPLETION WITH DISTRICT ROUTING
async function sendMessage() {
  const input = document.getElementById("chat-input");
  if (!input) {
    console.error('❌ CRITICAL: Chat input element not found');
    showToast('Error: Chat input not available', 'error');
    return;
  }
  
  const message = input.value.trim();
  if (!message) {
    console.log('📝 Empty message, ignoring send');
    return;
  }
  
  console.log('📤 Sending message:', message.substring(0, 50) + '...', 'mode:', currentChatMode);
  
  try {
    // MISSING FUNCTIONALITY 3: Route to district engines when appropriate
    if (message.toLowerCase().startsWith('/confess ')) {
      const confession = message.substring(9).trim();
      if (confession) {
        console.log('🤫 Routing confession to district engine...');
        await makeConfession(confession);
        input.value = "";
        return;
      }
    }
    
    // Regular chat mode routing
    switch (currentChatMode) {
      case 'global':
        console.log('🌍 Sending global message...');
        await sendGlobalMessage(message);
        break;
      case 'table':
        if (currentUser.currentTable) {
          console.log('🪑 Sending table message to:', currentUser.currentTable);
          await sendTableMessage(currentUser.currentTable, message);
        } else {
          console.warn('⚠️ No table selected for table chat');
          showToast('Please join a table first', 'warning');
          return;
        }
        break;
      case 'whisper':
        if (whisperTarget) {
          console.log('💬 Sending whisper message to:', whisperTarget);
          await sendWhisperMessage(whisperTarget, message);
        } else {
          console.warn('⚠️ No whisper target selected');
          showToast('Please select someone to whisper to', 'warning');
          return;
        }
        break;
      default:
        console.log('🔄 Unknown mode, defaulting to global...');
        await sendGlobalMessage(message);
        break;
    }
    
    input.value = "";
    console.log('✅ Message sent successfully');
    showToast('Message sent!', 'success');
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    showToast('Failed to send message: ' + error.message, 'error');
  }
}

// MISSING FUNCTIONALITY 3: COMPLETE makeConfession METHOD
async function makeConfession(confessionText, category = 'general') {
  console.log('🤫 Making anonymous confession to district engine...');
  
  if (!confessionText || !confessionText.trim()) {
    showToast('Confession text cannot be empty', 'error');
    return false;
  }
  
  try {
    // Initialize confession engine if not already done
    if (!confessionEngine) {
      console.log('🔧 Initializing confession engine...');
      confessionEngine = new ConfessionEngine();
      
      // Wait a bit for engine to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!confessionEngine || !confessionEngine.sendAnonymousConfession) {
      console.error('❌ Confession engine not available');
      showToast('Confession system not available', 'error');
      return false;
    }
    
    console.log('📤 Sending anonymous confession...');
    const success = await confessionEngine.sendAnonymousConfession(confessionText.trim(), { category });
    
    if (success) {
      console.log('✅ Confession sent successfully');
      showToast('🤫 Your anonymous confession has been shared', 'success');
      
      // Track for passport if available
      if (typeof window.PassportAPI !== 'undefined') {
        window.PassportAPI.recordActivity('confession', 'districts', 'Anonymous confession shared');
      }
      
      return true;
    } else {
      console.error('❌ Failed to send confession');
      showToast('Failed to send confession. Please try again.', 'error');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error making confession:', error);
    showToast('Error sharing confession: ' + error.message, 'error');
    return false;
  }
}

async function sendGlobalMessage(message) {
  if (!currentUser.uid || !message.trim()) return;
  
  const chatRef = collection(db, 'lounge_chat');
  const messageData = {
    uid: currentUser.uid,
    name: currentUser.name,
    avatar: currentUser.avatar,
    message: message.trim(),
    timestamp: serverTimestamp()
  };
  
  await addDoc(chatRef, messageData);
  console.log('✅ Global message sent');
  
  // Track for passport
  userMessageCount++;
  if (typeof window.PassportAPI !== 'undefined' && userMessageCount === 1) {
    window.PassportAPI.awardStamp('first_chat', 'lounge', 'Sent first message');
  }
}

async function sendTableMessage(table, message) {
  if (!currentUser.uid || !message.trim() || !table) return;
  
  const chatRef = collection(db, 'table_chats', table, 'messages');
  const messageData = {
    uid: currentUser.uid,
    name: currentUser.name,
    avatar: currentUser.avatar,
    message: message.trim(),
    timestamp: serverTimestamp(),
    table: table
  };
  
  await addDoc(chatRef, messageData);
  console.log('✅ Table message sent to:', table);
}

async function sendWhisperMessage(targetUid, message) {
  if (!currentUser.uid || !message.trim() || !targetUid) return;
  
  const conversationId = [currentUser.uid, targetUid].sort().join('_');
  const chatRef = collection(db, 'whispers', conversationId, 'messages');
  
  const messageData = {
    fromUid: currentUser.uid,
    fromName: currentUser.name,
    fromAvatar: currentUser.avatar,
    toUid: targetUid,
    message: message.trim(),
    timestamp: serverTimestamp(),
    read: false
  };
  
  await addDoc(chatRef, messageData);
  console.log('✅ Whisper sent to:', targetUid);
  
  // Track for passport
  userWhisperHistory.add(targetUid);
  if (typeof window.PassportAPI !== 'undefined') {
    const targetUser = onlineUsers[targetUid];
    if (targetUser) {
      window.PassportAPI.recordEncounter(targetUid, targetUser.name, 'lounge', 'whisper');
    }
  }
}

// =====================================================
// TABLE MANAGEMENT WITH EXPLICIT BINDINGS
// =====================================================

// MISSING FUNCTIONALITY 2: TABLE MANAGEMENT WITH EXPLICIT PRESENCE BINDINGS
function joinTable(tableId) {
  console.log('🪑 Joining table:', tableId, 'for user:', currentUser.uid);
  
  if (!tableId) {
    console.error('❌ Cannot join table: tableId is missing');
    showToast('Error: Invalid table selection', 'error');
    return;
  }
  
  // Update user's current table
  const previousTable = currentUser.currentTable;
  currentUser.currentTable = tableId;
  console.log('📍 Updated currentUser.currentTable from', previousTable, 'to', tableId);
  
  // MISSING FUNCTIONALITY 2: EXPLICIT PRESENCE BINDING
  console.log('📡 Updating presence with explicit table binding...');
  updateUserPresence(tableId).then(() => {
    console.log('✅ Presence updated successfully for table:', tableId);
    showToast(`Joined ${tableNames[tableId] || tableId}!`, 'success');
  }).catch(error => {
    console.error('❌ Error updating presence for table join:', error);
    showToast('Error joining table', 'error');
  });
  
  // CRITICAL FIX: Always switch to table chat mode when joining a table
  console.log('🔄 Automatically switching to table chat mode...');
  switchChatMode('table', { table: tableId });
  
  // Update daily missions progress for table joining
  if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
    try {
      window.DailyMissionsAPI.updateProgress('tables_joined', 1, {
        tableId: tableId,
        tableName: tableNames[tableId] || tableId,
        location: 'lounge'
      });
    } catch (error) {
      console.error('❌ Error tracking table join:', error);
    }
  }
  
  console.log('✅ Joined table:', tableNames[tableId] || tableId);
}

function leaveTable() {
  const previousTable = currentUser.currentTable;
  console.log('🚪 Leaving table:', previousTable, 'for user:', currentUser.uid);
  
  // Clear user's current table
  currentUser.currentTable = null;
  console.log('📍 Cleared currentUser.currentTable');
  
  // MISSING FUNCTIONALITY 2: EXPLICIT PRESENCE REMOVAL
  console.log('📡 Removing presence with explicit binding...');
  updateUserPresence(null).then(() => {
    console.log('✅ Presence removed successfully from table:', previousTable);
    showToast('Left table', 'success');
  }).catch(error => {
    console.error('❌ Error removing presence from table:', error);
    showToast('Error leaving table', 'error');
  });
  
  // Switch back to global chat
  console.log('🌍 Switching to global chat after leaving table...');
  switchChatMode('global');
  
  console.log('✅ Left table:', previousTable);
}

// =====================================================
// CRITICAL FIX 5: DOM-SAFE DISPLAY FUNCTIONS
// =====================================================

// MISSING FUNCTIONALITY 4: COMPREHENSIVE DOM SAFETY
function updateStatsDisplay() {
  const statsContainer = document.getElementById('lounge-stats');
  
  const totalUsers = Object.keys(onlineUsers).length;
  const activeTables = Object.keys(tableOccupancy).length;
  
  // Update main stats container if it exists
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Online Users:</span>
        <span class="stat-value">${totalUsers}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Active Tables:</span>
        <span class="stat-value">${activeTables}</span>
      </div>
    `;
  } else {
    console.warn('⚠️ lounge-stats element not found in DOM');
  }
  
  // MISSING FUNCTIONALITY 2: Update specific counter elements
  updateRealTimeCounters();
}


function showTableUsers(tableNum, event) {
  event.stopPropagation();
  
  const occupants = tableOccupancy[tableNum] || [];
  const tableName = tableNames[tableNum] || tableNum;
  
  let popup = document.getElementById('table-users-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'table-users-popup';
    popup.className = 'table-users-popup';
    safeAppendChild(document.body, popup, 'table users popup');
  }
  
  if (occupants.length === 0) {
    popup.innerHTML = `
      <div class="popup-header">
        <h3>${tableName}</h3>
        <button class="close-popup-btn" type="button">×</button>
      </div>
      <div class="popup-content">
        <p>No one is at this table</p>
      </div>
    `;
    
    // ARCHITECT FIX: Close button handling moved to centralized function
  } else {
    const usersList = occupants.map(occupant => {
      console.log('🎭 Rendering occupant avatar:', occupant.name, '- Avatar:', occupant.avatar?.substring(0, 50) + '...');
      return `
        <div class="popup-user" onclick="startWhisper('${occupant.uid}', '${occupant.name}')">
          <img src="${occupant.avatar}" class="popup-avatar" onerror="this.src='data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 80 80\\"><rect width=\\"100%\\" height=\\"100%\\" fill=\\"#1a1b22\\"/><circle cx=\\"40\\" cy=\\"30\\" r=\\"16\\" fill=\\"#2a2a2a\\"/><path d=\\"M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z\\" fill=\\"#2a2a2a\\"/></svg>')">
          <span>${occupant.name}</span>
        </div>
      `;
    }).join('');
    
    popup.innerHTML = `
      <div class="popup-header">
        <h3>${tableName} (${occupants.length})</h3>
        <button class="close-popup-btn" type="button">×</button>
      </div>
      <div class="popup-content">
        ${usersList}
      </div>
    `;
    
    // ARCHITECT FIX: Close button handling moved to centralized function
  }
  
  popup.style.display = 'block';
  
  // ARCHITECT FIX: Create scoped close handler function with improved logic
  function bindPopupCloseHandlers() {
    const closeBtn = popup.querySelector('.close-popup-btn');
    console.log('🔍 Binding close button handler:', !!closeBtn);
    
    if (closeBtn) {
      // Remove any existing event listeners by cloning the element
      const newCloseBtn = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
      
      // Apply proper styling without conflicts
      newCloseBtn.style.cssText = `
        background: none !important;
        border: none !important;
        color: white !important;
        font-size: 20px !important;
        cursor: pointer !important;
        padding: 5px !important;
        min-width: 30px !important;
        min-height: 30px !important;
        pointer-events: auto !important;
        z-index: 1002 !important;
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      `;
      
      // Add close button click handler
      newCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔴 Close button clicked - removing popup');
        
        // Remove event listeners before removing popup
        document.removeEventListener('click', handleOutsideClick);
        
        // Remove popup from DOM
        if (popup && popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
        
        console.log('✅ Table popup closed via close button');
      });
      console.log('✅ Close button handler bound successfully');
    }
    
    // Improved outside click handler with better logic
    const handleOutsideClick = (e) => {
      // Don't close if clicking inside the popup content
      if (popup.contains(e.target)) {
        console.log('🔍 Click inside popup - not closing');
        return;
      }
      
      // Don't close if clicking on table elements that might trigger the popup
      if (e.target.closest('.table') || e.target.closest('.table-card') || e.target.closest('.table-eye-counter')) {
        console.log('🔍 Click on table element - not closing');
        return;
      }
      
      console.log('🔴 Outside click detected - removing popup');
      
      // Remove the event listener
      document.removeEventListener('click', handleOutsideClick);
      
      // Remove popup from DOM
      if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
      
      console.log('✅ Table popup closed via outside click');
    };
    
    // Add outside click listener after a longer delay to ensure popup is fully rendered
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      console.log('✅ Outside click handler added');
    }, 200);
  }
  
  // Position popup near click
  const rect = event.target.getBoundingClientRect();
  popup.style.left = rect.left + 'px';
  popup.style.top = (rect.top + 30) + 'px';
  
  // CRITICAL FIX: Call the close handler binding function
  bindPopupCloseHandlers();
}

// =====================================================
// MODAL CLOSE FUNCTIONALITY
// =====================================================

function setupModalCloseHandlers(modal) {
  console.log('🔧 Setting up modal close handlers...');
  
  // Setup outside click handler first to reference it later
  const handleModalOutsideClick = (e) => {
    // Don't close if clicking inside the modal content
    if (modal.contains(e.target)) {
      console.log('🔍 Click inside modal - not closing');
      return;
    }
    
    // Don't close if clicking on table elements that might trigger the modal
    if (e.target.closest('.table') || e.target.closest('.table-eye-counter')) {
      console.log('🔍 Click on table element - not closing');
      return;
    }
    
    console.log('🔴 Outside click detected - hiding modal');
    
    modal.style.display = 'none';
    
    // Remove the event listener
    document.removeEventListener('click', handleModalOutsideClick);
    
    console.log('✅ Modal closed via outside click');
  };
  
  // Get the close button
  const closeButton = document.getElementById('user-list-close');
  if (closeButton) {
    // Remove any existing event listeners by cloning the element
    const newCloseButton = closeButton.cloneNode(true);
    closeButton.parentNode.replaceChild(newCloseButton, closeButton);
    
    // Add close button click handler
    newCloseButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔴 Close button clicked - hiding modal');
      
      modal.style.display = 'none';
      
      // Remove outside click listener
      document.removeEventListener('click', handleModalOutsideClick);
      
      console.log('✅ Modal closed via close button');
    });
    
    console.log('✅ Close button handler bound successfully');
  } else {
    console.warn('⚠️ Close button not found');
  }
  
  // Add outside click listener after a delay to ensure modal is fully rendered
  setTimeout(() => {
    document.addEventListener('click', handleModalOutsideClick);
    console.log('✅ Outside click handler added');
  }, 100);
}

// =====================================================
// MAIN INITIALIZATION
// =====================================================

async function initializeLounge() {
  if (loungeInitialized) return;
  loungeInitialized = true;
  
  console.log('🎭 Initializing Lounge...');
  
  // Verify essential DOM elements exist
  const chatDisplay = document.getElementById("chat-display");
  if (!chatDisplay) {
    console.error('❌ CRITICAL: chat-display element not found');
    return;
  }
  
  // Update user display immediately
  updateUserDisplay();
  
  // Setup real-time systems only if db is available
  if (db) {
    console.log('🔍 Setting up real-time listeners...');
    setupPresenceListener();
    
    // Setup automatic presence cleanup when users leave
    setupPresenceCleanup();
    
    // Set initial presence if user is authenticated
    if (currentUser.uid) {
      await updateUserPresence();
    }
    
    // Initialize chat mode based on current user state to prevent race conditions
    if (currentUser.currentTable) {
      console.log('🪑 User already at table:', currentUser.currentTable, '- initializing with table chat');
      switchChatMode('table', { table: currentUser.currentTable });
    } else {
      console.log('🌍 No table assigned - initializing with global chat');
      switchChatMode('global');
    }
  } else {
    console.error('❌ Firebase db not available');
  }
  
  // Setup event handlers
  setupChatUI();
  setupTableJoining();
  setupAvatarPresets();
  
  // Update displays
  updateTableDisplay();
  updateStatsDisplay();
  
  // Setup cleanup on page unload
  window.addEventListener('beforeunload', () => {
    removeUserPresence();
    presenceListeners.forEach(unsubscribe => unsubscribe());
    chatListeners.forEach(unsubscribe => unsubscribe());
  });
  
  console.log('✅ Lounge initialized for:', currentUser.name);
}

function setupChatUI() {
  const sendBtn = document.getElementById("send-btn");
  const chatInput = document.getElementById("chat-input");
  
  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }
  
  if (chatInput) {
    chatInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Setup chat mode buttons
  document.querySelectorAll('.chat-mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.dataset.mode;
      switchChatMode(mode);
    });
  });
}

function setupTableJoining() {
  document.querySelectorAll(".table").forEach(table => {
    table.addEventListener("click", function(e) {
      // Don't trigger if clicking on eye counter
      if (e.target.closest('.table-eye-counter')) return;
      
      const tableNum = this.dataset.table;
      joinTable(tableNum);
    });
  });
}

function setupAvatarPresets() {
  const uploadBtn = document.getElementById('upload-avatar-btn');
  const avatarUpload = document.getElementById("avatar-upload");
  const saveBtn = document.getElementById('save-avatar-btn');
  
  if (uploadBtn) {
    uploadBtn.addEventListener('click', function() {
      const fileInput = document.getElementById('avatar-upload');
      if (fileInput) fileInput.click();
    });
  }
  
  if (avatarUpload) {
    avatarUpload.addEventListener("change", handleAvatarUpload);
  }
  
  // Fixed: Add missing save avatar button handler
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      try {
        if (currentUser.avatar && currentUser.uid) {
          await saveAvatarSelection(currentUser.avatar);
          showToast('Avatar saved successfully!', 'success');
          console.log('✅ Avatar saved:', currentUser.avatar);
        } else {
          showToast('Please select an avatar first', 'error');
        }
      } catch (error) {
        console.error('❌ Error saving avatar:', error);
        showToast('Failed to save avatar. Please try again.', 'error');
      }
    });
  }
  
  // Setup preset avatar selection
  document.querySelectorAll('.preset').forEach(preset => {
    preset.addEventListener('click', function() {
      const avatarUrl = this.src;
      currentUser.avatar = avatarUrl;
      updateUserDisplay();
      saveAvatarSelection(avatarUrl);
      
      // Update selection visuals
      document.querySelectorAll('.preset').forEach(p => p.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentUser.uid) return;
  
  try {
    const currentAvatarDisplay = document.getElementById('current-avatar-display');
    if (currentAvatarDisplay) currentAvatarDisplay.style.opacity = '0.5';
    
    // Upload to Firebase Storage if authenticated
    let avatarUrl;
    if (authUser) {
      avatarUrl = await uploadUserPhoto(currentUser.uid, file);
    } else {
      // Convert to data URL for guest users
      const reader = new FileReader();
      avatarUrl = await new Promise((resolve) => {
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsDataURL(file);
      });
    }
    
    // Update and save
    currentUser.avatar = avatarUrl;
    updateUserDisplay();
    await saveAvatarSelection(avatarUrl);
    
    console.log('✅ Avatar uploaded and saved');
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    const currentAvatarDisplay = document.getElementById('current-avatar-display');
    if (currentAvatarDisplay) currentAvatarDisplay.style.opacity = '1';
  }
}

// =====================================================
// WHISPER FUNCTIONALITY
// =====================================================

function startWhisper(targetUid, targetName) {
  console.log('💬 Starting whisper with:', targetName);
  switchChatMode('whisper', { targetUid });
}

// =====================================================
// GLOBAL FUNCTION EXPORTS
// =====================================================

// MISSING FUNCTIONALITY 4: COMPREHENSIVE TOAST NOTIFICATION SYSTEM
function showToast(message, type = 'info', duration = 3000) {
  console.log('🍞 Showing toast:', type, '-', message);
  
  // Try to use existing toast system first
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    try {
      window.showToast(message, type);
      return;
    } catch (error) {
      console.warn('⚠️ External toast system failed:', error);
    }
  }
  
  // Fallback toast implementation
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    if (!safeAppendChild(document.body, toastContainer, 'toast container')) {
      console.error('❌ Cannot create toast container - document.body not available');
      return;
    }
  }
  
  const toast = document.createElement('div');
  if (!toast) {
    console.error('❌ Failed to create toast element');
    return;
  }
  
  toast.style.cssText = `
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  // Set background color based on type
  switch (type) {
    case 'success':
      toast.style.backgroundColor = '#22c55e';
      break;
    case 'error':
      toast.style.backgroundColor = '#ef4444';
      break;
    case 'warning':
      toast.style.backgroundColor = '#f59e0b';
      break;
    default:
      toast.style.backgroundColor = '#3b82f6';
  }
  
  toast.textContent = message;
  
  if (!safeAppendChild(toastContainer, toast, 'toast message')) {
    console.error('❌ Failed to append toast message');
    return;
  }
  
  // Animate in
  setTimeout(() => {
    if (toast.style) {
      toast.style.transform = 'translateX(0)';
    }
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    if (toast.style) {
      toast.style.transform = 'translateX(100%)';
    }
    setTimeout(() => {
      try {
        if (toast.parentNode && toast.parentNode.removeChild) {
          toast.parentNode.removeChild(toast);
        }
      } catch (error) {
        console.error('❌ Error removing toast:', error);
      }
    }, 300);
  }, duration);
}

// GLOBAL FUNCTION EXPORTS
window.joinTable = joinTable;
window.leaveTable = leaveTable;
window.startWhisper = startWhisper;
window.switchChatMode = switchChatMode;
window.sendMessage = sendMessage;
window.makeConfession = makeConfession;
window.showToast = showToast;

// =====================================================
// DOM INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎭 DOM loaded, starting initialization...');
  
  // Setup tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      const tabName = this.dataset.tab;
      const tabContent = document.getElementById(tabName + '-content');
      if (tabContent) tabContent.style.display = 'block';
    });
  });
  
  // Setup points display click handler
  safeAddEventListener(safeGetById('userPointsDisplay'), 'click', function() {
    window.location.href = '../leaderboard.html';
  }, 'points display navigation');
  
  // Start deterministic authentication flow
  initializeWithDeterministicAuth();
});