// Lightweight PassportAPI for global use across all World pages
// Extracted from public/world/passports.js for universal activity tracking

import {
  auth,
  db,
  waitForAuth,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "./firebase.js";

// Comprehensive stamp definitions (shared across all modules)
const STAMP_DEFINITIONS = {
  // Social Stamps
  first_chat: { name: 'First Chat', emoji: '💬', category: 'social', description: 'Send your first message in the Lounge', points: 10 },
  table_hopper: { name: 'Table Hopper', emoji: '🏃‍♀️', category: 'social', description: 'Join 5 different tables', points: 25 },
  friend_maker: { name: 'Friend Maker', emoji: '🤝', category: 'social', description: 'Exchange whispers with 10 people', points: 50 },
  party_animal: { name: 'Party Animal', emoji: '🎉', category: 'social', description: 'Chat for 2+ hours in one session', points: 30 },
  social_butterfly: { name: 'Social Butterfly', emoji: '🦋', category: 'social', description: 'Meet 25 different people', points: 75 },
  chat_master: { name: 'Chat Master', emoji: '👑', category: 'social', description: 'Send 100 messages', points: 40 },
  
  // Location Stamps
  lounge_visitor: { name: 'Lounge Visitor', emoji: '🏠', category: 'location', description: 'Visit the Lounge', points: 5 },
  arcade_gamer: { name: 'Arcade Gamer', emoji: '🎮', category: 'location', description: 'Play games in the Arcade', points: 10 },
  stage_performer: { name: 'Stage Performer', emoji: '🎤', category: 'location', description: 'Join a Stage event', points: 15 },
  district_explorer: { name: 'District Explorer', emoji: '🏙️', category: 'location', description: 'Visit all Districts', points: 30 },
  world_traveler: { name: 'World Traveler', emoji: '🌍', category: 'location', description: 'Visit every World section', points: 50 },
  frequent_flyer: { name: 'Frequent Flyer', emoji: '✈️', category: 'location', description: 'Make 50 location visits', points: 60 },
  
  // Achievement Stamps
  truth_teller: { name: 'Truth Teller', emoji: '🎯', category: 'achievement', description: 'Complete 10 Truth or Dare challenges', points: 25 },
  meme_lord: { name: 'Meme Lord', emoji: '😂', category: 'achievement', description: 'Submit 5 memes to contests', points: 35 },
  debate_champion: { name: 'Debate Champion', emoji: '⚖️', category: 'achievement', description: 'Win 3 debates or discussions', points: 45 },
  spotlight_star: { name: 'Spotlight Star', emoji: '⭐', category: 'achievement', description: 'Be featured in Spotlight', points: 100 },
  early_adopter: { name: 'Early Adopter', emoji: '🚀', category: 'achievement', description: 'Join within first week', points: 20 },
  night_owl: { name: 'Night Owl', emoji: '🦉', category: 'achievement', description: 'Be active after midnight 5 times', points: 15 },
  completionist: { name: 'Completionist', emoji: '🏆', category: 'achievement', description: 'Collect 75% of all stamps', points: 200 },
  
  // Daily Mission Stamps
  daily_warrior: { name: 'Daily Warrior', emoji: '⚔️', category: 'achievement', description: 'Complete all easy daily missions', points: 20 },
  daily_champion: { name: 'Daily Champion', emoji: '🏅', category: 'achievement', description: 'Complete all medium daily missions', points: 50 },
  daily_legend: { name: 'Daily Legend', emoji: '👑', category: 'achievement', description: 'Complete all hard daily missions', points: 100 },
  daily_completionist: { name: 'Daily Completionist', emoji: '💎', category: 'achievement', description: 'Complete ALL daily missions in one day', points: 200 },
  mission_streak_3: { name: '3 Day Streak', emoji: '🔥', category: 'achievement', description: 'Complete daily missions for 3 days straight', points: 75 },
  mission_streak_7: { name: 'Week Warrior', emoji: '📅', category: 'achievement', description: 'Complete daily missions for 7 days straight', points: 150 }
};

// Global state for lightweight API
let currentUser = null;
let userStamps = {};
let passportData = {};
let isInitialized = false;

// Initialize lightweight passport system
async function initialize() {
  if (isInitialized) return;
  
  try {
    currentUser = await waitForAuth();
    if (currentUser) {
      await loadUserStamps();
      await loadPassportData();
      isInitialized = true;
      console.log('✅ PassportAPI initialized for:', currentUser.displayName);
    }
  } catch (error) {
    console.error('❌ Error initializing PassportAPI:', error);
  }
}

// Load user stamps for stamp checking
async function loadUserStamps() {
  if (!currentUser?.uid) return;
  
  try {
    const stampsQuery = query(
      collection(db, 'passport_stamps'),
      where('userId', '==', currentUser.uid)
    );
    const stampsSnapshot = await getDocs(stampsQuery);
    userStamps = {};
    stampsSnapshot.forEach(doc => {
      const stampData = doc.data();
      userStamps[stampData.stampId] = stampData;
    });
  } catch (error) {
    console.error('❌ Error loading user stamps:', error);
  }
}

// Load basic passport data
async function loadPassportData() {
  if (!currentUser?.uid) return;
  
  try {
    const passportDoc = await getDoc(doc(db, 'user_passports', currentUser.uid));
    passportData = passportDoc.exists() ? passportDoc.data() : {};
  } catch (error) {
    console.error('❌ Error loading passport data:', error);
  }
}

// Initialize passport data for new users
async function initializePassportData() {
  if (!currentUser?.uid) return;
  
  try {
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    const passportDoc = await getDoc(passportRef);
    
    if (!passportDoc.exists()) {
      const initialPassport = {
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalStamps: 0,
        totalVisits: 0,
        totalEncounters: 0,
        favoriteLocation: null,
        firstVisit: serverTimestamp()
      };
      
      await setDoc(passportRef, initialPassport);
      passportData = initialPassport;
      console.log('✅ Initialized passport for new user');
    }
  } catch (error) {
    console.error('❌ Error initializing passport data:', error);
  }
}

// Award stamp to user (core function used by all modules)
async function awardStamp(stampId, location, action, metUser = null) {
  await initialize(); // Ensure initialized
  
  if (!currentUser?.uid || !STAMP_DEFINITIONS[stampId]) {
    console.warn('Cannot award stamp: user not authenticated or invalid stamp ID');
    return;
  }
  
  // Check if stamp already exists
  if (userStamps[stampId]?.collected) {
    console.log('Stamp already collected:', stampId);
    return;
  }
  
  try {
    const stampData = {
      userId: currentUser.uid,
      stampId: stampId,
      collected: true,
      timestamp: serverTimestamp(),
      location: location,
      action: action,
      metUser: metUser,
      points: STAMP_DEFINITIONS[stampId].points
    };
    
    // Save stamp to Firestore
    await addDoc(collection(db, 'passport_stamps'), stampData);
    
    // Update local cache
    userStamps[stampId] = stampData;
    
    // Update passport stats
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    await updateDoc(passportRef, {
      totalStamps: (passportData?.totalStamps || 0) + 1,
      updatedAt: serverTimestamp()
    });
    
    // Show lightweight notification
    showStampNotification(stampId);
    
    console.log('✅ Stamp awarded:', stampId);
    
    // Update daily missions progress for stamp collection
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      await window.DailyMissionsAPI.updateProgress('stamps_earned', 1, {
        stampId,
        location,
        action,
        points: STAMP_DEFINITIONS[stampId].points
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error awarding stamp:', error);
    return false;
  }
}

// Record travel/location visit (used by all World modules)
async function recordTravel(location, action, metadata = {}) {
  await initialize(); // Ensure initialized
  
  if (!currentUser?.uid) return;
  
  try {
    const travelData = {
      userId: currentUser.uid,
      location: location,
      action: action,
      timestamp: serverTimestamp(),
      metadata: metadata
    };
    
    await addDoc(collection(db, 'passport_travels'), travelData);
    
    // Update visit count
    await initializePassportData(); // Ensure passport exists
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    await updateDoc(passportRef, {
      totalVisits: (passportData?.totalVisits || 0) + 1,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Travel recorded:', location, action);
    
    // Update daily missions progress for area visits
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      await window.DailyMissionsAPI.updateProgress('areas_visited', 1, {
        location,
        action
      });
    }
  } catch (error) {
    console.error('❌ Error recording travel:', error);
  }
}

// Record user encounter/meeting (used by chat systems)
async function recordEncounter(metUserId, metUserName, location, interactionType = 'chat') {
  await initialize(); // Ensure initialized
  
  if (!currentUser?.uid || metUserId === currentUser.uid) return;
  
  try {
    const encounterData = {
      userId: currentUser.uid,
      metUserId: metUserId,
      metUserName: metUserName,
      location: location,
      interactionType: interactionType,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, 'passport_encounters'), encounterData);
    
    // Update encounter count
    await initializePassportData(); // Ensure passport exists
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    await updateDoc(passportRef, {
      totalEncounters: (passportData?.totalEncounters || 0) + 1,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Encounter recorded:', metUserName, 'at', location);
    
    // Update daily missions progress for meeting people
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      await window.DailyMissionsAPI.updateProgress('people_met', 1, {
        metUserId,
        metUserName,
        location,
        interactionType
      });
    }
  } catch (error) {
    console.error('❌ Error recording encounter:', error);
  }
}

// Check and award location-based stamps
async function checkLocationStamps(location) {
  await initialize(); // Ensure initialized
  
  if (!currentUser?.uid) return;
  
  // Award location-specific stamps
  const locationStampMap = {
    'lounge': 'lounge_visitor',
    'arcade': 'arcade_gamer', 
    'stages': 'stage_performer',
    'districts': 'district_explorer'
  };
  
  const stampId = locationStampMap[location];
  if (stampId && !userStamps[stampId]?.collected) {
    await awardStamp(stampId, location, `First visit to ${location}`);
  }
}

// Lightweight stamp earned notification
function showStampNotification(stampId) {
  const stamp = STAMP_DEFINITIONS[stampId];
  if (!stamp) return;
  
  // Create simple toast notification
  const notification = document.createElement('div');
  notification.className = 'passport-toast';
  notification.innerHTML = `
    <div class="stamp-notification">
      <span class="stamp-emoji">${stamp.emoji}</span>
      <div class="stamp-info">
        <div class="stamp-name">${stamp.name}</div>
        <div class="stamp-points">+${stamp.points} points</div>
      </div>
    </div>
  `;
  
  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;
  
  // Add animation styles
  if (!document.getElementById('passport-toast-styles')) {
    const styles = document.createElement('style');
    styles.id = 'passport-toast-styles';
    styles.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .stamp-notification {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .stamp-emoji { font-size: 20px; }
      .stamp-info { flex: 1; }
      .stamp-name { font-weight: 600; font-size: 14px; }
      .stamp-points { font-size: 12px; opacity: 0.9; }
    `;
    document.head.appendChild(styles);
  }
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Public API exposed to window
const PassportAPI = {
  initialize,
  awardStamp,
  recordTravel,
  recordEncounter,
  checkLocationStamps,
  
  // Read-only access to stamp definitions
  getStampDefinitions: () => ({ ...STAMP_DEFINITIONS }),
  
  // Check if user has specific stamp
  hasStamp: (stampId) => {
    return userStamps[stampId]?.collected || false;
  },
  
  // Get current user passport stats
  getPassportStats: () => ({ ...passportData })
};

// Auto-initialize and expose globally
(async () => {
  window.PassportAPI = PassportAPI;
  console.log('🌍 PassportAPI available globally');
})();

export default PassportAPI;
export { STAMP_DEFINITIONS };