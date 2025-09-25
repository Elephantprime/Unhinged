// Import Firebase authentication and database functionality
import { 
  auth, 
  db, 
  getUserDoc, 
  onAuthStateChanged,
  onSnapshot,
  serverTimestamp,
  waitForAuth,
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  userRef
} from '../js/firebase.js';

// Import points display utility
import { addPointsToNavigation } from '../js/points-display.js';

// World Hub JavaScript
let currentUser = null;

// Initialize World Hub
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🌍 World Hub initializing...');
  
  // Setup UI first
  setupHubNavigation();
  setupQuickActions();
  
  // Initialize points display
  addPointsToNavigation('.user-info', { position: 'prepend', size: 'medium' });
  
  // Wait for authentication state using centralized waitForAuth
  try {
    console.log('⏳ Waiting for authentication in World Hub...');
    const user = await waitForAuth();
    if (user) {
      console.log('✅ User authenticated in World Hub:', user.uid);
      await loadUserProfile(user);
      // Setup real-time statistics after authentication
      setupRealTimeStats();
      // Load active lounge tables
      await loadActiveLoungeTablesForHub();
    } else {
      console.log('❌ No user found in World Hub - redirecting to login');
      // Redirect to login
      window.location.href = '../login.html';
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
    console.error('❌ Firebase authentication failed - redirecting to login');
    window.location.href = '../login.html';
  }
});

// Note: waitForAuthState function removed - now using centralized waitForAuth from firebase.js

// Load user profile with consistent avatar handling
async function loadUserProfile(user) {
  try {
    // Get user document from Firestore (read-only)
    const userDoc = await getUserDoc(user.uid);
    
    // Use AvatarUtils for consistent avatar loading across sections
    if (typeof window.AvatarUtils?.buildUserObject === 'function') {
      currentUser = await window.AvatarUtils.buildUserObject(userDoc, user);
      // Ensure mood is preserved from Firestore document
      if (userDoc?.mood) {
        currentUser.mood = userDoc.mood;
        console.log('✅ Preserved user mood from Firestore via AvatarUtils:', currentUser.mood);
      }
    } else {
      // Improved fallback with better user identification
      const displayName = userDoc?.displayName || 
                         user.displayName || 
                         user.email?.split('@')[0] ||
                         `User${user.uid.substring(0, 8)}`;
      
      currentUser = {
        uid: user.uid,
        name: displayName,
        avatar: userDoc?.loungeAvatar || userDoc?.photoURL || user.photoURL || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="25" cy="20" r="10" fill="#2a2a2a"/><path d="M 10 40 Q 10 32 15 30 Q 20 25 25 25 Q 30 25 35 30 Q 40 32 40 40 L 40 50 L 10 50 Z" fill="#2a2a2a"/></svg>'),
        mood: userDoc?.mood || 'available'
      };
      console.log('✅ Loaded user mood from Firestore:', currentUser.mood);
    }
    
    updateUserDisplay();
    console.log('✅ World Hub loaded for authenticated user:', currentUser.name);
    console.log('✅ Avatar loaded:', currentUser.avatar.substring(0, 50) + '...');
  } catch (error) {
    console.error('❌ Error loading user profile:', error);
    setupFallbackUser(user);
  }
}

// Fallback user with better identification
function setupFallbackUser(user = null) {
  if (user) {
    // Create fallback from real user info
    currentUser = {
      uid: user.uid,
      name: user.displayName || user.email?.split('@')[0] || `User${user.uid.substring(0, 8)}`,
      avatar: user.photoURL || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="25" cy="20" r="10" fill="#2a2a2a"/><path d="M 10 40 Q 10 32 15 30 Q 20 25 25 25 Q 30 25 35 30 Q 40 32 40 40 L 40 50 L 10 50 Z" fill="#2a2a2a"/></svg>'),
      mood: 'available'
    };
    console.log('⚠️ Using fallback user profile for:', currentUser.name);
  } else {
    // Last resort anonymous user
    currentUser = {
      uid: 'anonymous_' + Date.now(),
      name: 'Anonymous User',
      avatar: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="25" cy="20" r="10" fill="#2a2a2a"/><path d="M 10 40 Q 10 32 15 30 Q 20 25 25 25 Q 30 25 35 30 Q 40 32 40 40 L 40 50 L 10 50 Z" fill="#2a2a2a"/></svg>'),
      mood: 'available'
    };
    console.log('⚠️ Using anonymous user - no authentication available');
  }
  updateUserDisplay();
}

