// Audio Room JavaScript - Live Audio Chat Platform
import {
  auth,
  db,
  waitForAuth,
  getUserDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  limit,
  getDocs
} from "../js/firebase.js";

import '../js/passport-api.js'; // Load PassportAPI globally
import '../js/toast-notifications.js'; // Load toast notifications

console.log('🎙️ Audio Room module loading...');

// Global variables
let currentUser = null;
let eventId = null;
let currentEvent = null;
let isHost = false;
let userRole = 'audience'; // 'host', 'speaker', 'audience'
let isMuted = true;
let hasRaisedHand = false;

// Real-time listeners
let eventListener = null;
let participantsListener = null;
let chatListener = null;
let queueListener = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🎙️ Audio Room initializing...');
  
  // Get event ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  eventId = urlParams.get('eventId');
  
  if (!eventId) {
    console.error('❌ No event ID provided');
    window.toast.error('Error: No event ID provided');
    window.location.href = 'stages.html';
    return;
  }
  
  // Wait for auth state
  currentUser = await waitForAuth();
  if (!currentUser) {
    window.toast.info('Please sign in to join the audio room.');
    window.location.href = '../login.html';
    return;
  }
  
  // Get user profile data (read-only)
  const userProfile = await getUserDoc(currentUser.uid);
  if (userProfile) {
    currentUser.displayName = userProfile.displayName || currentUser.displayName;
  }
  console.log('✅ User authenticated:', currentUser.displayName);
  
  // Initialize the audio room
  await initializeAudioRoom();
});

// Initialize audio room
async function initializeAudioRoom() {
  try {
    // Load event details
    await loadEventDetails();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start real-time listeners
    startRealtimeListeners();
    
    // Join the room as participant
    await joinAudioRoom();
    
    console.log('✅ Audio room initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing audio room:', error);
    window.toast.error('Failed to join audio room. Please try again.');
    window.location.href = 'stages.html';
  }
}

// Load event details
async function loadEventDetails() {
  try {
    const eventDoc = await getDoc(doc(db, 'stages_events', eventId));
    if (!eventDoc.exists()) {
      throw new Error('Event not found');
    }
    
    currentEvent = eventDoc.data();
    isHost = currentEvent.hostUid === currentUser.uid;
    
    // Update UI with event details
    document.getElementById('room-title').textContent = currentEvent.title;
    document.getElementById('room-description').textContent = currentEvent.description || 'Welcome to the audio room!';
    
    // Show host controls if user is host
    if (isHost) {
      document.getElementById('host-controls').style.display = 'flex';
      userRole = 'host';
    }
    
    console.log('📊 Event loaded:', currentEvent.title);
    
  } catch (error) {
    console.error('❌ Error loading event:', error);
    throw error;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Leave room button
  document.getElementById('leave-room-btn')?.addEventListener('click', leaveAudioRoom);
  
  // Interaction buttons
  document.getElementById('raise-hand-btn')?.addEventListener('click', toggleRaiseHand);
  document.getElementById('reaction-btn')?.addEventListener('click', toggleReactions);
  document.getElementById('mute-btn')?.addEventListener('click', toggleMute);
  
  // Chat functionality
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  
  if (chatInput && sendBtn) {
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    
    sendBtn.addEventListener('click', sendChatMessage);
  }
  
  // Reaction buttons
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      sendReaction(this.dataset.reaction);
    });
  });
  
  // Host controls
  document.getElementById('mute-all-btn')?.addEventListener('click', muteAllParticipants);
  document.getElementById('manage-speakers-btn')?.addEventListener('click', openSpeakerModal);
  
  // Audience controls
  document.getElementById('toggle-audience-btn')?.addEventListener('click', toggleAudienceList);
  
  // Additional event listeners (converted from onclick handlers)
  document.getElementById('close-speaker-modal-btn')?.addEventListener('click', closeSpeakerModal);
  document.getElementById('close-room-settings-btn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('cancel-room-settings-btn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('save-room-settings-btn')?.addEventListener('click', saveRoomSettings);
  
  console.log('🎯 Event listeners setup complete');
}

