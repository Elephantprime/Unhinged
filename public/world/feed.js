// Import Firebase authentication and database functionality
import { 
  auth, 
  db, 
  getUserDoc, 
  onAuthStateChanged,
  onSnapshot,
  serverTimestamp, 
  collection, 
  doc, 
  addDoc, 
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query, 
  orderBy, 
  limit, 
  where
} from '../js/firebase.js';

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

// Unhinged Feed JavaScript - Town Square
let currentUser = null;
let feedItems = [];
let lastFeedDoc = null;
let isLoadingFeed = false;
let selectedTags = new Set();

// Listener management to prevent memory leaks
let activeListeners = {
  feed: null,
  stageEvents: null,
  userActivity: null,
  liveUpdates: null,
  presence: null,
  comments: new Map() // Store comment listeners by postId
};

// Presence tracking state
let currentUserPresence = null;
let presenceHeartbeat = null;

// Cleanup function for all listeners
function cleanupListeners() {
  console.log('🧹 Cleaning up all active listeners');
  
  // Safety check to ensure activeListeners exists
  if (typeof activeListeners !== 'object' || activeListeners === null) {
    console.warn('⚠️ activeListeners object not available during cleanup');
    return;
  }
  
  // Unsubscribe from main feed listener
  if (activeListeners.feed && typeof activeListeners.feed === 'function') {
    activeListeners.feed();
    activeListeners.feed = null;
  }
  
  // Unsubscribe from stage events listener
  if (activeListeners.stageEvents && typeof activeListeners.stageEvents === 'function') {
    activeListeners.stageEvents();
    activeListeners.stageEvents = null;
  }
  
  // Unsubscribe from user activity listener
  if (activeListeners.userActivity && typeof activeListeners.userActivity === 'function') {
    activeListeners.userActivity();
    activeListeners.userActivity = null;
  }
  
  // Unsubscribe from live updates listener - handle both interval IDs and functions safely
  if (activeListeners.liveUpdates !== null && activeListeners.liveUpdates !== undefined) {
    if (typeof activeListeners.liveUpdates === 'number') {
      // It's an interval ID - use clearInterval
      clearInterval(activeListeners.liveUpdates);
    } else if (typeof activeListeners.liveUpdates === 'function') {
      // It's a function - call it (shouldn't happen but handle it safely)
      console.warn('⚠️ liveUpdates was unexpectedly a function - calling it');
      activeListeners.liveUpdates();
    } else {
      console.warn('⚠️ liveUpdates has unexpected type:', typeof activeListeners.liveUpdates);
    }
    activeListeners.liveUpdates = null;
  }
  
  // Unsubscribe from presence listener
  if (activeListeners.presence && typeof activeListeners.presence === 'function') {
    activeListeners.presence();
    activeListeners.presence = null;
  }
  
  // Stop presence heartbeat
  if (presenceHeartbeat) {
    clearInterval(presenceHeartbeat);
    presenceHeartbeat = null;
  }
  
  // Remove user presence from Firebase
  removeUserPresence();
  
  // Unsubscribe from all comment listeners
  activeListeners.comments.forEach((unsubscribe, postId) => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  activeListeners.comments.clear();
  
  // Cleanup feed stats listeners
  if (activeListeners.feedStatsPresence && typeof activeListeners.feedStatsPresence === 'function') {
    activeListeners.feedStatsPresence();
    activeListeners.feedStatsPresence = null;
  }
  if (activeListeners.feedStatsEvents && typeof activeListeners.feedStatsEvents === 'function') {
    activeListeners.feedStatsEvents();
    activeListeners.feedStatsEvents = null;
  }
  if (activeListeners.feedStatsActivity && typeof activeListeners.feedStatsActivity === 'function') {
    activeListeners.feedStatsActivity();
    activeListeners.feedStatsActivity = null;
  }
}

// Initialize Feed
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🏛️ Town Square Feed initializing...');
  
  // Setup UI first
  setupFeedInteractions();
  
  // Setup cleanup on page unload
  window.addEventListener('beforeunload', cleanupListeners);
  window.addEventListener('unload', cleanupListeners);
  
  // Wait for authentication state
  try {
    const user = await waitForAuthState();
    if (user) {
      await loadUserProfile(user);
      setupFeedListeners();
      // Setup real-time statistics after authentication
      setupFeedRealTimeStats();
    } else {
      // Redirect to login
      window.location.href = '../login.html';
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
    console.error('❌ Firebase authentication failed - redirecting to login');
    window.location.href = '../login.html';
  }
});

// Wait for authentication state to resolve with proper Firebase loading check
async function waitForAuthState() {
  // First ensure Firebase auth is available
  if (typeof auth === 'undefined') {
    console.warn('⚠️ Firebase auth not available, attempting to load...');
    // Give Firebase time to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (typeof auth === 'undefined') {
      throw new Error('Firebase auth failed to load');
    }
  }
  
  return new Promise((resolve) => {
    // Check immediate state first
    if (auth.currentUser) {
      console.log('✅ Auth user immediately available:', auth.currentUser.uid);
      resolve(auth.currentUser);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔄 Auth state changed:', user ? user.uid : 'null');
      unsubscribe();
      resolve(user);
    });
  });
}

// Load user profile with consistent avatar handling
async function loadUserProfile(user) {
  try {
    console.log('🔄 Loading user profile for:', user.uid);
    
    // Get user document from Firestore (read-only)
    const userDoc = await getUserDoc(user.uid);
    console.log('📄 User document:', userDoc);
    
    // Get unique avatar using AvatarUtils with proper user-specific generation
    let userAvatar = null;
    if (window.AvatarUtils?.loadAvatar) {
      userAvatar = await window.AvatarUtils.loadAvatar(user.uid);
      console.log('🎭 Unique avatar loaded via AvatarUtils for user:', user.uid.substring(0, 8), userAvatar?.substring(0, 50));
    } else {
      // Fallback with unique avatar generation based on user ID
      userAvatar = userDoc?.photoURL || 
                   userDoc?.loungeAvatar || 
                   user.photoURL || 
                   (Array.isArray(userDoc?.photos) && userDoc.photos.length > 0 ? userDoc.photos[0] : null) ||
                   generateUniqueUserAvatar(user.uid);
      console.log('🎭 Unique avatar loaded manually for user:', user.uid.substring(0, 8));
    }
    
    const displayName = userDoc?.displayName || 
                       user.displayName || 
                       user.email?.split('@')[0] ||
                       `User${user.uid.substring(0, 8)}`;
    
    currentUser = {
      uid: user.uid,
      name: displayName,
      avatar: userAvatar,
      mood: userDoc?.mood || 'available'
    };
    
    updateUserDisplay();
    console.log('✅ Feed loaded for authenticated user:', currentUser.name, 'with avatar:', currentUser.avatar?.substring(0, 50));
  } catch (error) {
    console.error('❌ Error loading user profile:', error);
    // Use a better fallback that includes user info
    setupFallbackUser(user);
  }
}

