// Stages JavaScript - Live Events Platform
import {
  auth,
  db,
  waitForAuth,
  getUserDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "../js/firebase.js";

import '../js/passport-api.js'; // Load PassportAPI globally
import '../js/toast-notifications.js'; // Load toast notifications

// Import points display utility
import { addPointsToNavigation } from '../js/points-display.js';

import {
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log('🎤 Stages module loading...');

// Global variables
let currentUser = null;
let eventsListener = null;
let currentFilter = 'all';
let selectedEventId = null;
let participantsListener = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🎤 Stages initializing...');
  
  // Wait for auth state
  currentUser = await waitForAuth();
  if (currentUser) {
    // Get user profile data (read-only)
    const userProfile = await getUserDoc(currentUser.uid);
    if (userProfile) {
      currentUser.displayName = userProfile.displayName || currentUser.displayName;
    }
    console.log('✅ User authenticated:', currentUser.displayName);
    
    // Track stages visit for passport
    if (typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('stages', 'Entered stages');
      window.PassportAPI.checkLocationStamps('stages');
    }
  }
  
  // Initialize points display
  addPointsToNavigation('.world-nav .nav-right', { position: 'prepend', size: 'medium' });
  
  // Initialize event listeners and UI
  initializeEventListeners();
  loadEvents();
  updateStats();
});

// Initialize all event listeners
function initializeEventListeners() {
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      setActiveFilter(this.dataset.filter);
    });
  });
  
  // Create event button
  document.getElementById('create-event-btn')?.addEventListener('click', openCreateEventModal);
  
  // Event form submission
  document.getElementById('create-event-form')?.addEventListener('submit', handleCreateEvent);
  
  // Modal backdrop clicks
  document.getElementById('event-modal-backdrop')?.addEventListener('click', function(e) {
    if (e.target === this) closeCreateEventModal();
  });
  
  document.getElementById('event-detail-backdrop')?.addEventListener('click', function(e) {
    if (e.target === this) closeEventDetailModal();
  });
  
  // Set minimum start time to current time
  const startTimeInput = document.getElementById('start-time');
  if (startTimeInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    startTimeInput.min = now.toISOString().slice(0, 16);
  }
  
  // Additional button event listeners (converted from onclick handlers)
  document.getElementById('create-first-event-btn')?.addEventListener('click', openCreateEventModal);
  document.getElementById('quick-audio-btn')?.addEventListener('click', createAudioRoom);
  document.getElementById('quick-video-btn')?.addEventListener('click', createVideoPod);
  document.getElementById('quick-hotseat-btn')?.addEventListener('click', createHotSeat);
  document.getElementById('close-event-modal-btn')?.addEventListener('click', closeCreateEventModal);
  document.getElementById('cancel-event-btn')?.addEventListener('click', closeCreateEventModal);
  document.getElementById('close-detail-modal-btn')?.addEventListener('click', closeEventDetailModal);
  document.getElementById('join-event-btn')?.addEventListener('click', joinEvent);
  document.getElementById('leave-event-btn')?.addEventListener('click', leaveEvent);
}

// Load and display events
async function loadEvents() {
  console.log('📊 Loading events...');
  
  try {
    // Set up real-time listener for events
    const eventsRef = collection(db, 'stages_events');
    let q = query(eventsRef, orderBy('startTime', 'asc'));
    
    // Apply filters if needed
    if (currentFilter === 'live') {
      q = query(eventsRef, where('status', '==', 'live'), orderBy('startTime', 'asc'));
    } else if (currentFilter !== 'all') {
      q = query(eventsRef, where('eventType', '==', currentFilter), orderBy('startTime', 'asc'));
    }
    
    // Clean up existing listener
    if (eventsListener) {
      eventsListener();
    }
    
    eventsListener = onSnapshot(q, (snapshot) => {
      displayEvents(snapshot.docs);
      updateStats();
    });
    
  } catch (error) {
    console.error('❌ Error loading events:', error);
    showError('Failed to load events. Please try refreshing the page.');
  }
}