// Start real-time listeners
function startRealtimeListeners() {
  // Listen to event updates
  eventListener = onSnapshot(doc(db, 'stages_events', eventId), (doc) => {
    if (doc.exists()) {
      currentEvent = doc.data();
      updateEventDisplay();
    }
  });
  
  // Listen to participants
  const participantsRef = collection(db, 'stages_events', eventId, 'participants');
  const participantsQuery = query(participantsRef, orderBy('joinedAt', 'desc'));
  
  participantsListener = onSnapshot(participantsQuery, (snapshot) => {
    updateParticipantsList(snapshot.docs);
    updateParticipantCount(snapshot.size);
  });
  
  // Listen to chat messages
  const chatRef = collection(db, 'stages_events', eventId, 'chat');
  const chatQuery = query(chatRef, orderBy('timestamp', 'desc'), limit(100));
  
  chatListener = onSnapshot(chatQuery, (snapshot) => {
    updateChatMessages(snapshot.docs.reverse());
  });
  
  // Listen to speaker queue (raised hands)
  const queueRef = collection(db, 'stages_events', eventId, 'speaker_queue');
  const queueQuery = query(queueRef, where('status', '==', 'pending'), orderBy('queuedAt', 'asc'));
  
  queueListener = onSnapshot(queueQuery, (snapshot) => {
    updateSpeakerQueue(snapshot.docs);
  });
  
  console.log('👂 Real-time listeners started');
}

// Join audio room
async function joinAudioRoom() {
  try {
    // Add user as participant
    const participantData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      role: userRole,
      isMuted: true,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    };
    
    await setDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid), participantData);
    
    // Update event participant count
    const eventRef = doc(db, 'stages_events', eventId);
    const eventDoc = await getDoc(eventRef);
    if (eventDoc.exists()) {
      const currentCount = eventDoc.data().participantCount || 0;
      await updateDoc(eventRef, { 
        participantCount: currentCount + 1,
        status: 'live' // Mark event as live when first person joins
      });
    }
    
    // Send join message to chat
    await sendSystemMessage(`${currentUser.displayName || 'Someone'} joined the room`);
    
    console.log('✅ Joined audio room successfully');
    
    // Track audio room participation for passport
    if (typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('audio-room', 'Joined audio room session');
      window.PassportAPI.awardStamp('stage_performer', 'audio-room', 'Joined audio room event');
    }
    
    // Update daily missions progress for joining events
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      try {
        await window.DailyMissionsAPI.updateProgress('events_joined', 1, {
          eventType: 'audio',
          eventTitle: currentEvent.title,
          action: 'joined',
          location: 'audio-room'
        });
      } catch (error) {
        console.error('❌ Error tracking audio room join:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error joining audio room:', error);
    throw error;
  }
}

// Leave audio room
async function leaveAudioRoom() {
  try {
    // Remove participant
    await deleteDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid));
    
    // Update participant count
    const eventRef = doc(db, 'stages_events', eventId);
    const eventDoc = await getDoc(eventRef);
    if (eventDoc.exists()) {
      const currentCount = eventDoc.data().participantCount || 0;
      await updateDoc(eventRef, { 
        participantCount: Math.max(0, currentCount - 1)
      });
    }
    
    // Send leave message
    await sendSystemMessage(`${currentUser.displayName || 'Someone'} left the room`);
    
    // Clean up listeners
    cleanupListeners();
    
    // Redirect back to stages
    window.location.href = 'stages.html';
    
  } catch (error) {
    console.error('❌ Error leaving room:', error);
    // Force redirect even if error occurs
    window.location.href = 'stages.html';
  }
}

// Update event display
function updateEventDisplay() {
  // Update participant count
  const totalEl = document.getElementById('total-participants');
  if (totalEl) {
    totalEl.textContent = currentEvent.participantCount || 0;
  }
  
  // Update any other event-specific information
  if (currentEvent.status === 'ended') {
    alert('This audio room has ended.');
    window.location.href = 'stages.html';
  }
}