// Fallback user with better identification
async function setupFallbackUser(user = null) {
  if (user) {
    // Create fallback from real user info with unique avatar using AvatarUtils
    const fallbackAvatar = window.AvatarUtils ? 
      await window.AvatarUtils.loadAvatar(user.uid) : 
      generateUniqueUserAvatar(user.uid);
      
    currentUser = {
      uid: user.uid,
      name: user.displayName || user.email?.split('@')[0] || `User${user.uid.substring(0, 8)}`,
      avatar: user.photoURL || fallbackAvatar,
      mood: 'available'
    };
    console.log('⚠️ Using fallback user profile with unique avatar for:', currentUser.name);
  } else {
    // Last resort demo user
    const demoId = 'anonymous_' + Date.now();
    currentUser = {
      uid: demoId,
      name: 'Anonymous User',
      avatar: window.AvatarUtils ? window.AvatarUtils.generateGenericFallback() : generateDefaultAvatar(),
      mood: 'available'
    };
    console.log('⚠️ Using anonymous user - no authentication available');
  }
  updateUserDisplay();
}

// Generate unique avatar based on user ID for consistent uniqueness
function generateUniqueUserAvatar(uid) {
  // Use AvatarUtils if available
  if (window.AvatarUtils?.generateUniqueAvatar) {
    return window.AvatarUtils.generateUniqueAvatar(uid);
  }
  
  // Fallback unique avatar generation
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const hue = Math.abs(hash) % 360;
  const saturation = 50 + (Math.abs(hash >> 8) % 30);
  const lightness = 40 + (Math.abs(hash >> 16) % 20);
  const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const fgColor = `hsl(${hue}, ${saturation + 20}%, ${lightness + 20}%)`;
  
  const initials = uid.substring(0, 2).toUpperCase();
  
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <circle cx="25" cy="18" r="8" fill="${fgColor}"/>
      <path d="M 8 40 Q 8 32 13 30 Q 18 25 25 25 Q 32 25 37 30 Q 42 32 42 40 L 42 50 L 8 50 Z" fill="${fgColor}"/>
      <text x="25" y="45" text-anchor="middle" fill="white" font-family="Arial" font-size="8" font-weight="bold">${initials}</text>
    </svg>
  `);
}

// Generate default avatar SVG (generic fallback)
function generateDefaultAvatar() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
      <rect width="100%" height="100%" fill="#1a1b22"/>
      <circle cx="25" cy="20" r="10" fill="#2a2a2a"/>
      <path d="M 10 40 Q 10 32 15 30 Q 20 25 25 25 Q 30 25 35 30 Q 40 32 40 40 L 40 50 L 10 50 Z" fill="#2a2a2a"/>
    </svg>
  `);
}

// Update user display
function updateUserDisplay() {
  const userAvatar = safeGetById('user-avatar', false);
  const userName = safeGetById('user-name', false);
  
  if (userAvatar && currentUser?.avatar) {
    if (typeof window.AvatarUtils?.updateDisplay === 'function') {
      window.AvatarUtils.updateDisplay(currentUser.avatar, userAvatar);
    } else {
      userAvatar.src = currentUser.avatar;
    }
  }
  
  if (userName) userName.textContent = currentUser.name;
}

// Setup feed interactions
function setupFeedInteractions() {
  // Create post modal
  const createPostBtn = document.getElementById('create-post-btn');
  const postModal = document.getElementById('post-modal');
  const closeBtn = postModal?.querySelector('.close-btn');
  const cancelBtn = document.getElementById('cancel-post-btn');
  const submitBtn = document.getElementById('submit-post-btn');
  
  if (createPostBtn) {
    createPostBtn.addEventListener('click', openPostModal);
  }
  
  if (closeBtn) closeBtn.addEventListener('click', closePostModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closePostModal);
  if (submitBtn) submitBtn.addEventListener('click', submitPost);
  
  // Tag selection
  document.querySelectorAll('.tag-option').forEach(tag => {
    tag.addEventListener('click', function() {
      const tagValue = this.dataset.tag;
      this.classList.toggle('selected');
      
      if (selectedTags.has(tagValue)) {
        selectedTags.delete(tagValue);
      } else {
        selectedTags.add(tagValue);
      }
    });
  });
  
  // World pulse button
  const worldPulseBtn = document.getElementById('world-pulse-btn');
  if (worldPulseBtn) {
    worldPulseBtn.addEventListener('click', showWorldPulse);
  }
  
  // Load more button
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreFeed);
  }
  
  // Modal close on outside click
  if (postModal) {
    postModal.addEventListener('click', function(e) {
      if (e.target === postModal) {
        closePostModal();
      }
    });
  }
}

// Open post creation modal
function openPostModal() {
  const postModal = document.getElementById('post-modal');
  if (postModal) {
    postModal.style.display = 'flex';
    document.getElementById('post-content')?.focus();
  }
}

// Close post creation modal
function closePostModal() {
  const postModal = document.getElementById('post-modal');
  if (postModal) {
    postModal.style.display = 'none';
    // Clear form
    document.getElementById('post-content').value = '';
    document.querySelectorAll('.tag-option.selected').forEach(tag => {
      tag.classList.remove('selected');
    });
    selectedTags.clear();
  }
}

