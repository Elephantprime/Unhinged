// Spotlight JavaScript - Global Highlight System with Real Firebase Data
import '../js/passport-api.js'; // Load PassportAPI globally
import '../js/toast-notifications.js'; // Load toast notifications

// Import points display utility
import { addPointsToNavigation } from '../js/points-display.js';
import { 
  auth, 
  db, 
  getUserDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  getDocs, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from '../js/firebase.js';

console.log('⭐ Spotlight module loading...');

let currentUser = null;
let spotlightTimer = null;
let spotlightUsers = [];
let currentSpotlightUser = null;
let spotlightQueue = [];
let spotlightHistory = [];
let timeRemaining = 300; // 5 minutes in seconds

document.addEventListener('DOMContentLoaded', async function() {
  // Spotlight initialized with real Firebase data
  
  // Check for user authentication
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async user => {
      if (user) {
        await loadUserProfile(user);
      } else {
        setupDemoUser();
      }
      
      // Initialize spotlight system after auth
      await initializeSpotlight();
    });
  } else {
    setupDemoUser();
    await initializeSpotlight();
  }
  
  // Initialize points display
  addPointsToNavigation('.world-nav .nav-right', { position: 'prepend', size: 'medium' });
  
  setupActionButtons();
  setupTokenButtons();
});

// Load user profile
async function loadUserProfile(user) {
  try {
    const userDoc = await getUserDoc(user.uid);
    const userData = userDoc || {};
    
    currentUser = {
      uid: user.uid,
      name: userData.displayName || userData.name || 'Anonymous',
      avatar: userData.photoURL || 'https://i.pravatar.cc/50',
      tokens: userData.spotlightTokens || 5
    };
    
    updateTokenDisplay();
    console.log('✅ Spotlight loaded for:', currentUser.name);
  } catch (error) {
    console.error('❌ Error loading user profile:', error);
    setupDemoUser();
  }
}

// Demo user
function setupDemoUser() {
  currentUser = {
    uid: 'demo',
    name: 'Demo User',
    avatar: 'https://i.pravatar.cc/50',
    tokens: 5
  };
  updateTokenDisplay();
}

// Initialize spotlight with real data
async function initializeSpotlight() {
  // Initializing spotlight with real Firebase data
  
  // Track spotlight visit for passport
  if (typeof window.PassportAPI !== 'undefined') {
    window.PassportAPI.recordTravel('spotlight', 'Visited spotlight section');
    window.PassportAPI.checkLocationStamps('spotlight');
  }
  
  try {
    // Load real spotlight users from Firebase
    await loadSpotlightUsers();
    
    // Set up first spotlight user
    if (spotlightQueue.length > 0) {
      currentSpotlightUser = spotlightQueue.shift();
      await saveCurrentSpotlight(currentSpotlightUser);
    }
    
    // Update all displays
    updateSpotlightDisplay();
    renderQueue();
    renderHistory();
    
    // Start the timer
    startTimer();
    
    // Spotlight initialized with real data successfully
  } catch (error) {
    console.error('❌ Error initializing spotlight:', error);
    // Fall back to empty state
    currentSpotlightUser = null;
    updateSpotlightDisplay();
    renderQueue();
    renderHistory();
    startTimer();
  }
}

// Update spotlight display with real user data
function updateSpotlightDisplay() {
  if (!currentSpotlightUser) {
    showEmptySpotlightState();
    return;
  }
  
  const avatar = document.getElementById('spotlight-avatar');
  const name = document.getElementById('spotlight-name');
  const bio = document.getElementById('spotlight-bio');
  const age = document.getElementById('spotlight-age');
  const location = document.getElementById('spotlight-location');
  
  if (avatar) avatar.src = currentSpotlightUser.avatar || 'https://i.pravatar.cc/150?img=1';
  if (name) name.textContent = currentSpotlightUser.name || 'Anonymous';
  if (bio) bio.textContent = currentSpotlightUser.bio || 'No bio available';
  if (age) age.textContent = currentSpotlightUser.age ? `Age: ${currentSpotlightUser.age}` : 'Age: Not specified';
  if (location) location.textContent = currentSpotlightUser.location || 'Location: Not specified';
  
  console.log('✅ Spotlight display updated for user:', currentSpotlightUser.name);
}