// Update user display with consistent avatar handling
function updateUserDisplay() {
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const moodSelector = document.getElementById('mood-selector');
  
  // Use AvatarUtils for consistent avatar display
  if (userAvatar && currentUser?.avatar) {
    if (typeof window.AvatarUtils?.updateDisplay === 'function') {
      window.AvatarUtils.updateDisplay(currentUser.avatar, userAvatar);
    } else {
      userAvatar.src = currentUser.avatar;
    }
  }
  
  if (userName) userName.textContent = currentUser.name;
  if (moodSelector) moodSelector.value = currentUser.mood;
}

// Setup hub navigation
function setupHubNavigation() {
  // Handle legacy hub tiles (if any)
  document.querySelectorAll('.hub-tile').forEach(tile => {
    tile.addEventListener('click', function() {
      const destination = this.dataset.destination;
      navigateToSection(destination);
    });
  });
  
  // Handle new navigation tiles
  document.querySelectorAll('.nav-tile').forEach(tile => {
    tile.addEventListener('click', function() {
      const destination = this.dataset.destination;
      navigateToSection(destination);
    });
  });
  
  // Handle Town Square primary action button
  const enterFeedBtn = document.querySelector('[data-destination="feed"]');
  if (enterFeedBtn) {
    enterFeedBtn.addEventListener('click', function() {
      navigateToSection('feed');
    });
  }
  
  // Handle World Pulse button
  const worldPulseBtn = document.getElementById('quick-pulse-btn');
  if (worldPulseBtn) {
    worldPulseBtn.addEventListener('click', function() {
      showWorldPulse();
    });
  }
}

// Navigate to different sections
function navigateToSection(section) {
  console.log(`🚀 Navigating to ${section}...`);
  
  const routes = {
    feed: 'feed.html',
    lounge: 'lounge.html',
    arcade: 'arcade.html',
    stages: 'stages.html',
    districts: 'districts.html',
    passports: 'passports.html',
    spotlight: 'spotlight.html'
  };
  
  if (routes[section]) {
    window.location.href = routes[section];
  } else {
    console.warn(`❌ Section '${section}' not found`);
  }
}

// Setup quick actions
function setupQuickActions() {
  const dailyMissions = document.getElementById('daily-missions');
  const leaderboards = document.getElementById('leaderboards');
  const notifications = document.getElementById('notifications');
  const worldChat = document.getElementById('world-chat');
  
  if (dailyMissions) {
    dailyMissions.addEventListener('click', () => {
      showQuickModal('Daily Missions', 'Complete tasks to earn rewards and unlock new areas!');
    });
  }
  
  if (leaderboards) {
    leaderboards.addEventListener('click', () => {
      showQuickModal('Leaderboards', 'See who is leading in flirts, red flags, and game wins!');
    });
  }
  
  if (notifications) {
    notifications.addEventListener('click', () => {
      showQuickModal('Notifications', 'Check your stamps, mentions, and friend requests!');
    });
  }
  
  if (worldChat) {
    worldChat.addEventListener('click', () => {
      console.log('💬 Opening World Chat - redirecting to lounge...');
      window.location.href = 'lounge.html';
    });
  }
  
  // Mood selector
  const moodSelector = document.getElementById('mood-selector');
  if (moodSelector) {
    moodSelector.addEventListener('change', function() {
      updateUserMood(this.value);
    });
  }
}

// Update user mood with consistent saving
async function updateUserMood(newMood) {
  if (!currentUser) return;
  
  currentUser.mood = newMood;
  console.log(`😊 Mood updated to: ${newMood}`);
  
  // Save to Firebase if available
  if (typeof setDoc !== 'undefined' && currentUser.uid !== 'demo') {
    try {
      await setDoc(userRef(currentUser.uid), { mood: newMood }, { merge: true });
      console.log('✅ Mood saved to profile');
      
      // Also save avatar to maintain consistency if it has changed
      if (currentUser.avatar && typeof window.AvatarUtils?.saveAvatar === 'function') {
        await window.AvatarUtils.saveAvatar(currentUser.avatar, currentUser.uid);
      }
    } catch (error) {
      console.error('❌ Error saving mood:', error);
    }
  }
}