// Update participants list
function updateParticipantsList(participantDocs) {
  const speakersGrid = document.getElementById('speakers-grid');
  const audienceList = document.getElementById('audience-list');
  const audienceCount = document.getElementById('audience-count');
  
  if (!speakersGrid || !audienceList) return;
  
  // Clear current lists
  speakersGrid.innerHTML = '';
  audienceList.innerHTML = '';
  
  let speakers = [];
  let audience = [];
  
  participantDocs.forEach(doc => {
    const participant = doc.data();
    if (participant.role === 'host' || participant.role === 'speaker') {
      speakers.push(participant);
    } else {
      audience.push(participant);
    }
  });
  
  // Display speakers
  speakers.forEach(speaker => {
    const speakerCard = createSpeakerCard(speaker);
    speakersGrid.appendChild(speakerCard);
  });
  
  // Display audience
  audience.forEach(member => {
    const memberEl = createAudienceMember(member);
    audienceList.appendChild(memberEl);
  });
  
  // Update audience count
  if (audienceCount) {
    audienceCount.textContent = audience.length;
  }
}

// Create speaker card
function createSpeakerCard(speaker) {
  const card = document.createElement('div');
  card.className = `speaker-card ${speaker.role}`;
  card.dataset.testid = `speaker-${speaker.uid}`;
  
  if (speaker.isSpeaking) {
    card.classList.add('speaking');
  }
  
  card.innerHTML = `
    <div class="speaker-avatar" data-testid="avatar-${speaker.uid}">
      ${speaker.displayName ? speaker.displayName.charAt(0).toUpperCase() : '?'}
      <div class="role-indicator">
        ${speaker.role === 'host' ? '👑' : '🎙️'}
      </div>
    </div>
    
    <div class="speaker-name" data-testid="name-${speaker.uid}">
      ${escapeHtml(speaker.displayName || 'Unknown')}
    </div>
    
    <div class="speaker-status" data-testid="status-${speaker.uid}">
      ${speaker.isMuted ? '🔇 Muted' : '🔊 Unmuted'}
    </div>
    
    <div class="speaker-controls">
      ${isHost && speaker.uid !== currentUser.uid ? `
        <button class="speaker-action-btn ${speaker.isMuted ? 'muted' : ''}" 
                onclick="toggleParticipantMute('${speaker.uid}')"
                data-testid="button-mute-${speaker.uid}">
          ${speaker.isMuted ? '🔇' : '🔊'}
        </button>
        <button class="speaker-action-btn" 
                onclick="demoteParticipant('${speaker.uid}')"
                data-testid="button-demote-${speaker.uid}">
          👇
        </button>
      ` : ''}
    </div>
  `;
  
  return card;
}

// Create audience member
function createAudienceMember(member) {
  const memberEl = document.createElement('div');
  memberEl.className = 'audience-member';
  memberEl.dataset.testid = `audience-${member.uid}`;
  
  memberEl.innerHTML = `
    <div class="member-avatar" data-testid="avatar-${member.uid}">
      ${member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
    </div>
    <div class="member-name" data-testid="name-${member.uid}">
      ${escapeHtml(member.displayName || 'Unknown')}
    </div>
    <div class="member-status" data-testid="status-${member.uid}">
      ${member.hasRaisedHand ? '🙋 Raised' : '👂 Listening'}
    </div>
  `;
  
  return memberEl;
}

// Update participant count
function updateParticipantCount(count) {
  const totalEl = document.getElementById('total-participants');
  if (totalEl) {
    totalEl.textContent = count;
  }
}