// Show empty state when no users are in spotlight
function showEmptySpotlightState() {
  const avatar = document.getElementById('spotlight-avatar');
  const name = document.getElementById('spotlight-name');
  const bio = document.getElementById('spotlight-bio');
  const age = document.getElementById('spotlight-age');
  const location = document.getElementById('spotlight-location');
  
  if (avatar) avatar.src = 'https://i.pravatar.cc/150?img=1';
  if (name) name.textContent = 'No one in spotlight yet';
  if (bio) bio.textContent = 'Be the first to join the spotlight!';
  if (age) age.textContent = '';
  if (location) location.textContent = '';
}

// Start timer
function startTimer() {
  spotlightTimer = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    
    if (timeRemaining <= 0) {
      nextSpotlight();
    }
  }, 1000);
}

// Update timer display
function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const timerEl = document.getElementById('time-remaining');
  if (timerEl) {
    timerEl.textContent = display;
  }
}

// Next spotlight with real user rotation
async function nextSpotlight() {
  console.log('⭐ Rotating to next spotlight user...');
  
  try {
    // Move current user to history if exists
    if (currentSpotlightUser) {
      spotlightHistory.unshift({
        ...currentSpotlightUser,
        endTime: new Date(),
        duration: 300 - timeRemaining
      });
      
      // Keep only last 10 in history
      if (spotlightHistory.length > 10) {
        spotlightHistory.pop();
      }
    }
    
    // Get next user from queue or fetch new ones
    if (spotlightQueue.length === 0) {
      await loadSpotlightUsers();
    }
    
    if (spotlightQueue.length > 0) {
      currentSpotlightUser = spotlightQueue.shift();
      timeRemaining = 300; // Reset to 5 minutes
      
      // Save current spotlight to Firebase
      await saveCurrentSpotlight(currentSpotlightUser);
      
      console.log('⭐ Spotlight rotated to:', currentSpotlightUser.name);
    } else {
      currentSpotlightUser = null;
      console.log('⭐ No users in spotlight queue');
    }
    
    updateSpotlightDisplay();
    renderQueue();
    renderHistory();
    
  } catch (error) {
    console.error('❌ Error rotating spotlight:', error);
  }
}

// Save current spotlight user to Firebase
async function saveCurrentSpotlight(user) {
  try {
    await addDoc(collection(db, 'spotlight_current'), {
      uid: user.uid,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      startTime: serverTimestamp(),
      duration: 300
    });
  } catch (error) {
    console.warn('⚠️ Could not save spotlight data:', error);
  }
}

// Load real users who want to be in spotlight
async function loadSpotlightUsers() {
  // Loading real spotlight users from Firebase
  
  try {
    // Get users who have opted into spotlight
    const usersQuery = query(
      collection(db, 'users'),
      where('spotlightOptIn', '==', true),
      orderBy('spotlightPriority', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(usersQuery);
    const users = [];
    
    snapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        uid: doc.id,
        name: userData.displayName || userData.name || 'Anonymous',
        avatar: userData.photoURL || userData.avatar || `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 20) + 1}`,
        bio: userData.bio || userData.spotlightBio || 'No bio available',
        age: userData.age,
        location: userData.location,
        spotlightPriority: userData.spotlightPriority || 0
      });
    });
    
    if (users.length === 0) {
      console.log('📭 No users opted into spotlight, using fallback');
      await createFallbackSpotlightUsers();
    } else {
      spotlightQueue = [...users];
      // Successfully loaded real spotlight users
    }
    
  } catch (error) {
    console.error('❌ Error loading spotlight users:', error);
    await createFallbackSpotlightUsers();
  }
}

// Create minimal fallback when no real users available
async function createFallbackSpotlightUsers() {
  console.log('🎭 Creating fallback spotlight users...');
  
  spotlightQueue = [
    {
      uid: 'fallback_1',
      name: 'Community Member',
      avatar: 'https://i.pravatar.cc/150?img=1',
      bio: 'Join our community and be featured in the spotlight!',
      age: null,
      location: null
    }
  ];
}