// Quick modal for actions
function showQuickModal(title, content) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  modal.innerHTML = `
    <div style="
      background: #2c2c2c;
      border-radius: 15px;
      padding: 30px;
      max-width: 400px;
      width: 90%;
      text-align: center;
    ">
      <h3 style="color: #ff4081; margin-bottom: 15px;">${title}</h3>
      <p style="color: #eee; margin-bottom: 20px;">${content}</p>
      <button onclick="this.closest('.modal-overlay').remove()" style="
        background: #ff4081;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 20px;
        cursor: pointer;
      ">Got it!</button>
    </div>
  `;
  
  modal.className = 'modal-overlay';
  document.body.appendChild(modal);
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Real-time statistics tracking
let statsListeners = {
  presence: null,
  posts: null,
  events: null
};

// Setup real-time Firebase statistics listeners
function setupRealTimeStats() {
  console.log('📊 Setting up real-time Firebase statistics listeners...');
  
  // First, establish our own presence in the World Hub
  setupWorldHubPresence();
  
  try {
    // Real-time presence tracking
    if (statsListeners.presence) statsListeners.presence();
    statsListeners.presence = onSnapshot(collection(db, 'presence'), (snapshot) => {
      const activeUsers = snapshot.size || 0;
      console.log('📊 Real-time presence update:', activeUsers, 'users online');
      updateActiveUsersDisplay(activeUsers);
    }, (error) => {
      console.warn('⚠️ Presence listener error:', error);
      updateActiveUsersDisplay('...');
    });

    // Real-time posts tracking  
    if (statsListeners.posts) statsListeners.posts();
    statsListeners.posts = onSnapshot(collection(db, 'world_feed'), (snapshot) => {
      const hotPosts = snapshot.size || 0;
      console.log('📊 Real-time posts update:', hotPosts, 'total posts');
      updateHotPostsDisplay(hotPosts);
    }, (error) => {
      console.warn('⚠️ Posts listener error:', error);
      updateHotPostsDisplay('...');
    });

    // Real-time events tracking with live filter
    if (statsListeners.events) statsListeners.events();
    statsListeners.events = onSnapshot(collection(db, 'stages_events'), (snapshot) => {
      const liveEvents = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data && (data.status === 'live' || data.isActive === true);
      }).length;
      console.log('📊 Real-time events update:', liveEvents, 'live events');
      updateLiveEventsDisplay(liveEvents);
    }, (error) => {
      console.warn('⚠️ Events listener error:', error);
      updateLiveEventsDisplay('...');
    });

    console.log('✅ Real-time statistics listeners active');
    
    // Update activity preview initially
    updateActivityPreview();
  } catch (error) {
    console.error('❌ Error setting up real-time stats:', error);
    // Fallback to one-time fetch
    updateStatsOnce();
  }
}

// Update active users display
function updateActiveUsersDisplay(count) {
  const activeUsersHero = document.getElementById('active-users-hero');
  const loungeUsers = document.getElementById('lounge-users');
  
  if (activeUsersHero) activeUsersHero.textContent = count;
  if (loungeUsers) loungeUsers.textContent = `${count} online`;
}

// Update hot posts display
function updateHotPostsDisplay(count) {
  const hotPostsHero = document.getElementById('hot-posts-hero');
  
  if (hotPostsHero) hotPostsHero.textContent = count;
}

// Update live events display
function updateLiveEventsDisplay(count) {
  const liveEventsHero = document.getElementById('live-events-hero');
  
  if (liveEventsHero) liveEventsHero.textContent = count;
}

// Fallback: One-time stats update (if real-time fails)
async function updateStatsOnce() {
  console.log('📊 Fallback: One-time Firebase stats fetch...');
  
  try {
    // Get presence count
    const presenceSnapshot = await getDocs(collection(db, 'presence'));
    updateActiveUsersDisplay(presenceSnapshot.size || 0);

    // Get posts count
    const postsSnapshot = await getDocs(collection(db, 'world_feed'));
    updateHotPostsDisplay(postsSnapshot.size || 0);

    // Get live events count
    const eventsSnapshot = await getDocs(collection(db, 'stages_events'));
    const liveEvents = eventsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data && (data.status === 'live' || data.isActive === true);
    }).length;
    updateLiveEventsDisplay(liveEvents);
    
    console.log('✅ One-time stats updated successfully');
  } catch (error) {
    console.error('❌ Error in fallback stats update:', error);
    updateActiveUsersDisplay('0');
    updateHotPostsDisplay('0');
    updateLiveEventsDisplay('0');
  }
}

// World Hub presence tracking
let worldHubPresence = null;
let presenceHeartbeat = null;

