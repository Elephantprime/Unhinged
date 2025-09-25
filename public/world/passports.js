// Passports JavaScript - Comprehensive Journey Tracking with Firebase
import {
  auth,
  db,
  waitForAuth,
  getUserDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  limit
} from "../js/firebase.js";

console.log('📔 Enhanced Passports module loading...');
import '../js/toast-notifications.js'; // Load toast notifications

// Import points display utility
import { addPointsToNavigation } from '../js/points-display.js';

let currentUser = null;
let passportData = null;
let userStamps = {};
let travelLog = [];
let meetingHistory = [];
let passportStats = {};
let listeners = [];

// Comprehensive stamp definitions
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
  completionist: { name: 'Completionist', emoji: '🏆', category: 'achievement', description: 'Collect 75% of all stamps', points: 200 }
};

// Initialize Enhanced Passport System
document.addEventListener('DOMContentLoaded', async function() {
  console.log('📔 Enhanced Passports initializing...');
  
  // Wait for authentication
  currentUser = await waitForAuth();
  if (currentUser) {
    // Get user profile data (read-only)
    const userProfile = await getUserDoc(currentUser.uid);
    if (userProfile) {
      currentUser.displayName = userProfile.displayName || currentUser.displayName;
    }
    await initializePassportData();
    await loadPassportData();
    
    // Initialize points display
    addPointsToNavigation('.world-nav .nav-right', { position: 'prepend', size: 'medium' });
    
    console.log('✅ Passport loaded for:', currentUser.displayName);
  } else {
    setupDemoUser();
  }
  
  // Setup real-time listeners
  setupPassportListeners();
  
  // Initialize UI
  renderPassportUI();
  
  // Setup passport event handlers
  setupPassportEventHandlers();
});

// Initialize passport data structure for new users
async function initializePassportData() {
  if (!currentUser?.uid) return;
  
  try {
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    const passportDoc = await getDoc(passportRef);
    
    if (!passportDoc.exists()) {
      // Create initial passport data
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
      console.log('✅ Initialized passport for new user');
    }
  } catch (error) {
    console.error('❌ Error initializing passport data:', error);
  }
}