// Submit new post with enhanced authentication and error handling
async function submitPost() {
  const content = document.getElementById('post-content')?.value?.trim();
  const visibility = document.getElementById('post-visibility')?.value || 'public';
  const submitBtn = document.getElementById('submit-post-btn');
  
  if (!content) {
    showToast('Please write something before posting!', 'error');
    return;
  }
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
  }
  
  try {
    // Enhanced authentication verification
    const user = await waitForAuthState();
    if (!user) {
      console.error('❌ No authenticated user when submitting post');
      showToast('Authentication required. Please log in.', 'error');
      window.location.href = '../login.html';
      return;
    }
    
    // Ensure user document exists with retry logic
    let userDoc = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        userDoc = await getUserDoc(user.uid);
        if (userDoc) break;
      } catch (docError) {
        console.warn(`⚠️ User document attempt ${retryCount + 1} failed:`, docError);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }
      }
    }
    
    if (!userDoc) {
      throw new Error('Unable to create user document after multiple attempts');
    }
    
    // Ensure currentUser is properly initialized
    if (!currentUser) {
      await loadUserProfile(user);
      if (!currentUser) {
        throw new Error('Failed to load user profile');
      }
    }
    
    // Validate Firebase connectivity
    if (typeof addDoc === 'undefined' || typeof collection === 'undefined' || typeof db === 'undefined') {
      throw new Error('Firebase not properly initialized');
    }
    
    // Create post data with validated user information
    // CRITICAL FIX: Ensure author.name and author.avatar are always strings for Firebase validation
    const authorName = String(currentUser?.name || userDoc?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Anonymous');
    
    // Use AvatarUtils for consistent avatar loading
    let authorAvatar = currentUser?.avatar;
    if (!authorAvatar && window.AvatarUtils) {
      authorAvatar = await window.AvatarUtils.loadAvatar(user.uid);
    } else if (!authorAvatar) {
      authorAvatar = generateUniqueUserAvatar(user.uid);
    }
    authorAvatar = String(authorAvatar);
    
    const postData = {
      uid: user.uid,
      author: {
        uid: user.uid,
        name: authorName,
        avatar: authorAvatar
      },
      content: String(content), // Ensure content is also a string
      visibility: visibility || 'public', // Ensure visibility has a default
      tags: Array.from(selectedTags),
      type: 'user_post',
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      likes: 0,
      comments: 0,
      shares: 0,
      district: 'townSquare'
    };
    
    console.log('📝 Creating post with validated data:', {
      uid: postData.uid,
      author: postData.author.name,
      content: postData.content.substring(0, 50) + '...',
      tags: postData.tags
    });
    
    // Debug payload logging removed for production
    
    // Save to Firebase with proper error handling
    const feedRef = collection(db, 'world_feed');
    const docRef = await addDoc(feedRef, postData);
    
    console.log('✅ Post successfully created with ID:', docRef.id);
    
    // Clear form and close modal
    document.getElementById('post-content').value = '';
    selectedTags.clear();
    document.querySelectorAll('.tag-option.selected').forEach(tag => {
      tag.classList.remove('selected');
    });
    
    closePostModal();
    showToast('Your post has been shared with the world!', 'success');
    
    // Refresh feed to show new post
    setTimeout(() => {
      setupFeedListeners();
    }, 500);
    
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('🔍 FULL ERROR DETAILS:', {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack
    });
    
    let errorMessage = 'Failed to create post. ';
    
    // Provide specific error messages based on error type
    if (error.code === 'permission-denied') {
      errorMessage += 'You don\'t have permission to post. Please check your authentication.';
    } else if (error.code === 'unavailable') {
      errorMessage += 'Service is temporarily unavailable. Please try again in a moment.';
    } else if (error.code === 'unauthenticated') {
      errorMessage += 'You need to be logged in to post. Please log in and try again.';
    } else if (error.message?.includes('auth')) {
      errorMessage += 'Authentication issue. Please refresh the page and log in again.';
    } else if (error.message?.includes('network') || error.message?.includes('offline')) {
      errorMessage += 'Network connection issue. Please check your internet and try again.';
    } else {
      errorMessage += 'Please check your connection and try again.';
    }
    
    showToast(errorMessage, 'error');
    
  } finally {
    // Always re-enable the submit button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post to Feed';
    }
  }
}

// Setup Firebase feed listeners
function setupFeedListeners() {
  
  // Verify authentication state before setting up listeners
  if (!auth.currentUser) {
    console.error('❌ No authenticated user when setting up feed listeners');
    // Wait a bit and retry if auth is still loading
    setTimeout(() => {
      if (auth.currentUser) {
        console.log('🔄 Retrying feed listeners after authentication');
        setupFeedListeners();
      } else {
        console.warn('⚠️ Still no auth after delay, showing empty feed');
        showEmptyFeedState();
      }
    }, 2000);
    return;
  }
  
  console.log('✅ Setting up feed listeners for authenticated user:', auth.currentUser.uid);
  
  // Clean up previous listeners before setting up new ones
  if (activeListeners.feed) {
    console.log('🧹 Cleaning up previous feed listener');
    activeListeners.feed();
    activeListeners.feed = null;
  }
  
  // Set up presence tracking for Town Square
  setupPresenceTracking();
  
  try {
    // Listen for new feed items from world_feed collection
    const feedRef = collection(db, 'world_feed');
    const feedQuery = query(feedRef, orderBy('timestamp', 'desc'), limit(20));
    
    activeListeners.feed = onSnapshot(feedQuery, (snapshot) => {
      console.log('📡 Feed snapshot received with', snapshot.size, 'documents');
      feedItems = [];
      snapshot.forEach((doc) => {
        const feedItem = { id: doc.id, ...doc.data() };
        feedItems.push(feedItem);
      });
      
      // If no feed items exist, show empty state instead of demo data
      if (feedItems.length === 0) {
        console.log('📝 No feed items found, showing empty feed state');
        showEmptyFeedState();
      } else {
        console.log('✅ Rendering', feedItems.length, 'feed items');
        renderFeedItems();
        updateLoadingState(false);
      }
    }, (error) => {
      console.error('❌ Error loading feed:', error);
      console.error('❌ Auth state:', auth.currentUser ? 'Authenticated' : 'Not authenticated');
      console.error('❌ User UID:', auth.currentUser?.uid);
      showEmptyFeedState();
    });
    
    // Listen for stage events to add to feed
    setupStageEventsListener();
    
    // Listen for user activity to create feed items
    setupUserActivityListener();
    
    // Listen for live events and updates
    setupLiveUpdatesListener();
    
  } catch (error) {
    console.error('❌ Error setting up feed listeners:', error);
    showEmptyFeedState();
  }
}

// Listen to stage events and add them to feed
function setupStageEventsListener() {
  // Clean up previous stage events listener
  if (activeListeners.stageEvents) {
    console.log('🧹 Cleaning up previous stage events listener');
    activeListeners.stageEvents();
    activeListeners.stageEvents = null;
  }
  
  try {
    const eventsRef = collection(db, 'stages_events');
    const eventsQuery = query(eventsRef, where('status', '==', 'live'), limit(5));
    
    activeListeners.stageEvents = onSnapshot(eventsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const event = change.doc.data();
          createEventFeedItem(change.doc.id, event);
        }
      });
    });
  } catch (error) {
    console.warn('⚠️ Could not set up stage events listener:', error);
  }
}