// Setup action buttons
function setupActionButtons() {
  const likeBtn = document.getElementById('like-spotlight');
  const waveBtn = document.getElementById('wave-spotlight');
  const messageBtn = document.getElementById('message-spotlight');
  const boostBtn = document.getElementById('boost-spotlight');
  
  if (likeBtn) {
    likeBtn.addEventListener('click', () => {
      showActionFeedback('❤️ Liked!', 'You liked this spotlight');
    });
  }
  
  if (waveBtn) {
    waveBtn.addEventListener('click', () => {
      showActionFeedback('👋 Wave sent!', 'Your wave was sent to the spotlight user');
    });
  }
  
  if (messageBtn) {
    messageBtn.addEventListener('click', () => {
      showActionFeedback('💬 Message', 'Messaging feature coming soon!');
    });
  }
  
  if (boostBtn) {
    boostBtn.addEventListener('click', () => {
      if (currentUser.tokens >= 2) {
        currentUser.tokens -= 2;
        updateTokenDisplay();
        showActionFeedback('🚀 Boosted!', 'You boosted this spotlight for 2 tokens');
      } else {
        showActionFeedback('❌ Not enough tokens', 'You need 2 tokens to boost');
      }
    });
  }
}

// Setup token buttons
function setupTokenButtons() {
  const buyBtn = document.getElementById('buy-spotlight');
  const scheduleBtn = document.getElementById('schedule-spotlight');
  
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (currentUser.tokens >= 10) {
        currentUser.tokens -= 10;
        updateTokenDisplay();
        showActionFeedback('🎯 Spotlight purchased!', 'You will be featured in the next rotation');
      } else {
        showActionFeedback('❌ Not enough tokens', 'You need 10 tokens to buy a spotlight');
      }
    });
  }
  
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', () => {
      showActionFeedback('📅 Coming Soon', 'Spotlight scheduling will be available soon!');
    });
  }
}

// Show action feedback
function showActionFeedback(title, message) {
  // Use elegant toast notification instead of alert
  const type = title.includes('❤️') ? 'love' : 
               title.includes('👋') ? 'wave' : 
               title.includes('🚀') ? 'rocket' : 
               title.includes('❌') ? 'error' : 'info';
  window.toast.showToast(`${title} - ${message}`, type);
}

// Update token display
function updateTokenDisplay() {
  const tokenEl = document.getElementById('user-tokens');
  if (tokenEl) {
    tokenEl.textContent = currentUser.tokens;
  }
}

// Render real user queue
function renderQueue() {
  const container = document.getElementById('queue-list');
  if (!container) return;
  
  // Show next 3 users in queue
  const queueUsers = spotlightQueue.slice(0, 3);
  
  if (queueUsers.length === 0) {
    container.innerHTML = `
      <div class="queue-item empty-state">
        <div style="color: #888; text-align: center; padding: 20px;">
          <p>No one in queue</p>
          <p style="font-size: 0.8rem;">Be the first to join!</p>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = queueUsers.map((user, index) => `
    <div class="queue-item">
      <img src="${user.avatar}" alt="${user.name}" onerror="this.src='https://i.pravatar.cc/50'">
      <p>${user.name}</p>
      <div style="color: #888; font-size: 0.8rem;">In ${(index + 1) * 5} min</div>
    </div>
  `).join('');
}

// Render real spotlight history
function renderHistory() {
  const container = document.getElementById('history-grid');
  if (!container) return;
  
  if (spotlightHistory.length === 0) {
    container.innerHTML = `
      <div class="history-item empty-state">
        <div style="color: #888; text-align: center; padding: 20px;">
          <p>No spotlight history yet</p>
          <p style="font-size: 0.8rem;">Check back later!</p>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = spotlightHistory.map(item => {
    const timeAgo = getTimeAgo(item.endTime);
    return `
      <div class="history-item">
        <img src="${item.avatar}" alt="${item.name}" onerror="this.src='https://i.pravatar.cc/50'">
        <p>${item.name}</p>
        <div class="time">${timeAgo}</div>
      </div>
    `;
  }).join('');
}

// Calculate time ago for history
function getTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
  
  try {
    const now = Date.now();
    const then = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
    const diff = Math.floor((now - then) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch (error) {
    return 'Recently';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (spotlightTimer) {
    clearInterval(spotlightTimer);
  }
});