// Update chat messages
function updateChatMessages(messageDocs) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  chatMessages.innerHTML = '';
  
  messageDocs.forEach(doc => {
    const message = doc.data();
    const messageEl = createChatMessage(message);
    chatMessages.appendChild(messageEl);
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Create chat message element
function createChatMessage(message) {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message';
  messageEl.dataset.testid = `message-${message.uid || 'system'}`;
  
  const timestamp = message.timestamp?.toDate ? message.timestamp.toDate() : new Date();
  const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (message.type === 'system') {
    messageEl.innerHTML = `
      <div class="message-content system">
        ${escapeHtml(message.content)}
      </div>
    `;
  } else {
    messageEl.innerHTML = `
      <div class="message-header">
        <div class="message-avatar">
          ${message.displayName ? message.displayName.charAt(0).toUpperCase() : '?'}
        </div>
        <div class="message-author">${escapeHtml(message.displayName || 'Unknown')}</div>
        <div class="message-time">${timeString}</div>
      </div>
      <div class="message-content">${escapeHtml(message.content)}</div>
    `;
  }
  
  return messageEl;
}

// Send chat message
async function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  if (!chatInput || !chatInput.value.trim()) return;
  
  const messageContent = chatInput.value.trim();
  
  try {
    const chatData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      content: messageContent,
      timestamp: serverTimestamp(),
      type: 'user'
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'chat'), chatData);
    
    // Clear input
    chatInput.value = '';
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}

// Send system message
async function sendSystemMessage(content) {
  try {
    const systemData = {
      content: content,
      timestamp: serverTimestamp(),
      type: 'system'
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'chat'), systemData);
    
  } catch (error) {
    console.error('❌ Error sending system message:', error);
  }
}

// Toggle raise hand
async function toggleRaiseHand() {
  try {
    hasRaisedHand = !hasRaisedHand;
    const btn = document.getElementById('raise-hand-btn');
    
    if (hasRaisedHand) {
      // Add to speaker queue
      const queueData = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'Unknown',
        status: 'pending',
        queuedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'stages_events', eventId, 'speaker_queue', currentUser.uid), queueData);
      
      // Update participant
      await updateDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid), {
        hasRaisedHand: true
      });
      
      btn.classList.add('active');
      btn.querySelector('.btn-text').textContent = 'Lower Hand';
      
    } else {
      // Remove from queue
      await deleteDoc(doc(db, 'stages_events', eventId, 'speaker_queue', currentUser.uid));
      
      // Update participant
      await updateDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid), {
        hasRaisedHand: false
      });
      
      btn.classList.remove('active');
      btn.querySelector('.btn-text').textContent = 'Raise Hand';
    }
    
  } catch (error) {
    console.error('❌ Error toggling raise hand:', error);
    alert('Failed to update hand status. Please try again.');
  }
}

// Toggle reactions panel
function toggleReactions() {
  const reactionsPanel = document.getElementById('quick-reactions');
  const btn = document.getElementById('reaction-btn');
  
  if (reactionsPanel.style.display === 'none' || !reactionsPanel.style.display) {
    reactionsPanel.style.display = 'flex';
    btn.classList.add('active');
  } else {
    reactionsPanel.style.display = 'none';
    btn.classList.remove('active');
  }
}

// Send reaction
async function sendReaction(reaction) {
  try {
    const reactionData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      reactionType: reaction,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'reactions'), reactionData);
    
    // Create flying animation
    createFlyingReaction(reaction);
    
    // Send to chat
    await sendSystemMessage(`${currentUser.displayName || 'Someone'} reacted with ${reaction}`);
    
    // Update daily missions progress for reactions given
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      try {
        await window.DailyMissionsAPI.updateProgress('reactions_given', 1, {
          reactionType: reaction,
          eventType: 'audio',
          location: 'audio-room'
        });
      } catch (error) {
        console.error('❌ Error tracking reaction:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error sending reaction:', error);
  }
}

// Create flying reaction animation
function createFlyingReaction(reaction) {
  const container = document.getElementById('reaction-animations');
  if (!container) return;
  
  const reactionEl = document.createElement('div');
  reactionEl.className = 'flying-reaction';
  reactionEl.textContent = reaction;
  
  // Random position
  reactionEl.style.left = Math.random() * 80 + 10 + '%';
  reactionEl.style.bottom = '10px';
  
  container.appendChild(reactionEl);
  
  // Remove after animation
  setTimeout(() => {
    container.removeChild(reactionEl);
  }, 3000);
}