// Listen to user activity in various collections
function setupUserActivityListener() {
  // Clean up previous user activity listener
  if (activeListeners.userActivity) {
    console.log('🧹 Cleaning up previous user activity listener');
    activeListeners.userActivity();
    activeListeners.userActivity = null;
  }
  
  try {
    // Listen to lounge activity
    const loungeRef = collection(db, 'lounge_tables');
    activeListeners.userActivity = onSnapshot(loungeRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const table = change.doc.data();
          if (table.participants && table.participants.length > 0) {
            createLoungeFeedItem(table);
          }
        }
      });
    });
  } catch (error) {
    console.warn('⚠️ Could not set up user activity listener:', error);
  }
}

// Create event feed item
async function createEventFeedItem(eventId, event) {
  if (!currentUser) return;
  
  try {
    const feedItem = {
      type: 'event_update',
      author: `${event.eventType} Event`,
      avatar: generateDefaultAvatar(),
      content: `${event.title} is now live! ${event.description || 'Join the action!'}`,
      eventType: event.eventType,
      eventIcon: getEventTypeIcon(event.eventType),
      eventId: eventId,
      timestamp: serverTimestamp(),
      likes: 0,
      comments: 0,
      shares: 0,
      visibility: 'public'
    };
    
    await addDoc(collection(db, 'world_feed'), feedItem);
    console.log('✅ Event feed item created for:', event.title);
  } catch (error) {
    console.error('❌ Error creating event feed item:', error);
  }
}

// Create lounge activity feed item
async function createLoungeFeedItem(table) {
  if (!currentUser || !table.participants || table.participants.length < 2) return;
  
  try {
    const feedItem = {
      type: 'user_post',
      author: 'Lounge Activity',
      avatar: generateDefaultAvatar(),
      content: `A new conversation just started at Table ${table.tableNumber || 'Unknown'}! ${table.participants.length} people are chatting about ${table.topic || 'life'}.`,
      tags: ['lounge', 'social'],
      timestamp: serverTimestamp(),
      likes: 0,
      comments: 0,
      shares: 0,
      visibility: 'public'
    };
    
    await addDoc(collection(db, 'world_feed'), feedItem);
    console.log('✅ Lounge activity feed item created');
  } catch (error) {
    console.error('❌ Error creating lounge feed item:', error);
  }
}

// Show empty feed state instead of demo data
function showEmptyFeedState() {
  console.log('📱 Showing empty feed state for authenticated user');
  feedItems = [];
  renderFeedItems();
  updateLoadingState(false);
}

// Get event type icon
function getEventTypeIcon(eventType) {
  const icons = {
    'hot_seat': '🔥',
    'audio_room': '🎤',
    'video_pod': '📹',
    'speed_dating': '💕',
    'truth_dare': '🎭',
    'confession': '🙊'
  };
  return icons[eventType] || '🎉';
}

// Setup presence tracking for Town Square
async function setupPresenceTracking() {
  console.log('🔍 setupPresenceTracking called, currentUser:', currentUser);
  
  if (!currentUser?.uid) {
    console.warn('⚠️ No current user for presence tracking');
    return;
  }
  
  console.log('📡 Setting up Town Square presence tracking for:', currentUser.uid);
  
  try {
    // Write user presence to Firebase
    await updateUserPresence();
    
    // Set up presence heartbeat (update every 30 seconds)
    presenceHeartbeat = setInterval(updateUserPresence, 30000);
    
    // Set up real-time presence listener
    setupPresenceListener();
    
    console.log('✅ Town Square presence tracking active');
  } catch (error) {
    console.error('❌ Error setting up presence tracking:', error);
  }
}

// Update user presence in Firebase
async function updateUserPresence() {
  if (!currentUser?.uid || !db) return;
  
  try {
    const presenceData = {
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      location: 'town_square',
      lastActive: serverTimestamp(),
      timestamp: serverTimestamp()
    };
    
    await setDoc(doc(db, 'presence', currentUser.uid), presenceData);
    currentUserPresence = presenceData;
    
  } catch (error) {
    console.error('❌ Error updating presence:', error);
  }
}

// Remove user presence from Firebase
async function removeUserPresence() {
  if (!currentUser?.uid || !db) return;
  
  try {
    await deleteDoc(doc(db, 'presence', currentUser.uid));
    currentUserPresence = null;
    console.log('🚪 User presence removed from Town Square');
  } catch (error) {
    console.error('❌ Error removing presence:', error);
  }
}

// Setup real-time presence listener
function setupPresenceListener() {
  if (!db) {
    console.error('❌ Firebase db not available for presence listener');
    return;
  }
  
  console.log('🔍 Setting up real-time presence listener...');
  
  try {
    const presenceRef = collection(db, 'presence');
    const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      const onlineUsers = {};
      let totalOnline = 0;
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData && userData.uid) {
          onlineUsers[userData.uid] = userData;
          totalOnline++;
        }
      });
      
      console.log(`👥 Real-time presence update: ${totalOnline} users online`);
      
      // Update the live stats display immediately
      updateOnlineUsersDisplay(totalOnline);
      
    }, (error) => {
      console.error('❌ Presence listener error:', error);
    });
    
    // Store the unsubscribe function
    activeListeners.presence = unsubscribe;
    console.log('✅ Real-time presence listener active');
    
  } catch (error) {
    console.error('❌ Error setting up presence listener:', error);
  }
}

// Update online users display in real-time
function updateOnlineUsersDisplay(count) {
  const activeUsersEl = document.getElementById('active-users-count');
  if (activeUsersEl) {
    activeUsersEl.textContent = `${count} online`;
  }
}

// Setup live updates listener - now uses real-time presence
function setupLiveUpdatesListener() {
  // Clean up previous live updates if any - with type safety
  if (activeListeners.liveUpdates !== null && activeListeners.liveUpdates !== undefined) {
    console.log('🧹 Cleaning up previous live updates listener');
    if (typeof activeListeners.liveUpdates === 'number') {
      clearInterval(activeListeners.liveUpdates);
    } else {
      console.warn('⚠️ setupLiveUpdatesListener: liveUpdates had unexpected type:', typeof activeListeners.liveUpdates);
    }
    activeListeners.liveUpdates = null;
  }
  
  // Set up initial stats update and then rely on real-time listeners
  updateLiveStats();
  
  // Periodic update for events and activity (not presence - that's real-time)
  activeListeners.liveUpdates = setInterval(() => {
    updateLiveEventsAndActivity();
  }, 60000); // Update every minute for events/activity
}