// Display events in the grid
function displayEvents(eventDocs) {
  const eventsGrid = document.getElementById('events-grid');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  
  if (!eventsGrid) return;
  
  // Hide loading state
  if (loadingState) loadingState.style.display = 'none';
  
  // Clear existing events
  eventsGrid.innerHTML = '';
  
  if (eventDocs.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  eventDocs.forEach(docSnap => {
    const event = docSnap.data();
    const eventCard = createEventCard(docSnap.id, event);
    eventsGrid.appendChild(eventCard);
  });
}

// Create individual event card
function createEventCard(eventId, event) {
  const card = document.createElement('div');
  card.className = `event-card ${event.eventType}-card`;
  card.dataset.testid = `card-event-${eventId}`;
  
  const startTime = event.startTime?.toDate ? event.startTime.toDate() : new Date(event.startTime);
  const now = new Date();
  const isLive = event.status === 'live';
  const isUpcoming = startTime > now && event.status === 'scheduled';
  const isEnded = event.status === 'ended';
  
  const timeDisplay = formatEventTime(startTime, isLive);
  const statusDisplay = getStatusDisplay(event.status, isLive, isUpcoming, isEnded);
  
  card.innerHTML = `
    <div class="event-header">
      <div class="event-type-icon">${getEventTypeIcon(event.eventType)}</div>
      <div class="event-status ${event.status}" data-testid="text-status-${eventId}">
        ${statusDisplay}
      </div>
    </div>
    
    <div class="event-content">
      <h3 class="event-title" data-testid="text-title-${eventId}">${escapeHtml(event.title)}</h3>
      <p class="event-description" data-testid="text-description-${eventId}">${escapeHtml(event.description || 'No description')}</p>
      
      <div class="event-meta">
        <div class="meta-item">
          <span class="meta-icon">👤</span>
          <span data-testid="text-host-${eventId}">${escapeHtml(event.hostName || 'Unknown Host')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-icon">⏰</span>
          <span data-testid="text-time-${eventId}">${timeDisplay}</span>
        </div>
        <div class="meta-item">
          <span class="meta-icon">👥</span>
          <span data-testid="text-participants-${eventId}">${event.participantCount || 0}/${event.maxParticipants}</span>
        </div>
      </div>
    </div>
    
    <div class="event-actions">
      <button class="view-btn" onclick="openEventDetail('${eventId}')" data-testid="button-view-${eventId}">
        View Details
      </button>
      <button class="join-btn ${!canJoinEvent(event) ? 'disabled' : ''}" 
              onclick="quickJoinEvent('${eventId}')" 
              data-testid="button-join-${eventId}"
              ${!canJoinEvent(event) ? 'disabled' : ''}>
        ${getJoinButtonText(event, isLive)}
      </button>
    </div>
  `;
  
  return card;
}

// Helper functions
function getEventTypeIcon(eventType) {
  const icons = {
    audio: '🎙️',
    video: '📹',
    hotseat: '🔥',
    panel: '👥'
  };
  return icons[eventType] || '🎭';
}

function getStatusDisplay(status, isLive, isUpcoming, isEnded) {
  if (isLive) return '🔴 Live';
  if (isUpcoming) return '📅 Upcoming';
  if (isEnded) return '⏹️ Ended';
  return '📊 Scheduled';
}

function formatEventTime(startTime, isLive) {
  if (isLive) return 'Live Now';
  
  const now = new Date();
  const diffMs = startTime.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Started';
  if (diffMs < 60000) return 'Starting soon';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
  
  return startTime.toLocaleDateString();
}

function canJoinEvent(event) {
  const participantCount = event.participantCount || 0;
  return event.status === 'live' && participantCount < event.maxParticipants;
}

function getJoinButtonText(event, isLive) {
  if (!isLive) return 'Starting Soon';
  if (!canJoinEvent(event)) return 'Full';
  return 'Join Now';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event filtering
function setActiveFilter(filter) {
  currentFilter = filter;
  
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  
  // Reload events with new filter
  loadEvents();
}

// Update statistics
async function updateStats() {
  try {
    const eventsRef = collection(db, 'stages_events');
    
    // Get live events count
    const liveQuery = query(eventsRef, where('status', '==', 'live'));
    const liveSnapshot = await getDocs(liveQuery);
    const liveCount = liveSnapshot.size;
    
    // Calculate total participants
    let totalParticipants = 0;
    liveSnapshot.forEach(doc => {
      const event = doc.data();
      totalParticipants += event.participantCount || 0;
    });
    
    // Update display
    const liveCountEl = document.getElementById('live-count');
    const totalParticipantsEl = document.getElementById('total-participants');
    
    if (liveCountEl) liveCountEl.textContent = liveCount;
    if (totalParticipantsEl) totalParticipantsEl.textContent = totalParticipants;
    
  } catch (error) {
    console.error('❌ Error updating stats:', error);
  }
}

// Modal functions
function openCreateEventModal() {
  if (!currentUser) {
    window.toast.info('Please sign in to create events.');
    return;
  }
  
  const modal = document.getElementById('event-modal-backdrop');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeCreateEventModal() {
  const modal = document.getElementById('event-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
  
  // Reset form
  const form = document.getElementById('create-event-form');
  if (form) form.reset();
}

// Handle event creation
async function handleCreateEvent(e) {
  e.preventDefault();
  
  if (!currentUser) {
    window.toast.info('Please sign in to create events.');
    return;
  }
  
  const formData = new FormData(e.target);
  const eventData = {
    title: formData.get('title'),
    eventType: formData.get('eventType'),
    description: formData.get('description') || '',
    startTime: new Date(formData.get('startTime')),
    maxParticipants: parseInt(formData.get('maxParticipants')),
    hostUid: currentUser.uid,
    hostName: currentUser.displayName || 'Unknown Host',
    status: 'scheduled',
    participantCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  try {
    const eventsRef = collection(db, 'stages_events');
    await addDoc(eventsRef, eventData);
    
    // Track event creation for passport
    if (typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('stages', `Created ${eventData.eventType} event: ${eventData.title}`);
    }
    
    // Update daily missions progress for event creation
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      try {
        await window.DailyMissionsAPI.updateProgress('events_joined', 1, {
          eventType: eventData.eventType,
          eventTitle: eventData.title,
          action: 'created',
          location: 'stages'
        });
      } catch (error) {
        console.error('❌ Error tracking event creation:', error);
      }
    }
    
    console.log('✅ Event created successfully');
    closeCreateEventModal();
    showSuccess('Event created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating event:', error);
    showError('Failed to create event. Please try again.');
  }
}

// Quick action functions
function createAudioRoom() {
  if (!currentUser) {
    window.toast.info('Please sign in to create events.');
    return;
  }
  
  // Pre-fill form with audio room defaults
  openCreateEventModal();
  document.getElementById('event-type').value = 'audio';
  document.getElementById('event-title').value = 'Audio Chat Room';
  document.getElementById('event-description').value = 'Join the conversation and share your thoughts!';
}

function createVideoPod() {
  if (!currentUser) {
    window.toast.info('Please sign in to create events.');
    return;
  }
  
  openCreateEventModal();
  document.getElementById('event-type').value = 'video';
  document.getElementById('event-title').value = 'Video Pod';
  document.getElementById('max-participants').value = '6';
  document.getElementById('event-description').value = 'Small group video chat for deeper connections.';
}

function createHotSeat() {
  if (!currentUser) {
    window.toast.info('Please sign in to create events.');
    return;
  }
  
  openCreateEventModal();
  document.getElementById('event-type').value = 'hotseat';
  document.getElementById('event-title').value = 'Hot Seat Q&A';
  document.getElementById('max-participants').value = '20';
  document.getElementById('event-description').value = 'Take the hot seat and answer rapid-fire questions from the audience!';
}

// Event detail modal functions
async function openEventDetail(eventId) {
  selectedEventId = eventId;
  
  try {
    const eventDoc = await getDoc(doc(db, 'stages_events', eventId));
    if (!eventDoc.exists()) {
      showError('Event not found.');
      return;
    }
    
    const event = eventDoc.data();
    
    // Populate modal
    document.getElementById('detail-event-title').textContent = event.title;
    document.getElementById('detail-event-type').textContent = `${getEventTypeIcon(event.eventType)} ${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)} Room`;
    document.getElementById('detail-event-host').textContent = event.hostName || 'Unknown Host';
    document.getElementById('detail-event-time').textContent = formatEventTime(event.startTime?.toDate ? event.startTime.toDate() : new Date(event.startTime), event.status === 'live');
    document.getElementById('detail-participant-count').textContent = `${event.participantCount || 0}/${event.maxParticipants}`;
    document.getElementById('detail-event-description').textContent = event.description || 'No description provided.';
    
    // Load participants
    loadEventParticipants(eventId);
    
    // Update join/leave button
    updateJoinLeaveButton(eventId, event);
    
    // Show modal
    const modal = document.getElementById('event-detail-backdrop');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    
  } catch (error) {
    console.error('❌ Error loading event details:', error);
    showError('Failed to load event details.');
  }
}

function closeEventDetailModal() {
  const modal = document.getElementById('event-detail-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
  
  // Clean up participants listener
  if (participantsListener) {
    participantsListener();
    participantsListener = null;
  }
  
  selectedEventId = null;
}

// Load event participants
function loadEventParticipants(eventId) {
  const participantsRef = collection(db, 'stages_events', eventId, 'participants');
  const q = query(participantsRef, orderBy('joinedAt', 'desc'));
  
  if (participantsListener) {
    participantsListener();
  }
  
  participantsListener = onSnapshot(q, (snapshot) => {
    const participantsGrid = document.getElementById('participants-grid');
    const countBadge = document.getElementById('participant-count-badge');
    
    if (!participantsGrid) return;
    
    participantsGrid.innerHTML = '';
    
    if (countBadge) countBadge.textContent = snapshot.size;
    
    snapshot.forEach(doc => {
      const participant = doc.data();
      const participantEl = document.createElement('div');
      participantEl.className = 'participant-item';
      participantEl.innerHTML = `
        <div class="participant-avatar" data-testid="avatar-${participant.uid}">
          ${participant.displayName ? participant.displayName.charAt(0).toUpperCase() : '?'}
        </div>
        <span class="participant-name" data-testid="name-${participant.uid}">
          ${escapeHtml(participant.displayName || 'Unknown')}
          ${participant.role === 'host' ? ' 👑' : ''}
        </span>
      `;
      participantsGrid.appendChild(participantEl);
    });
  });
}

// Update join/leave button based on user participation
async function updateJoinLeaveButton(eventId, event) {
  if (!currentUser) return;
  
  const joinBtn = document.getElementById('join-event-btn');
  const leaveBtn = document.getElementById('leave-event-btn');
  
  try {
    const participantDoc = await getDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid));
    const isParticipant = participantDoc.exists();
    
    if (joinBtn) {
      joinBtn.style.display = isParticipant ? 'none' : 'block';
      joinBtn.disabled = !canJoinEvent(event);
    }
    
    if (leaveBtn) {
      leaveBtn.style.display = isParticipant ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('❌ Error checking participation:', error);
  }
}

// Join event function
async function joinEvent() {
  if (!currentUser || !selectedEventId) return;
  
  try {
    // Add participant
    const participantData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      role: 'participant',
      joinedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'stages_events', selectedEventId, 'participants', currentUser.uid), participantData);
    
    // Update participant count
    const eventRef = doc(db, 'stages_events', selectedEventId);
    const eventDoc = await getDoc(eventRef);
    if (eventDoc.exists()) {
      const currentCount = eventDoc.data().participantCount || 0;
      await updateDoc(eventRef, { participantCount: currentCount + 1 });
    }
    
    console.log('✅ Joined event successfully');
    showSuccess('Successfully joined the event!');
    
  } catch (error) {
    console.error('❌ Error joining event:', error);
    showError('Failed to join event. Please try again.');
  }
}

// Leave event function
async function leaveEvent() {
  if (!currentUser || !selectedEventId) return;
  
  try {
    // Remove participant
    await deleteDoc(doc(db, 'stages_events', selectedEventId, 'participants', currentUser.uid));
    
    // Update participant count
    const eventRef = doc(db, 'stages_events', selectedEventId);
    const eventDoc = await getDoc(eventRef);
    if (eventDoc.exists()) {
      const currentCount = eventDoc.data().participantCount || 0;
      await updateDoc(eventRef, { participantCount: Math.max(0, currentCount - 1) });
    }
    
    console.log('✅ Left event successfully');
    showSuccess('Successfully left the event.');
    
  } catch (error) {
    console.error('❌ Error leaving event:', error);
    showError('Failed to leave event. Please try again.');
  }
}

// Quick join function
async function quickJoinEvent(eventId) {
  if (!currentUser) {
    window.toast.info('Please sign in to join events.');
    return;
  }
  
  try {
    // Get event details to determine type
    const eventDoc = await getDoc(doc(db, 'stages_events', eventId));
    if (!eventDoc.exists()) {
      showError('Event not found.');
      return;
    }
    
    const event = eventDoc.data();
    
    // Check if event can be joined
    if (!canJoinEvent(event)) {
      showError('Cannot join this event (full or not live).');
      return;
    }
    
    // Join the event
    selectedEventId = eventId;
    await joinEvent();
    
    // Update daily missions progress for joining events
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      try {
        await window.DailyMissionsAPI.updateProgress('events_joined', 1, {
          eventType: event.eventType,
          eventTitle: event.title,
          action: 'joined',
          location: 'stages'
        });
      } catch (error) {
        console.error('❌ Error tracking event join:', error);
      }
    }
    
    // Navigate to appropriate interface based on event type
    if (event.eventType === 'audio') {
      // Redirect to audio room
      window.location.href = `audio-room.html?eventId=${eventId}`;
    } else if (event.eventType === 'video') {
      // Redirect to video pod
      window.location.href = `video-pod.html?eventId=${eventId}`;
    } else if (event.eventType === 'hotseat') {
      // Redirect to hot seat (to be implemented)
      showSuccess('Hot seat feature coming soon! Joined as participant for now.');
    } else {
      showSuccess('Successfully joined the event!');
    }
    
  } catch (error) {
    console.error('❌ Error joining event:', error);
    showError('Failed to join event. Please try again.');
  }
}

// Utility functions
function showSuccess(message) {
  console.log('✅ Success:', message);
  window.toast.success(message);
}

function showError(message) {
  console.error('❌ Error:', message);
  window.toast.error(message);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventsListener) eventsListener();
  if (participantsListener) participantsListener();
});

// Export functions for global access
window.openCreateEventModal = openCreateEventModal;
window.closeCreateEventModal = closeCreateEventModal;
window.openEventDetail = openEventDetail;
window.closeEventDetailModal = closeEventDetailModal;
window.joinEvent = joinEvent;
window.leaveEvent = leaveEvent;
window.quickJoinEvent = quickJoinEvent;
window.createAudioRoom = createAudioRoom;
window.createVideoPod = createVideoPod;
window.createHotSeat = createHotSeat;

console.log('🎤 Stages module loaded successfully!');