// Setup presence tracking for World Hub
async function setupWorldHubPresence() {
  if (!currentUser?.uid) {
    console.warn('⚠️ No current user for World Hub presence tracking');
    return;
  }
  
  console.log('📡 Setting up World Hub presence tracking for:', currentUser.uid);
  
  try {
    // Write user presence to Firebase
    await updateWorldHubPresence();
    
    // Set up presence heartbeat (update every 30 seconds)
    presenceHeartbeat = setInterval(updateWorldHubPresence, 30000);
    
    console.log('✅ World Hub presence tracking active');
  } catch (error) {
    console.error('❌ Error setting up World Hub presence tracking:', error);
  }
}

// Update user presence in Firebase for World Hub
async function updateWorldHubPresence() {
  if (!currentUser?.uid || !db) return;
  
  try {
    const presenceData = {
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      location: 'world_hub',
      mood: currentUser.mood || 'available',
      timestamp: serverTimestamp()
    };
    
    await setDoc(doc(db, 'presence', currentUser.uid), presenceData);
    worldHubPresence = presenceData;
    
    console.log('✅ World Hub presence updated');
  } catch (error) {
    console.error('❌ Error updating World Hub presence:', error);
  }
}

// Remove user presence from Firebase
async function removeWorldHubPresence() {
  if (!currentUser?.uid || !db) return;
  
  try {
    await deleteDoc(doc(db, 'presence', currentUser.uid));
    worldHubPresence = null;
    console.log('🚪 User presence removed from World Hub');
  } catch (error) {
    console.error('❌ Error removing World Hub presence:', error);
  }
}