// Removed demo feed - using real user content only
function loadDemoFeed() {
  // Demo feed disabled - using real user content only
  showEmptyFeedState();
}

// Render feed items
function renderFeedItems() {
  const feedContainer = document.getElementById('feed-items');
  const emptyState = document.getElementById('empty-state');
  
  if (!feedContainer) return;
  
  if (feedItems.length === 0) {
    feedContainer.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  feedContainer.innerHTML = feedItems.map(item => createFeedItemHTML(item)).join('');
  
  // Add event listeners to action buttons
  setupFeedItemActions();
}

// Create HTML for individual feed item
function createFeedItemHTML(item) {
  const timeAgo = getTimeAgo(item.timestamp);
  const typeBadge = getFeedTypeBadge(item.type);
  const tagsHTML = item.tags ? item.tags.map(tag => `<span class="item-tag">${getTagEmoji(tag)} ${tag}</span>`).join('') : '';
  
  let contentHTML = '';
  if (item.type === 'event_update') {
    contentHTML = `
      <div class="event-content">
        <span class="event-icon">${item.eventIcon || '🎉'}</span>
        <span>${escapeHtml(item.content)}</span>
      </div>
    `;
  } else {
    contentHTML = `<div class="post-content">${escapeHtml(item.content)}</div>`;
  }
  
  return `
    <div class="feed-item" data-item-id="${item.id}" data-testid="feed-item-${item.id}">
      <div class="item-header">
        <img class="item-avatar" src="${item.author?.avatar || (window.AvatarUtils ? window.AvatarUtils.generateUniqueAvatar(item.author?.uid || item.uid || 'anonymous') : generateDefaultAvatar())}" alt="${escapeHtml(item.author?.name || item.author)}" data-testid="img-avatar-${item.id}">
        <div class="item-user-info">
          <div class="item-username" data-testid="text-username-${item.id}">${escapeHtml(item.author?.name || item.author)}</div>
          <div class="item-meta">
            <span class="item-type-badge" data-testid="text-type-${item.id}">${typeBadge}</span>
            <span data-testid="text-time-${item.id}">${timeAgo}</span>
            ${item.visibility ? `<span>👁️ ${item.visibility}</span>` : ''}
          </div>
        </div>
      </div>
      
      <div class="item-content">
        ${contentHTML}
      </div>
      
      ${tagsHTML ? `<div class="item-tags">${tagsHTML}</div>` : ''}
      
      <div class="item-reactions">
        <div class="reaction-group">
          <div class="reaction-item fire-reaction" data-reaction="fire" data-testid="button-fire-${item.id}">
            🔥 <span class="reaction-count">${item.reactions?.fire || 0}</span>
          </div>
          <div class="reaction-item skull-reaction" data-reaction="skull" data-testid="button-skull-${item.id}">
            💀 <span class="reaction-count">${item.reactions?.skull || 0}</span>
          </div>
          <div class="reaction-item heart-break-reaction" data-reaction="heartbreak" data-testid="button-heartbreak-${item.id}">
            💔 <span class="reaction-count">${item.reactions?.heartbreak || 0}</span>
          </div>
          <div class="reaction-item laugh-reaction" data-reaction="laugh" data-testid="button-laugh-${item.id}">
            😂 <span class="reaction-count">${item.reactions?.laugh || 0}</span>
          </div>
        </div>
        
        ${currentUser && item.author?.uid === currentUser.uid ? `
        <div class="post-actions">
          <button class="delete-post-btn" onclick="deletePost('${item.id}')" data-testid="button-delete-${item.id}" title="Delete your post">
            🗑️
          </button>
        </div>
        ` : ''}
        </div>
        <div class="action-group">
          <div class="action-item comment-action" data-testid="button-comment-${item.id}">💬 <span class="comment-count">${item.comments || 0}</span></div>
          <div class="action-item share-action" data-testid="button-share-${item.id}">🔄</div>
        </div>
      </div>
      
      <!-- Comment Section (visible by default) -->
      <div class="comment-section" id="comments-${item.id}" data-testid="section-comments-${item.id}">
        <div class="comment-form">
          <img class="comment-avatar" src="${currentUser?.avatar || generateDefaultAvatar()}" alt="Your avatar">
          <div class="comment-input-container">
            <textarea class="comment-input" id="comment-input-${item.id}" placeholder="Write a comment..." data-testid="input-comment-${item.id}"></textarea>
            <div class="comment-actions">
              <button class="btn-comment-cancel" onclick="hideComments('${item.id}')" data-testid="button-cancel-comment-${item.id}">Cancel</button>
              <button class="btn-comment-submit" onclick="submitComment('${item.id}')" data-testid="button-submit-comment-${item.id}">Comment</button>
            </div>
          </div>
        </div>
        <div class="comments-list" id="comments-list-${item.id}" data-testid="list-comments-${item.id}">
          <div class="comments-loading">Loading comments...</div>
        </div>
      </div>
    </div>
  `;
}

// Setup reaction buttons for feed items
function setupFeedItemActions() {
  // Setup emoji reactions: 🔥 💀 💔 😂
  document.querySelectorAll('.reaction-item').forEach(btn => {
    btn.addEventListener('click', function() {
      const itemId = this.closest('.feed-item').dataset.itemId;
      const reactionType = this.dataset.reaction;
      toggleReaction(itemId, reactionType, this);
    });
  });
  
  document.querySelectorAll('.comment-action').forEach(btn => {
    btn.addEventListener('click', function() {
      const itemId = this.closest('.feed-item').dataset.itemId;
      // Comments are now always visible, just focus on the input
      const commentInput = document.getElementById(`comment-input-${itemId}`);
      if (commentInput) {
        commentInput.focus();
        commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
  
  document.querySelectorAll('.share-action').forEach(btn => {
    btn.addEventListener('click', function() {
      const itemId = this.closest('.feed-item').dataset.itemId;
      shareItem(itemId);
    });
  });
  
  // Auto-load comments for all feed items (since they're now visible by default)
  document.querySelectorAll('.feed-item').forEach(feedItem => {
    const itemId = feedItem.dataset.itemId;
    if (itemId) {
      loadComments(itemId);
    }
  });
}

// Toggle reaction on feed item (🔥 💀 💔 😂)
function toggleReaction(itemId, reactionType, buttonElement) {
  const reactionCountSpan = buttonElement.querySelector('.reaction-count');
  const currentCount = parseInt(reactionCountSpan.textContent) || 0;
  const isReacted = buttonElement.classList.contains('reacted');
  
  const reactionEmojis = {
    fire: '🔥',
    skull: '💀', 
    heartbreak: '💔',
    laugh: '😂'
  };
  
  if (isReacted) {
    reactionCountSpan.textContent = Math.max(0, currentCount - 1);
    buttonElement.classList.remove('reacted');
    console.log(`Removed ${reactionEmojis[reactionType]} reaction from item ${itemId}`);
    showToast(`Removed ${reactionEmojis[reactionType]} reaction`, 'info');
  } else {
    reactionCountSpan.textContent = currentCount + 1;
    buttonElement.classList.add('reacted');
    console.log(`Added ${reactionEmojis[reactionType]} reaction to item ${itemId}`);
    showToast(`Reacted with ${reactionEmojis[reactionType]}`, 'success');
  }
  
  // TODO: Save to Firebase in production - track reactions by user and post
  // This would save to a reactions collection with: { postId, userId, reactionType, timestamp }
}

// Show/hide comments section
function showComments(itemId) {
  const commentSection = document.getElementById(`comments-${itemId}`);
  const commentsList = document.getElementById(`comments-list-${itemId}`);
  
  if (!commentSection) {
    console.error('Comment section not found for item:', itemId);
    return;
  }
  
  if (commentSection.style.display === 'none') {
    // Show comments
    commentSection.style.display = 'block';
    document.getElementById(`comment-input-${itemId}`)?.focus();
    
    // Load comments for this post
    loadComments(itemId);
    
    console.log('Showing comments for item:', itemId);
  } else {
    // Hide comments
    hideComments(itemId);
  }
}

// Hide comments section
function hideComments(itemId) {
  const commentSection = document.getElementById(`comments-${itemId}`);
  if (commentSection) {
    commentSection.style.display = 'none';
    // Clear comment input
    const commentInput = document.getElementById(`comment-input-${itemId}`);
    if (commentInput) commentInput.value = '';
    console.log('Hiding comments for item:', itemId);
  }
}

// Share item (placeholder)
function shareItem(itemId) {
  const item = feedItems.find(item => item.id === itemId);
  if (item) {
    if (navigator.share) {
      navigator.share({
        title: 'Unhinged World',
        text: item.content,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(`Check this out: ${item.content} - Unhinged World`);
      showToast('Copied to clipboard!', 'success');
    }
  }
}

// Get feed type badge
function getFeedTypeBadge(type) {
  const badges = {
    'user_post': 'POST',
    'event_update': 'EVENT',
    'system_update': 'SYSTEM',
    'announcement': 'NEWS'
  };
  return badges[type] || 'POST';
}

// Get tag emoji
function getTagEmoji(tag) {
  const emojis = {
    'confession': '🙊',
    'tea': '🍵',
    'flex': '💪',
    'chaos': '💔',
    'dating': '💕',
    'gaming': '🎮',
    'event': '🎉'
  };
  return emojis[tag] || '🏷️';
}

// Get time ago string
function getTimeAgo(timestamp) {
  const now = new Date();
  const time = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return time.toLocaleDateString();
}

// Show world pulse with real Firebase stats
async function showWorldPulse() {
  // Fetching real-time World Pulse data for feed
  
  const pulseData = {
    totalUsers: 0,
    activeEvents: 0,
    hottestTopic: 'Building community',
    mood: '✨ Growing'
  };
  
  try {
    // Get real online users count
    const presenceSnapshot = await getDocs(collection(db, 'presence'));
    pulseData.totalUsers = presenceSnapshot.size || 1;
    
    // Get real active events count
    const eventsQuery = query(collection(db, 'stages_events'), where('status', '==', 'live'));
    const eventsSnapshot = await getDocs(eventsQuery);
    pulseData.activeEvents = eventsSnapshot.size || 0;
    
    // Analyze recent posts for trending topics
    const postsQuery = query(
      collection(db, 'world_feed'), 
      orderBy('timestamp', 'desc'), 
      limit(20)
    );
    const postsSnapshot = await getDocs(postsQuery);
    
    const topics = {};
    postsSnapshot.forEach(doc => {
      const post = doc.data();
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach(tag => {
          topics[tag] = (topics[tag] || 0) + 1;
        });
      }
    });
    
    // Find most popular topic
    const sortedTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]);
    if (sortedTopics.length > 0) {
      pulseData.hottestTopic = `#${sortedTopics[0][0]} trending`;
    }
    
    // Determine mood based on activity
    if (pulseData.totalUsers > 10) {
      pulseData.mood = '🔥 Buzzing';
    } else if (pulseData.totalUsers > 5) {
      pulseData.mood = '💕 Cozy';
    } else {
      pulseData.mood = '🌱 Growing';
    }
    
    // Real-time pulse data fetched successfully
    
  } catch (error) {
    console.error('❌ Error fetching world pulse data:', error);
    // Use fallback message
    showToast('Unable to fetch live stats right now. Try again later!', 'warning');
    return;
  }
  
  showToast(`World Pulse: ${pulseData.totalUsers} online, ${pulseData.activeEvents} live events, mood is ${pulseData.mood}`, 'info');
}

// Load more feed items
async function loadMoreFeed() {
  if (isLoadingFeed) return;
  isLoadingFeed = true;
  
  // In production, this would load more from Firebase
  // For demo, we'll just show a message
  showToast('Loading more stories...', 'info');
  
  setTimeout(() => {
    showToast('You\'re all caught up! Check back later for more updates.', 'success');
    isLoadingFeed = false;
  }, 1000);
}

// Update loading state
function updateLoadingState(isLoading) {
  const loadingState = document.getElementById('loading-state');
  const feedContent = document.getElementById('feed-items');
  
  if (loadingState) {
    loadingState.style.display = isLoading ? 'block' : 'none';
  }
}

// Setup real-time Firebase statistics for feed page
function setupFeedRealTimeStats() {
  console.log('📊 Setting up real-time feed statistics...');
  
  try {
    // Real-time presence tracking for feed page
    const presenceUnsubscribe = onSnapshot(collection(db, 'presence'), (snapshot) => {
      const activeUsers = snapshot.size || 0;
      console.log('📊 Feed: Real-time presence update:', activeUsers, 'users online');
      const activeUsersEl = document.getElementById('active-users-count');
      if (activeUsersEl) activeUsersEl.textContent = `${activeUsers} online`;
    }, (error) => {
      console.warn('⚠️ Feed presence listener error:', error);
      const activeUsersEl = document.getElementById('active-users-count');
      if (activeUsersEl) activeUsersEl.textContent = '0 online';
    });

    // Real-time live events tracking
    const eventsUnsubscribe = onSnapshot(collection(db, 'stages_events'), (snapshot) => {
      const liveEvents = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data && (data.status === 'live' || data.isActive === true);
      }).length;
      console.log('📊 Feed: Real-time events update:', liveEvents, 'live events');
      const liveEventsEl = document.getElementById('live-events-count');
      if (liveEventsEl) liveEventsEl.textContent = `${liveEvents} live events`;
    }, (error) => {
      console.warn('⚠️ Feed events listener error:', error);
      const liveEventsEl = document.getElementById('live-events-count');
      if (liveEventsEl) liveEventsEl.textContent = '0 live events';
    });

    // Real-time recent activity tracking (posts in last hour)
    const activityUnsubscribe = onSnapshot(collection(db, 'world_feed'), (snapshot) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentPosts = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data && data.timestamp && data.timestamp.toDate() >= oneHourAgo;
      }).length;
      console.log('📊 Feed: Real-time activity update:', recentPosts, 'recent posts');
      const recentActivityEl = document.getElementById('recent-activity-count');
      if (recentActivityEl) recentActivityEl.textContent = `${recentPosts} new updates`;
    }, (error) => {
      console.warn('⚠️ Feed activity listener error:', error);
      const recentActivityEl = document.getElementById('recent-activity-count');
      if (recentActivityEl) recentActivityEl.textContent = '0 new updates';
    });

    // Store unsubscribe functions for cleanup
    activeListeners.feedStatsPresence = presenceUnsubscribe;
    activeListeners.feedStatsEvents = eventsUnsubscribe;
    activeListeners.feedStatsActivity = activityUnsubscribe;
    
    console.log('✅ Feed real-time statistics listeners active');
    
  } catch (error) {
    console.error('❌ Error setting up feed real-time stats:', error);
    // Fallback to show zeros
    updateFeedStatsDisplay(0, 0, 0);
  }
}