// Toggle mute
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('mute-btn');
  const icon = document.getElementById('mute-icon');
  
  if (isMuted) {
    btn.classList.add('muted');
    btn.title = 'Unmute';
    icon.textContent = '🔇';
  } else {
    btn.classList.remove('muted');
    btn.title = 'Mute';
    icon.textContent = '🎙️';
  }
  
  // Update participant status
  updateParticipantMuteStatus(isMuted);
}

// Update participant mute status
async function updateParticipantMuteStatus(muted) {
  try {
    await updateDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid), {
      isMuted: muted,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Error updating mute status:', error);
  }
}

// Update speaker queue
function updateSpeakerQueue(queueDocs) {
  const queueList = document.getElementById('queue-list');
  if (!queueList) return;
  
  queueList.innerHTML = '';
  
  if (queueDocs.length === 0) {
    queueList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No raised hands</p>';
    return;
  }
  
  queueDocs.forEach(doc => {
    const queueItem = doc.data();
    const itemEl = createQueueItem(queueItem);
    queueList.appendChild(itemEl);
  });
}

// Create queue item
function createQueueItem(queueItem) {
  const itemEl = document.createElement('div');
  itemEl.className = 'queue-item';
  itemEl.dataset.testid = `queue-${queueItem.uid}`;
  
  itemEl.innerHTML = `
    <div class="queue-user">
      <div class="queue-avatar">
        ${queueItem.displayName ? queueItem.displayName.charAt(0).toUpperCase() : '?'}
      </div>
      <span>${escapeHtml(queueItem.displayName || 'Unknown')}</span>
    </div>
    
    ${isHost ? `
      <div class="queue-actions">
        <button class="queue-action-btn accept" 
                onclick="promoteToSpeaker('${queueItem.uid}')"
                data-testid="button-accept-${queueItem.uid}">
          ✓
        </button>
        <button class="queue-action-btn reject" 
                onclick="rejectSpeakerRequest('${queueItem.uid}')"
                data-testid="button-reject-${queueItem.uid}">
          ✗
        </button>
      </div>
    ` : ''}
  `;
  
  return itemEl;
}

// Host controls - Promote to speaker
async function promoteToSpeaker(uid) {
  if (!isHost) return;
  
  try {
    // Update participant role
    await updateDoc(doc(db, 'stages_events', eventId, 'participants', uid), {
      role: 'speaker'
    });
    
    // Remove from queue
    await deleteDoc(doc(db, 'stages_events', eventId, 'speaker_queue', uid));
    
    // Get user info for notification
    const participantDoc = await getDoc(doc(db, 'stages_events', eventId, 'participants', uid));
    if (participantDoc.exists()) {
      const participant = participantDoc.data();
      await sendSystemMessage(`${participant.displayName || 'Someone'} was promoted to speaker`);
    }
    
  } catch (error) {
    console.error('❌ Error promoting to speaker:', error);
    alert('Failed to promote user. Please try again.');
  }
}

// Host controls - Reject speaker request
async function rejectSpeakerRequest(uid) {
  if (!isHost) return;
  
  try {
    // Remove from queue
    await deleteDoc(doc(db, 'stages_events', eventId, 'speaker_queue', uid));
    
    // Update participant
    await updateDoc(doc(db, 'stages_events', eventId, 'participants', uid), {
      hasRaisedHand: false
    });
    
  } catch (error) {
    console.error('❌ Error rejecting speaker request:', error);
  }
}

// Host controls - Demote participant
async function demoteParticipant(uid) {
  if (!isHost) return;
  
  try {
    await updateDoc(doc(db, 'stages_events', eventId, 'participants', uid), {
      role: 'audience'
    });
    
    // Get user info for notification
    const participantDoc = await getDoc(doc(db, 'stages_events', eventId, 'participants', uid));
    if (participantDoc.exists()) {
      const participant = participantDoc.data();
      await sendSystemMessage(`${participant.displayName || 'Someone'} was moved to audience`);
    }
    
  } catch (error) {
    console.error('❌ Error demoting participant:', error);
    alert('Failed to demote user. Please try again.');
  }
}