// Load comprehensive passport data
async function loadPassportData() {
  if (!currentUser?.uid) return;
  
  try {
    // Load passport main data
    const passportDoc = await getDoc(doc(db, 'user_passports', currentUser.uid));
    passportData = passportDoc.exists() ? passportDoc.data() : {};
    
    // Load user stamps
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
    
    // Load travel log
    const travelQuery = query(
      collection(db, 'passport_travels'),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const travelSnapshot = await getDocs(travelQuery);
    travelLog = travelSnapshot.docs.map(doc => doc.data());
    
    // Load meeting history
    const meetingsQuery = query(
      collection(db, 'passport_encounters'),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const meetingsSnapshot = await getDocs(meetingsQuery);
    meetingHistory = meetingsSnapshot.docs.map(doc => doc.data());
    
    console.log('✅ Passport data loaded successfully');
  } catch (error) {
    console.error('❌ Error loading passport data:', error);
  }
}

// Demo user setup
function setupDemoUser() {
  currentUser = {
    uid: 'demo',
    name: 'Demo Explorer',
    avatar: 'https://i.pravatar.cc/120',
    joinDate: 'January 2025'
  };
  
  // Setup demo data
  passportData = { totalStamps: 5, totalVisits: 12, totalEncounters: 8 };
  userStamps = {
    first_chat: { collected: true, timestamp: new Date() },
    lounge_visitor: { collected: true, timestamp: new Date() },
    table_hopper: { collected: true, timestamp: new Date() }
  };
  travelLog = [
    { location: 'lounge', timestamp: new Date(), action: 'Joined table chat' },
    { location: 'arcade', timestamp: new Date(), action: 'Played Truth or Dare' }
  ];
  meetingHistory = [
    { metUserId: 'user1', metUserName: 'Alice', location: 'lounge', timestamp: new Date() }
  ];
  
  renderPassportUI();
}

// Setup real-time passport listeners
function setupPassportListeners() {
  if (!currentUser?.uid) return;
  
  // Listen to passport data changes
  const passportListener = onSnapshot(
    doc(db, 'user_passports', currentUser.uid),
    (doc) => {
      if (doc.exists()) {
        passportData = doc.data();
        updatePassportDisplay();
        updateStatsDisplay();
      }
    }
  );
  listeners.push(passportListener);
  
  // Listen to new stamps
  const stampsListener = onSnapshot(
    query(
      collection(db, 'passport_stamps'),
      where('userId', '==', currentUser.uid)
    ),
    (snapshot) => {
      userStamps = {};
      snapshot.forEach(doc => {
        const stampData = doc.data();
        userStamps[stampData.stampId] = stampData;
      });
      renderStampsDisplay();
    }
  );
  listeners.push(stampsListener);
  
  // Listen to travel log updates
  const travelListener = onSnapshot(
    query(
      collection(db, 'passport_travels'),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    ),
    (snapshot) => {
      travelLog = snapshot.docs.map(doc => doc.data());
      renderTravelLogDisplay();
    }
  );
  listeners.push(travelListener);
}

// Update passport display
function updatePassportDisplay() {
  const photo = document.getElementById('user-passport-photo');
  const name = document.getElementById('passport-name');
  const joined = document.getElementById('passport-joined');
  const status = document.getElementById('passport-status');
  
  if (photo && currentUser) {
    const fallbackAvatar = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="60" cy="45" r="24" fill="#2a2a2a"/><path d="M 20 95 Q 20 75 35 67 Q 47.5 60 60 60 Q 72.5 60 85 67 Q 100 75 100 95 L 100 120 L 20 120 Z" fill="#2a2a2a"/></svg>');
    
    // Use PhotoUtils for safe image loading with fallbacks
    const photoUrl = currentUser.photoURL || currentUser.avatar;
    if (window.PhotoUtils?.loadImageWithFallback) {
      window.PhotoUtils.loadImageWithFallback(photo, photoUrl, 'avatar');
    } else {
      photo.src = photoUrl || fallbackAvatar;
      photo.onerror = () => photo.src = fallbackAvatar;
    }
  }
  if (name && currentUser) name.textContent = currentUser.displayName || currentUser.name || 'Anonymous Explorer';
  if (joined) {
    const joinDate = passportData?.createdAt?.toDate ? passportData.createdAt.toDate() : new Date();
    joined.textContent = `Member since: ${joinDate.toLocaleDateString()}`;
  }
  if (status) {
    const totalStamps = passportData?.totalStamps || 0;
    const statusText = totalStamps > 10 ? 'Veteran Explorer' : totalStamps > 5 ? 'Active Explorer' : 'New Explorer';
    status.textContent = `Status: ${statusText}`;
  }
}

// Render comprehensive UI
function renderPassportUI() {
  updatePassportDisplay();
  renderStampsDisplay();
  renderTravelLogDisplay();
  renderMeetingHistoryDisplay();
  updateStatsDisplay();
}

// Render stamps display
function renderStampsDisplay() {
  const categories = ['social', 'location', 'achievement'];
  
  categories.forEach(category => {
    const container = document.getElementById(`${category}-stamps`);
    if (!container) return;
    
    const categoryStamps = Object.entries(STAMP_DEFINITIONS).filter(([id, stamp]) => stamp.category === category);
    
    container.innerHTML = categoryStamps.map(([stampId, stampDef]) => {
      const isCollected = userStamps[stampId]?.collected || false;
      const collectDate = userStamps[stampId]?.timestamp?.toDate ? userStamps[stampId].timestamp.toDate() : null;
      
      return `
        <div class="stamp ${isCollected ? 'collected' : ''}" 
             onclick="showStampInfo('${stampId}')" 
             data-testid="stamp-${stampId}">
          <div style="font-size: 2rem; margin-bottom: 5px;">${stampDef.emoji}</div>
          <div style="font-size: 0.8rem; color: ${isCollected ? '#fff' : '#888'};">${stampDef.name}</div>
          ${isCollected && collectDate ? `<div style="font-size: 0.6rem; color: #bbb; margin-top: 2px;">${collectDate.toLocaleDateString()}</div>` : ''}
        </div>
      `;
    }).join('');
  });
}

// Render travel log display
function renderTravelLogDisplay() {
  const container = document.getElementById('travel-entries');
  if (!container) return;
  
  if (travelLog.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No travels recorded yet. Start exploring!</div>';
    return;
  }
  
  container.innerHTML = travelLog.slice(0, 10).map(entry => {
    const timestamp = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
    const timeAgo = getTimeAgo(timestamp);
    
    return `
      <div class="log-entry" data-testid="travel-entry">
        <div>
          <strong>${getLocationDisplayName(entry.location)}</strong>
          <div style="color: #888; font-size: 0.9rem;">${entry.action || 'Visited location'}</div>
        </div>
        <div style="color: #bbb; font-size: 0.8rem;">${timeAgo}</div>
      </div>
    `;
  }).join('');
}

// Render meeting history display
function renderMeetingHistoryDisplay() {
  // Add meeting history section if it doesn't exist
  let meetingSection = document.getElementById('meeting-history-section');
  if (!meetingSection) {
    const travelSection = document.querySelector('.travel-log');
    if (travelSection) {
      meetingSection = document.createElement('div');
      meetingSection.id = 'meeting-history-section';
      meetingSection.className = 'meeting-history';
      meetingSection.innerHTML = `
        <h3>👥 People You've Met</h3>
        <div class="meeting-entries" id="meeting-entries"></div>
      `;
      travelSection.parentNode.insertBefore(meetingSection, travelSection.nextSibling);
    }
  }
  
  const container = document.getElementById('meeting-entries');
  if (!container) return;
  
  if (meetingHistory.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No encounters recorded yet. Start socializing!</div>';
    return;
  }
  
  container.innerHTML = meetingHistory.slice(0, 10).map(meeting => {
    const timestamp = meeting.timestamp?.toDate ? meeting.timestamp.toDate() : new Date(meeting.timestamp);
    const timeAgo = getTimeAgo(timestamp);
    
    return `
      <div class="log-entry" data-testid="meeting-entry">
        <div>
          <strong>${meeting.metUserName || 'Unknown User'}</strong>
          <div style="color: #888; font-size: 0.9rem;">Met at ${getLocationDisplayName(meeting.location)}</div>
        </div>
        <div style="color: #bbb; font-size: 0.8rem;">${timeAgo}</div>
      </div>
    `;
  }).join('');
}

// Show detailed stamp information
function showStampInfo(stampId) {
  const stampDef = STAMP_DEFINITIONS[stampId];
  if (!stampDef) return;
  
  const isCollected = userStamps[stampId]?.collected || false;
  const collectDate = userStamps[stampId]?.timestamp?.toDate ? userStamps[stampId].timestamp.toDate() : null;
  
  const status = isCollected ? 'Collected!' : 'Not collected yet';
  const dateText = collectDate ? `\nEarned: ${collectDate.toLocaleDateString()}` : '';
  
  // Use elegant toast instead of bulky alert
  const statusText = isCollected ? 'Collected' : 'Available';
  const encouragement = isCollected ? 'Great job earning this stamp!' : 'Keep exploring to earn this stamp!';
  
  window.toast.showToast(
    `${stampDef.emoji} ${stampDef.name} - ${statusText} (${stampDef.points} pts)`, 
    isCollected ? 'success' : 'info'
  );
}

// Setup passport-specific event handlers
function setupPassportEventHandlers() {
  // Listen for stamp unlock events from other modules
  window.addEventListener('passportStampEarned', (event) => {
    const { stampId, location, action, metUser } = event.detail;
    awardStamp(stampId, location, action, metUser);
  });
  
  // Listen for travel events
  window.addEventListener('passportTravel', (event) => {
    const { location, action, metadata } = event.detail;
    recordTravel(location, action, metadata);
  });
  
  // Listen for encounter events
  window.addEventListener('passportEncounter', (event) => {
    const { metUserId, metUserName, location, interactionType } = event.detail;
    recordEncounter(metUserId, metUserName, location, interactionType);
  });
}

// Update comprehensive stats display
function updateStatsDisplay() {
  const totalStamps = document.getElementById('total-stamps');
  const placesVisited = document.getElementById('places-visited');
  const peopleMet = document.getElementById('people-met');
  const completionRate = document.getElementById('completion-rate');
  
  // Calculate real stats
  const collectedStamps = Object.keys(userStamps).filter(stampId => userStamps[stampId]?.collected).length;
  const totalAvailableStamps = Object.keys(STAMP_DEFINITIONS).length;
  const completion = totalAvailableStamps > 0 ? Math.round((collectedStamps / totalAvailableStamps) * 100) : 0;
  
  const uniqueLocations = new Set(travelLog.map(entry => entry.location)).size;
  const uniquePeople = new Set(meetingHistory.map(meeting => meeting.metUserId)).size;
  
  if (totalStamps) totalStamps.textContent = collectedStamps;
  if (placesVisited) placesVisited.textContent = uniqueLocations || passportData?.totalVisits || 0;
  if (peopleMet) peopleMet.textContent = uniquePeople || passportData?.totalEncounters || 0;
  if (completionRate) completionRate.textContent = `${completion}%`;
}

// =======================================================
// PASSPORT STAMP SYSTEM - Core Functions
// =======================================================

// Award a stamp to the user
async function awardStamp(stampId, location = null, action = null, metUser = null) {
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
    
    // Update passport stats
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    await updateDoc(passportRef, {
      totalStamps: (passportData?.totalStamps || 0) + 1,
      updatedAt: serverTimestamp()
    });
    
    // Show stamp earned animation
    showStampEarnedAnimation(stampId);
    
    console.log('✅ Stamp awarded:', stampId);
  } catch (error) {
    console.error('❌ Error awarding stamp:', error);
  }
}

// Record travel/visit to a location
async function recordTravel(location, action, metadata = {}) {
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
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    await updateDoc(passportRef, {
      totalVisits: (passportData?.totalVisits || 0) + 1,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Travel recorded:', location, action);
  } catch (error) {
    console.error('❌ Error recording travel:', error);
  }
}

// Record user encounter/meeting
async function recordEncounter(metUserId, metUserName, location, interactionType = 'chat') {
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
    const passportRef = doc(db, 'user_passports', currentUser.uid);
    await updateDoc(passportRef, {
      totalEncounters: (passportData?.totalEncounters || 0) + 1,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Encounter recorded:', metUserName, 'at', location);
  } catch (error) {
    console.error('❌ Error recording encounter:', error);
  }
}

// Show stamp earned animation
function showStampEarnedAnimation(stampId) {
  const stampDef = STAMP_DEFINITIONS[stampId];
  if (!stampDef) return;
  
  // Create achievement popup
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(45deg, #8e44ad, #3498db);
    color: white;
    padding: 20px;
    border-radius: 15px;
    z-index: 10000;
    text-align: center;
    box-shadow: 0 10px 30px rgba(142, 68, 173, 0.5);
    animation: stampEarned 3s ease-in-out;
  `;
  
  popup.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">🎉 Passport Stamp Earned!</h3>
    <div style="font-size: 3rem; margin: 10px 0;">${stampDef.emoji}</div>
    <div style="font-weight: bold; margin-bottom: 5px;">${stampDef.name}</div>
    <div style="font-size: 14px; opacity: 0.9;">${stampDef.description}</div>
    <div style="margin-top: 10px; font-size: 12px;">+${stampDef.points} Points!</div>
  `;
  
  document.body.appendChild(popup);
  
  // Remove popup after animation
  setTimeout(() => {
    if (popup.parentNode) {
      popup.parentNode.removeChild(popup);
    }
  }, 3000);
}

// =======================================================
// UTILITY FUNCTIONS
// =======================================================

// Get time ago string
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Get location display name with emoji
function getLocationDisplayName(location) {
  const locationNames = {
    lounge: '🏠 Lounge',
    arcade: '🎮 Arcade', 
    stages: '🎤 Stages',
    districts: '🏙️ Districts',
    dating: '💕 Dating District',
    confession: '💭 Confession Corner',
    debate: '⚖️ Debate Den',
    meme: '😂 Meme Central',
    world: '🌍 World Hub'
  };
  
  return locationNames[location] || `📍 ${location}`;
}

// Check and award location-based stamps
function checkLocationStamps(location) {
  // Award first visit stamps
  switch (location) {
    case 'lounge':
      awardStamp('lounge_visitor', location, 'First visit');
      break;
    case 'arcade':
      awardStamp('arcade_gamer', location, 'First visit');
      break;
    case 'stages':
      awardStamp('stage_performer', location, 'First visit');
      break;
    case 'districts':
      awardStamp('district_explorer', location, 'First visit');
      break;
  }
  
  // Check for world traveler stamp (visited all main locations)
  const mainLocations = ['lounge', 'arcade', 'stages', 'districts'];
  const visitedLocations = new Set(travelLog.map(entry => entry.location));
  const visitedMain = mainLocations.filter(loc => visitedLocations.has(loc));
  
  if (visitedMain.length >= 4) {
    awardStamp('world_traveler', 'world', 'Visited all main areas');
  }
}

// Cleanup listeners on page unload
window.addEventListener('beforeunload', () => {
  listeners.forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });
});

// =======================================================
// GLOBAL EXPORTS & API
// =======================================================

// Make functions globally available for other modules
window.PassportAPI = {
  awardStamp,
  recordTravel,
  recordEncounter,
  checkLocationStamps,
  getCurrentUser: () => currentUser,
  getStampDefinitions: () => STAMP_DEFINITIONS,
  getUserStamps: () => userStamps
};

// Legacy compatibility
window.showStampInfo = showStampInfo;
window.awardStamp = awardStamp;
window.recordTravel = recordTravel;
window.recordEncounter = recordEncounter;

console.log('✅ Enhanced Passport system loaded with comprehensive tracking!');

// Add CSS animation for stamp earned popup
const style = document.createElement('style');
style.textContent = `
  @keyframes stampEarned {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }
    20% {
      transform: translate(-50%, -50%) scale(1.1);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }
  
  .meeting-history {
    margin-bottom: 40px;
  }
  
  .meeting-history h3 {
    color: #8e44ad;
    margin-bottom: 20px;
  }
  
  .meeting-entries {
    max-height: 300px;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 20px;
  }
`;
document.head.appendChild(style);