// Update feed stats display with fallback values
function updateFeedStatsDisplay(activeUsers, liveEvents, recentActivity) {
  const activeUsersEl = document.getElementById('active-users-count');
  const liveEventsEl = document.getElementById('live-events-count');
  const recentActivityEl = document.getElementById('recent-activity-count');
  
  if (activeUsersEl) activeUsersEl.textContent = `${activeUsers} online`;
  if (liveEventsEl) liveEventsEl.textContent = `${liveEvents} live events`;
  if (recentActivityEl) recentActivityEl.textContent = `${recentActivity} new updates`;
}

// Initial stats load - sets up baseline data
async function updateLiveStats() {
  console.log('📊 Loading initial live stats...');
  
  try {
    // Update events and activity initially
    await updateLiveEventsAndActivity();
    
    // For presence, we now rely on the real-time listener
    // But we'll do one initial check to set a baseline
    const presenceSnapshot = await getDocs(collection(db, 'presence'));
    const activeUsers = presenceSnapshot.size;
    
    // Update display with initial presence count
    updateOnlineUsersDisplay(activeUsers);
    
    console.log(`📊 Initial stats loaded: ${activeUsers} users online`);
    
  } catch (error) {
    console.error('❌ Error fetching initial live stats:', error);
    // Use minimal fallback values
    updateOnlineUsersDisplay(1);
  }
}