// Host controls - Toggle participant mute
async function toggleParticipantMute(uid) {
  if (!isHost) return;
  
  try {
    const participantDoc = await getDoc(doc(db, 'stages_events', eventId, 'participants', uid));
    if (participantDoc.exists()) {
      const participant = participantDoc.data();
      const newMuteStatus = !participant.isMuted;
      
      await updateDoc(doc(db, 'stages_events', eventId, 'participants', uid), {
        isMuted: newMuteStatus
      });
      
      await sendSystemMessage(`${participant.displayName || 'Someone'} was ${newMuteStatus ? 'muted' : 'unmuted'} by host`);
    }
    
  } catch (error) {
    console.error('❌ Error toggling participant mute:', error);
    alert('Failed to toggle mute. Please try again.');
  }
}

// Host controls - Mute all participants
async function muteAllParticipants() {
  if (!isHost) return;
  
  try {
    const participantsRef = collection(db, 'stages_events', eventId, 'participants');
    const snapshot = await getDocs(participantsRef);
    
    const promises = snapshot.docs.map(doc => {
      if (doc.id !== currentUser.uid) {
        return updateDoc(doc.ref, { isMuted: true });
      }
    });
    
    await Promise.all(promises);
    await sendSystemMessage('Host muted all participants');
    
  } catch (error) {
    console.error('❌ Error muting all participants:', error);
    alert('Failed to mute all participants. Please try again.');
  }
}

// Toggle audience list
function toggleAudienceList() {
  const audienceList = document.getElementById('audience-list');
  const toggleBtn = document.getElementById('toggle-audience-btn');
  
  if (audienceList.style.display === 'none') {
    audienceList.style.display = 'block';
    toggleBtn.textContent = 'Hide';
  } else {
    audienceList.style.display = 'none';
    toggleBtn.textContent = 'Show';
  }
}

// Modal functions - Speaker management
function openSpeakerModal() {
  if (!isHost) return;
  
  const modal = document.getElementById('speaker-modal-backdrop');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadSpeakerManagement();
  }
}

function closeSpeakerModal() {
  const modal = document.getElementById('speaker-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Load speaker management data
async function loadSpeakerManagement() {
  try {
    const participantsSnapshot = await getDocs(collection(db, 'stages_events', eventId, 'participants'));
    const queueSnapshot = await getDocs(collection(db, 'stages_events', eventId, 'speaker_queue'));
    
    // Update modal content with current data
    // This would populate the speaker management interface
    console.log('📊 Speaker management data loaded');
    
  } catch (error) {
    console.error('❌ Error loading speaker management:', error);
  }
}

// Room settings
function closeSettingsModal() {
  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

async function saveRoomSettings() {
  if (!isHost) return;
  
  try {
    // Get form values
    const theme = document.getElementById('room-theme').value;
    const autoMute = document.getElementById('auto-mute-audience').checked;
    const allowReactions = document.getElementById('allow-reactions').checked;
    const moderateChat = document.getElementById('moderate-chat').checked;
    
    // Update event settings
    await updateDoc(doc(db, 'stages_events', eventId), {
      settings: {
        theme,
        autoMuteAudience: autoMute,
        allowReactions,
        moderateChat
      },
      updatedAt: serverTimestamp()
    });
    
    closeSettingsModal();
    alert('Room settings saved successfully!');
    
  } catch (error) {
    console.error('❌ Error saving room settings:', error);
    alert('Failed to save settings. Please try again.');
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Cleanup listeners
function cleanupListeners() {
  if (eventListener) eventListener();
  if (participantsListener) participantsListener();
  if (chatListener) chatListener();
  if (queueListener) queueListener();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupListeners);

// Export functions for global access
window.promoteToSpeaker = promoteToSpeaker;
window.rejectSpeakerRequest = rejectSpeakerRequest;
window.demoteParticipant = demoteParticipant;
window.toggleParticipantMute = toggleParticipantMute;
window.closeSpeakerModal = closeSpeakerModal;
window.closeSettingsModal = closeSettingsModal;
window.saveRoomSettings = saveRoomSettings;

console.log('🎙️ Audio Room module loaded successfully!');