// Cleanup stats listeners
function cleanupStatsListeners() {
  console.log('🧹 Cleaning up stats listeners');
  
  // Stop presence heartbeat
  if (presenceHeartbeat) {
    clearInterval(presenceHeartbeat);
    presenceHeartbeat = null;
  }
  
  // Remove user presence from Firebase
  removeWorldHubPresence();
  
  Object.values(statsListeners).forEach(unsubscribe => {
    if (unsubscribe && typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });
  statsListeners = { presence: null, posts: null, events: null };
}

// Update activity preview with real Firebase data
async function updateActivityPreview() {
  const activityPreview = document.getElementById('activity-preview');
  if (!activityPreview) return;
  
  try {

    const activities = [];
    
    // Get recent posts from world_feed
    try {
      const feedQuery = query(collection(db, 'world_feed'), orderBy('timestamp', 'desc'), limit(5));
      const feedSnapshot = await getDocs(feedQuery);
      
      feedSnapshot.forEach((doc) => {
        const post = doc.data();
        if (post.author && post.content) {
          const timeAgo = getTimeAgo(post.timestamp);
          activities.push({
            icon: getActivityIcon(post.type, post.tags),
            text: `${post.author.name || 'Someone'} ${getActivityVerb(post.type)} in Town Square`,
            time: timeAgo,
            priority: 1
          });
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not fetch feed data:', error);
    }

    // Get live events
    try {
      const eventsQuery = query(collection(db, 'stages_events'), where('status', '==', 'live'));
      const eventsSnapshot = await getDocs(eventsQuery);
      
      eventsSnapshot.forEach((doc) => {
        const event = doc.data();
        activities.push({
          icon: '🎤',
          text: `${event.title || 'Live event'} is happening now with ${event.participantCount || 0} people`,
          time: 'Live',
          priority: 2
        });
      });
    } catch (error) {
      console.warn('⚠️ Could not fetch events data:', error);
    }

    // Get recent lounge activity
    try {
      const loungeQuery = query(collection(db, 'lounge_tables'), orderBy('lastActivity', 'desc'), limit(3));
      const loungeSnapshot = await getDocs(loungeQuery);
      
      loungeSnapshot.forEach((doc) => {
        const table = doc.data();
        if (table.participants && table.participants.length > 0) {
          activities.push({
            icon: '💬',
            text: `${table.participants.length} people are chatting at ${table.tableName || 'a table'}`,
            time: getTimeAgo(table.lastActivity),
            priority: 3
          });
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not fetch lounge data:', error);
    }

    // If no real activities found, show empty state
    if (activities.length === 0) {
      showEmptyActivityState();
      return;
    }
    
    // Sort by priority and recency, take top 3
    const selectedActivities = activities
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
    
    activityPreview.innerHTML = selectedActivities.map(activity => `
      <div class="activity-item">
        <span class="activity-icon">${activity.icon}</span>
        <span class="activity-text">${activity.text}</span>
        <span class="activity-time">${activity.time}</span>
      </div>
    `).join('');
    
    console.log('✅ Activity preview updated with real data');
    
  } catch (error) {
    console.error('❌ Error updating activity preview:', error);
    showEmptyActivityState();
  }
}

// Show empty state when no real activities are available
function showEmptyActivityState() {
  const activityPreview = document.getElementById('activity-preview');
  if (!activityPreview) return;
  
  activityPreview.innerHTML = `
    <div class="activity-item empty-state">
      <span class="activity-icon">💫</span>
      <span class="activity-text">No recent activity yet. Be the first to post!</span>
      <span class="activity-time">Now</span>
    </div>
  `;
}

// Get appropriate icon based on activity type
function getActivityIcon(type, tags = []) {
  if (tags.includes('love') || tags.includes('dating')) return '💕';
  if (tags.includes('gaming') || tags.includes('arcade')) return '🎮';
  if (tags.includes('confession')) return '🤫';
  if (type === 'event_update') return '🎤';
  return '💬';
}

// Get activity verb based on type
function getActivityVerb(type) {
  switch (type) {
    case 'user_post': return 'shared something';
    case 'event_update': return 'started an event';
    case 'confession': return 'confessed';
    default: return 'posted';
  }
}

// Calculate time ago from Firebase timestamp
function getTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  
  try {
    const now = Date.now();
    const then = timestamp.toDate ? timestamp.toDate().getTime() : timestamp;
    const diff = Math.floor((now - then) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch (error) {
    return 'Recently';
  }
}

// Show world pulse with real Firebase stats
async function showWorldPulse() {
  console.log('📊 Fetching real-time World Pulse data...');
  
  const pulseData = {
    totalUsers: 0,
    activeEvents: 0,
    recentPosts: 0,
    topDistrict: 'Town Square',
    hottestTopic: 'Getting to know each other',
    mood: '✨ Building'
  };
  
  try {
    
    // Get real online users count
    try {
      const presenceSnapshot = await getDocs(collection(db, 'presence'));
      pulseData.totalUsers = presenceSnapshot.size || 1;
    } catch (error) {
      console.warn('⚠️ Could not fetch presence data:', error);
      pulseData.totalUsers = 'Loading...';
    }
    
    // Get real active events count
    try {
      const eventsQuery = query(collection(db, 'stages_events'), where('status', '==', 'live'));
      const eventsSnapshot = await getDocs(eventsQuery);
      pulseData.activeEvents = eventsSnapshot.size || 0;
    } catch (error) {
      console.warn('⚠️ Could not fetch events data:', error);
      pulseData.activeEvents = 'Loading...';
    }
    
    // Get recent posts count (last 24 hours)
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const postsQuery = query(
        collection(db, 'world_feed'), 
        where('timestamp', '>=', oneDayAgo),
        orderBy('timestamp', 'desc')
      );
      const postsSnapshot = await getDocs(postsQuery);
      pulseData.recentPosts = postsSnapshot.size || 0;
      
      // Analyze posts to find hottest topic
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
        pulseData.hottestTopic = `#${sortedTopics[0][0]} (${sortedTopics[0][1]} posts)`;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch posts data:', error);
      pulseData.recentPosts = 'Loading...';
    }
    
    // Get most active district
    try {
      const districtsData = await Promise.all([
        getDocs(collection(db, 'world_feed')),
        getDocs(collection(db, 'lounge_tables')),
        getDocs(collection(db, 'stages_events'))
      ]);
      
      const activity = {
        'Town Square': districtsData[0].size,
        'Lounge': districtsData[1].size,
        'Stages': districtsData[2].size
      };
      
      const mostActive = Object.entries(activity).sort((a, b) => b[1] - a[1])[0];
      pulseData.topDistrict = `${mostActive[0]} (${mostActive[1]} active)`;
    } catch (error) {
      console.warn('⚠️ Could not fetch district data:', error);
    }
    
    // Determine overall mood based on activity
    if (pulseData.totalUsers > 10) {
      pulseData.mood = '🔥 Buzzing';
    } else if (pulseData.totalUsers > 5) {
      pulseData.mood = '💕 Cozy';
    } else if (pulseData.totalUsers > 0) {
      pulseData.mood = '🌱 Growing';
    }
    
    console.log('✅ Real-time pulse data:', pulseData);
    
  } catch (error) {
    console.error('❌ Error fetching world pulse data:', error);
    // Keep loading states for failed fetches
  }
  
  showQuickModal(
    '💗 World Pulse', 
    `<strong>Live Stats:</strong><br>
    👥 ${pulseData.totalUsers} users online<br>
    🎤 ${pulseData.activeEvents} live events<br>
    💬 ${pulseData.recentPosts} recent posts<br>
    🏆 Hottest: ${pulseData.topDistrict}<br>
    🔥 Trending: ${pulseData.hottestTopic}<br>
    😊 Mood: ${pulseData.mood}`
  );
}

// Load active lounge tables for World Hub display
async function loadActiveLoungeTablesForHub() {
  console.log('🏠 Loading active lounge tables for World Hub...');
  
  const loadingState = document.getElementById('lounge-loading');
  const emptyState = document.getElementById('lounge-empty');
  const tablesGrid = document.getElementById('lounge-tables-grid');
  
  // Show loading state initially
  if (loadingState) loadingState.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';
  if (tablesGrid) tablesGrid.innerHTML = '';
  
  try {
    // Query active lounge tables (those with participants and recent activity)
    const tablesQuery = query(
      collection(db, 'lounge_tables'), 
      orderBy('lastActivity', 'desc'), 
      limit(6) // Show up to 6 active tables
    );
    
    const tablesSnapshot = await getDocs(tablesQuery);
    const activeTables = [];
    
    tablesSnapshot.forEach((doc) => {
      const table = doc.data();
      // Only include tables that have participants and are active
      if (table.participants && table.participants.length > 0) {
        activeTables.push({
          id: doc.id,
          ...table
        });
      }
    });
    
    // Hide loading state
    if (loadingState) loadingState.style.display = 'none';
    
    if (activeTables.length === 0) {
      // Show empty state
      if (emptyState) emptyState.style.display = 'block';
      console.log('🏠 No active lounge tables found');
      return;
    }
    
    // Display active tables
    if (tablesGrid) {
      tablesGrid.innerHTML = activeTables.map(table => createTableCard(table)).join('');
      
      // Add click handlers to table cards
      tablesGrid.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', function() {
          const tableId = this.dataset.tableId;
          console.log('🏠 Joining table:', tableId);
          // Navigate to lounge with table focus
          window.location.href = `lounge.html?table=${tableId}`;
        });
      });
    }
    
    console.log('✅ Loaded', activeTables.length, 'active lounge tables');
    
  } catch (error) {
    console.error('❌ Error loading lounge tables:', error);
    // Hide loading, show empty state
    if (loadingState) loadingState.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = '<span>Unable to load tables right now. Try refreshing!</span>';
    }
  }
}

// Create HTML card for a lounge table
function createTableCard(table) {
  const participantCount = table.participants ? table.participants.length : 0;
  const maxParticipants = table.maxParticipants || 8;
  const tableName = table.tableName || `Table ${table.tableNumber || '?'}`;
  const lastActive = getTimeAgo(table.lastActivity);
  
  // Get table mood/theme icon
  const tableIcon = getTableIcon(table.mood || table.theme);
  
  // Determine if table is nearly full
  const isNearlyFull = participantCount >= maxParticipants - 1;
  const isFull = participantCount >= maxParticipants;
  
  return `
    <div class="table-card" data-table-id="${table.id}" data-testid="table-card-${table.id}">
      <div class="table-icon">${tableIcon}</div>
      <div class="table-info">
        <h4 class="table-name">${tableName}</h4>
        <p class="table-participants">
          ${participantCount}/${maxParticipants} ${participantCount === 1 ? 'person' : 'people'}
          ${isFull ? ' (Full)' : isNearlyFull ? ' (Almost Full)' : ''}
        </p>
        <p class="table-activity">Active ${lastActive}</p>
      </div>
      <div class="table-status ${isFull ? 'full' : isNearlyFull ? 'nearly-full' : 'available'}">
        ${isFull ? '🔒' : '🟢'}
      </div>
    </div>
  `;
}

// Get appropriate icon for table mood/theme
function getTableIcon(mood) {
  const icons = {
    'chill': '😎',
    'flirty': '😘',
    'drama': '🎭',
    'gaming': '🎮',
    'deep': '🤔',
    'party': '🎉',
    'default': '💬'
  };
  return icons[mood] || icons.default;
}

// Export functions for global access
window.showWorldPulse = showWorldPulse;
window.navigateToSection = navigateToSection;
window.updateUserMood = updateUserMood;
window.loadActiveLoungeTablesForHub = loadActiveLoungeTablesForHub;

// Setup real-time stats and cleanup on page unload
setupRealTimeStats();
window.addEventListener('beforeunload', cleanupStatsListeners);
window.addEventListener('unload', cleanupStatsListeners);