// Submit comment to Firebase
async function submitComment(itemId) {
  const commentInput = document.getElementById(`comment-input-${itemId}`);
  const submitBtn = document.querySelector(`[data-testid="button-submit-comment-${itemId}"]`);
  const content = commentInput?.value?.trim();
  
  if (!content) {
    showToast('Please write something before commenting!', 'error');
    return;
  }
  
  if (!currentUser) {
    showToast('You must be logged in to comment', 'error');
    return;
  }
  
  // Disable submit button during submission
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
  }
  
  try {
    // Enhanced authentication verification
    const user = await waitForAuthState();
    if (!user) {
      showToast('Authentication required. Please log in.', 'error');
      return;
    }
    
    // Create comment data
    const commentData = {
      postId: itemId,
      uid: user.uid,
      author: {
        uid: user.uid,
        name: String(currentUser.name),
        avatar: String(currentUser.avatar)
      },
      content: String(content),
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp()
    };
    
    console.log('💬 Creating comment:', {
      postId: itemId,
      author: commentData.author.name,
      content: content.substring(0, 50) + '...'
    });
    
    // Save comment to Firebase
    const commentsRef = collection(db, 'world_feed', itemId, 'comments');
    await addDoc(commentsRef, commentData);
    
    // Get post data to notify the author
    try {
      const postRef = doc(db, 'world_feed', itemId);
      const postSnap = await getDoc(postRef);
      
      if (postSnap.exists()) {
        const postData = postSnap.data();
        const postAuthorUid = postData.uid || postData.author?.uid;
        
        // Only notify if someone else commented (not the author commenting on their own post)
        if (postAuthorUid && postAuthorUid !== user.uid) {
          await sendCommentNotification(postAuthorUid, currentUser, itemId, content);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not send notification:', error);
    }
    
    // Update comment count on the post
    await updateCommentCount(itemId, 1);
    
    // Clear input and show success
    commentInput.value = '';
    showToast('Comment posted!', 'success');
    
    console.log('✅ Comment posted successfully');
    
  } catch (error) {
    console.error('❌ Error posting comment:', error);
    showToast('Failed to post comment. Please try again.', 'error');
  } finally {
    // Re-enable submit button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Comment';
    }
  }
}

// Send notification to post author when someone comments
async function sendCommentNotification(postAuthorUid, commenter, postId, commentContent) {
  try {
    console.log('📧 Sending comment notification to:', postAuthorUid);
    
    // Create notification document
    const notificationData = {
      type: 'comment',
      recipientUid: postAuthorUid,
      senderUid: commenter.uid,
      senderName: commenter.name,
      senderAvatar: commenter.avatar,
      postId: postId,
      commentContent: commentContent.length > 100 ? commentContent.substring(0, 100) + '...' : commentContent,
      message: `${commenter.name} commented on your status`,
      timestamp: serverTimestamp(),
      read: false,
      createdAt: serverTimestamp()
    };
    
    // Save notification to Firebase
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, notificationData);
    
    // Show a toast notification if the post author is currently viewing the feed
    showToast(`${commenter.name} commented on your status`, 'info');
    
    console.log('✅ Comment notification sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending comment notification:', error);
  }
}

// Load comments for a specific post
async function loadComments(itemId) {
  const commentsList = document.getElementById(`comments-list-${itemId}`);
  if (!commentsList) return;
  
  try {
    // Setup comments listener
    
    // Clean up previous comment listener for this post if it exists
    if (activeListeners.comments.has(itemId)) {
      console.log(`🧹 Cleaning up previous comment listener for post ${itemId}`);
      const unsubscribe = activeListeners.comments.get(itemId);
      unsubscribe();
      activeListeners.comments.delete(itemId);
    }
    
    // Set up real-time listener for comments
    const commentsRef = collection(db, 'world_feed', itemId, 'comments');
    const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
    
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      const comments = [];
      snapshot.forEach((doc) => {
        comments.push({ id: doc.id, ...doc.data() });
      });
      
      if (comments.length === 0) {
        commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
      } else {
        commentsList.innerHTML = comments.map(comment => createCommentHTML(comment)).join('');
      }
      
      // Update the comment count display immediately
      const commentCountElement = document.querySelector(`[data-testid="button-comment-${itemId}"] .comment-count`);
      if (commentCountElement) {
        commentCountElement.textContent = comments.length;
      }
      
      console.log(`✅ Loaded ${comments.length} comments for post ${itemId}`);
    }, (error) => {
      console.error('❌ Error loading comments:', error);
      commentsList.innerHTML = '<div class="comments-error">Unable to load comments</div>';
    });
    
    // Store the unsubscribe function for this post's comments
    activeListeners.comments.set(itemId, unsubscribeComments);
    
  } catch (error) {
    console.error('❌ Error setting up comment listener:', error);
    commentsList.innerHTML = '<div class="comments-error">Unable to load comments</div>';
  }
}

// Create HTML for individual comment
function createCommentHTML(comment) {
  const timeAgo = getTimeAgo(comment.timestamp);
  
  return `
    <div class="comment-item" data-comment-id="${comment.id}" data-testid="comment-${comment.id}">
      <img class="comment-avatar" src="${comment.author?.avatar || (window.AvatarUtils ? window.AvatarUtils.generateUniqueAvatar(comment.author?.uid || 'anonymous') : generateDefaultAvatar())}" alt="${escapeHtml(comment.author?.name || 'User')}">
      <div class="comment-content">
        <div class="comment-header">
          <span class="comment-author" data-testid="text-comment-author-${comment.id}">${escapeHtml(comment.author?.name || 'Anonymous')}</span>
          <span class="comment-time" data-testid="text-comment-time-${comment.id}">${timeAgo}</span>
          ${currentUser && comment.author?.uid === currentUser.uid ? `
            <button class="delete-comment-btn" onclick="deleteComment('${comment.postId}', '${comment.id}')" data-testid="button-delete-comment-${comment.id}" title="Delete your comment">
              🗑️
            </button>
          ` : ''}
        </div>
        <div class="comment-text" data-testid="text-comment-content-${comment.id}">${escapeHtml(comment.content)}</div>
      </div>
    </div>
  `;
}

// Update comment count for a post
async function updateCommentCount(itemId, increment) {
  try {
    // Update the local comment count immediately
    const commentCountElement = document.querySelector(`[data-testid="button-comment-${itemId}"] .comment-count`);
    if (commentCountElement) {
      const currentCount = parseInt(commentCountElement.textContent) || 0;
      commentCountElement.textContent = Math.max(0, currentCount + increment);
    }
    
    // Note: In a full implementation, you'd also update the Firestore document
    // For now, the count is updated locally and will sync on page reload
    console.log(`Updated comment count for post ${itemId} by ${increment}`);
    
  } catch (error) {
    console.error('❌ Error updating comment count:', error);
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  
  // Create toast container if it doesn't exist
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      pointer-events: none;
    `;
    safeAppendChild(document.body, toastContainer, 'feed toast container');
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    background: ${type === 'error' ? '#E11D2A' : type === 'success' ? '#28a745' : '#17a2b8'};
    color: white;
    padding: 12px 16px;
    margin-bottom: 8px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
  `;
  
  safeAppendChild(toastContainer, toast, 'feed toast message');
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

// Delete post function
async function deletePost(postId) {
  if (!currentUser || !postId) {
    showToast('Unable to delete post', 'error');
    return;
  }

  // Confirm deletion
  if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
    return;
  }

  try {
    const user = await waitForAuthState();
    if (!user) {
      showToast('You must be logged in to delete posts', 'error');
      return;
    }

    // Get the post to verify ownership
    const postRef = doc(db, 'world_feed', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      showToast('Post not found', 'error');
      return;
    }

    const postData = postDoc.data();
    
    // Verify ownership
    if (postData.author?.uid !== user.uid) {
      showToast('You can only delete your own posts', 'error');
      return;
    }

    // Delete the post
    await deleteDoc(postRef);
    
    // Also delete associated comments collection
    try {
      const commentsRef = collection(db, 'world_feed', postId, 'comments');
      const commentsSnapshot = await getDocs(commentsRef);
      
      const deletePromises = commentsSnapshot.docs.map(commentDoc => 
        deleteDoc(commentDoc.ref)
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.warn('⚠️ Error deleting comments (post still deleted):', error);
    }

    showToast('Post deleted successfully', 'success');
    
    // Remove from local feed items array
    feedItems = feedItems.filter(item => item.id !== postId);
    renderFeedItems();
    
    console.log('🗑️ Post deleted successfully:', postId);
    
  } catch (error) {
    console.error('❌ Error deleting post:', error);
    showToast('Error deleting post. Please try again.', 'error');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Delete comment function
async function deleteComment(postId, commentId) {
  if (!currentUser || !postId || !commentId) {
    showToast('Unable to delete comment', 'error');
    return;
  }

  try {
    // No bulky confirmation dialog - just delete immediately
    console.log(`🗑️ Deleting comment ${commentId} from post ${postId}`);
    
    const user = await waitForAuthState();
    if (!user) {
      showToast('You must be logged in to delete comments', 'error');
      return;
    }

    // Direct Firebase deletion without ownership verification (the UI already checked ownership)
    const commentRef = doc(db, 'world_feed', postId, 'comments', commentId);
    await deleteDoc(commentRef);
    
    showToast('Comment deleted', 'success');
    console.log('✅ Comment deleted from Firebase:', commentId);
    
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    showToast('Failed to delete comment', 'error');
  }
}

// Export functions to global scope for HTML onclick handlers
window.submitComment = submitComment;
window.hideComments = hideComments;
window.showComments = showComments;
window.deletePost = deletePost;
window.deleteComment = deleteComment;

// Refresh live stats periodically
// Removed old periodic stats update - now using real-time presence listener