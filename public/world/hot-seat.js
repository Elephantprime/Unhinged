// Hot Seat JavaScript - Q&A Spotlight Platform
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
  serverTimestamp
} from "../js/firebase.js";

import '../js/passport-api.js'; // Load PassportAPI globally
import '../js/toast-notifications.js'; // Load toast notifications

// All Firebase functions imported from firebase.js

console.log('🔥 Hot Seat module loading...');

// Global variables
let currentUser = null;
let eventId = null;
let currentEvent = null;
let isHost = false;
let isInSeat = false;
let queuePosition = -1;
let sessionTimer = null;
let sessionStartTime = null;

// Real-time listeners
let eventListener = null;
let participantsListener = null;
let questionsListener = null;
let queueListener = null;
let seatListener = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔥 Hot Seat initializing...');
  
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
    window.toast.info('Please sign in to join the hot seat session.');
    window.location.href = '../login.html';
    return;
  }
  
  // Get user profile data (read-only)
  const userProfile = await getUserDoc(currentUser.uid);
  if (userProfile) {
    currentUser.displayName = userProfile.displayName || currentUser.displayName;
  }
  console.log('✅ User authenticated:', currentUser.displayName);
  
  // Track hot seat visit for passport
  if (typeof window.PassportAPI !== 'undefined') {
    window.PassportAPI.recordTravel('hot-seat', 'Entered hot seat session');
    window.PassportAPI.checkLocationStamps('hot-seat');
  }
  
  // Initialize the hot seat
  await initializeHotSeat();
});

// Initialize hot seat
async function initializeHotSeat() {
  try {
    // Load event details
    await loadEventDetails();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start real-time listeners
    startRealtimeListeners();
    
    // Join the session as participant
    await joinHotSeatSession();
    
    console.log('✅ Hot seat initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing hot seat:', error);
    window.toast.error('Failed to join hot seat session. Please try again.');
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
    document.getElementById('seat-title').textContent = currentEvent.title;
    document.getElementById('seat-description').textContent = currentEvent.description || 'Welcome to the hot seat Q&A!';
    
    // Show host controls if user is host
    if (isHost) {
      document.getElementById('host-feed-controls').style.display = 'flex';
      showHostControls();
    }
    
    console.log('📊 Event loaded:', currentEvent.title);
    
  } catch (error) {
    console.error('❌ Error loading event:', error);
    throw error;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Leave session button
  document.getElementById('leave-seat-btn')?.addEventListener('click', leaveHotSeatSession);
  
  // Hot seat controls
  document.getElementById('take-seat-btn')?.addEventListener('click', takeHotSeat);
  document.getElementById('end-turn-btn')?.addEventListener('click', endMyTurn);
  document.getElementById('remove-participant-btn')?.addEventListener('click', removeFromSeat);
  
  // Queue controls
  document.getElementById('join-queue-btn')?.addEventListener('click', joinQueue);
  
  // Question submission
  document.getElementById('submit-question-btn')?.addEventListener('click', submitQuestion);
  const questionInput = document.getElementById('question-input');
  if (questionInput) {
    questionInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitQuestion();
      }
    });
  }
  
  // Audience interactions
  document.getElementById('applause-btn')?.addEventListener('click', sendApplause);
  document.getElementById('reaction-btn')?.addEventListener('click', toggleReactions);
  
  // Reaction buttons
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      sendReaction(this.dataset.reaction);
    });
  });
  
  // Host controls
  document.getElementById('seat-settings-btn')?.addEventListener('click', openHostModal);
  document.getElementById('next-participant-btn')?.addEventListener('click', nextParticipant);
  document.getElementById('clear-queue-btn')?.addEventListener('click', clearQueue);
  document.getElementById('clear-questions-btn')?.addEventListener('click', clearQuestions);
  document.getElementById('pause-session-btn')?.addEventListener('click', pauseSession);
  document.getElementById('end-session-btn')?.addEventListener('click', endSession);
  
  // Settings and modals
  document.getElementById('close-host-modal-btn')?.addEventListener('click', closeHostModal);
  document.getElementById('close-settings-modal-btn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('cancel-settings-btn')?.addEventListener('click', closeSettingsModal);
  document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
  
  // Audience controls
  document.getElementById('toggle-audience-btn')?.addEventListener('click', toggleAudienceList);
  
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
  participantsListener = onSnapshot(
    collection(db, 'stages_events', eventId, 'participants'),
    (snapshot) => {
      updateParticipantsList(snapshot.docs);
      updateParticipantCount(snapshot.size);
    }
  );
  
  // Listen to queue
  queueListener = onSnapshot(
    query(
      collection(db, 'stages_events', eventId, 'hot_seat_queue'),
      orderBy('joinedAt', 'asc')
    ),
    (snapshot) => {
      updateQueueDisplay(snapshot.docs);
      updateUserQueuePosition(snapshot.docs);
    }
  );
  
  // Listen to questions
  questionsListener = onSnapshot(
    query(
      collection(db, 'stages_events', eventId, 'questions'),
      orderBy('submittedAt', 'desc'),
      limit(50)
    ),
    (snapshot) => {
      updateQuestionsDisplay(snapshot.docs);
    }
  );
  
  // Listen to current seat occupant
  seatListener = onSnapshot(
    query(
      collection(db, 'stages_events', eventId, 'hot_seat_queue'),
      where('status', '==', 'active'),
      limit(1)
    ),
    (snapshot) => {
      updateSeatDisplay(snapshot.docs);
    }
  );
}

// Join hot seat session
async function joinHotSeatSession() {
  try {
    const participantData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      role: isHost ? 'host' : 'participant',
      joinedAt: serverTimestamp()
    };
    
    await setDoc(
      doc(db, 'stages_events', eventId, 'participants', currentUser.uid),
      participantData
    );
    
    // Update participant count
    const eventRef = doc(db, 'stages_events', eventId);
    const eventDoc = await getDoc(eventRef);
    if (eventDoc.exists()) {
      const currentCount = eventDoc.data().participantCount || 0;
      await updateDoc(eventRef, { participantCount: currentCount + 1 });
    }
    
    console.log('✅ Joined hot seat session');
    
    // Track hot seat participation for passport
    if (typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('hot-seat', 'Joined Q&A session');
      window.PassportAPI.awardStamp('stage_performer', 'hot-seat', 'Joined hot seat Q&A session');
    }
    
  } catch (error) {
    console.error('❌ Error joining session:', error);
    throw error;
  }
}

// Take the hot seat
async function takeHotSeat() {
  if (!currentUser) return;
  
  try {
    // Check if seat is already occupied
    const activeQuery = query(
      collection(db, 'stages_events', eventId, 'hot_seat_queue'),
      where('status', '==', 'active')
    );
    const activeSnapshot = await getDocs(activeQuery);
    
    if (!activeSnapshot.empty) {
      window.toast.warning('Someone is already in the hot seat. Please wait your turn or join the queue.');
      return;
    }
    
    // Add to queue as active
    const queueData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      status: 'active',
      joinedAt: serverTimestamp(),
      startTime: serverTimestamp()
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'hot_seat_queue'), queueData);
    
    isInSeat = true;
    startSessionTimer();
    
    console.log('✅ Took the hot seat');
    showSuccess('You are now in the hot seat! Time to answer some questions.');
    
  } catch (error) {
    console.error('❌ Error taking hot seat:', error);
    showError('Failed to take the hot seat. Please try again.');
  }
}

// End my turn in hot seat
async function endMyTurn() {
  if (!currentUser || !isInSeat) return;
  
  try {
    // Remove from active seat
    const queueQuery = query(
      collection(db, 'stages_events', eventId, 'hot_seat_queue'),
      where('uid', '==', currentUser.uid),
      where('status', '==', 'active')
    );
    const queueSnapshot = await getDocs(queueQuery);
    
    queueSnapshot.forEach(async (docSnap) => {
      await deleteDoc(docSnap.ref);
    });
    
    isInSeat = false;
    stopSessionTimer();
    
    console.log('✅ Ended turn in hot seat');
    showSuccess('Thanks for being in the hot seat!');
    
  } catch (error) {
    console.error('❌ Error ending turn:', error);
    showError('Failed to end turn. Please try again.');
  }
}

// Join queue for hot seat
async function joinQueue() {
  if (!currentUser) return;
  
  try {
    // Check if already in queue
    const existingQuery = query(
      collection(db, 'stages_events', eventId, 'hot_seat_queue'),
      where('uid', '==', currentUser.uid)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      window.toast.info('You are already in the queue!');
      return;
    }
    
    // Add to queue
    const queueData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      status: 'waiting',
      joinedAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'hot_seat_queue'), queueData);
    
    console.log('✅ Joined hot seat queue');
    showSuccess('You have joined the queue for the hot seat!');
    
  } catch (error) {
    console.error('❌ Error joining queue:', error);
    showError('Failed to join queue. Please try again.');
  }
}

// Submit question
async function submitQuestion() {
  if (!currentUser) return;
  
  const questionInput = document.getElementById('question-input');
  const anonymousCheckbox = document.getElementById('anonymous-question');
  
  if (!questionInput || !questionInput.value.trim()) {
    window.toast.warning('Please enter a question first.');
    return;
  }
  
  try {
    const questionData = {
      question: questionInput.value.trim(),
      submitterUid: currentUser.uid,
      submitterName: anonymousCheckbox.checked ? 'Anonymous' : (currentUser.displayName || 'Unknown'),
      isAnonymous: anonymousCheckbox.checked,
      submittedAt: serverTimestamp(),
      status: 'pending'
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'questions'), questionData);
    
    questionInput.value = '';
    console.log('✅ Question submitted');
    showSuccess('Question submitted successfully!');
    
  } catch (error) {
    console.error('❌ Error submitting question:', error);
    showError('Failed to submit question. Please try again.');
  }
}

// Send applause
async function sendApplause() {
  sendReaction('👏');
}

// Send reaction
async function sendReaction(emoji) {
  if (!currentUser) return;
  
  try {
    const reactionData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      reaction: emoji,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, 'stages_events', eventId, 'reactions'), reactionData);
    
    // Show reaction animation
    showReactionAnimation(emoji);
    
  } catch (error) {
    console.error('❌ Error sending reaction:', error);
  }
}

// Update queue display
function updateQueueDisplay(queueDocs) {
  const queueList = document.getElementById('queue-list');
  const emptyQueue = document.getElementById('empty-queue');
  
  if (!queueList) return;
  
  // Filter waiting participants
  const waitingQueue = queueDocs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => item.status === 'waiting');
  
  if (waitingQueue.length === 0) {
    if (emptyQueue) emptyQueue.style.display = 'block';
    queueList.innerHTML = '';
    return;
  }
  
  if (emptyQueue) emptyQueue.style.display = 'none';
  
  queueList.innerHTML = waitingQueue.map((item, index) => `
    <div class="queue-item" data-testid="queue-item-${item.id}">
      <div class="queue-position">${index + 1}</div>
      <div class="queue-participant">
        <div class="participant-avatar">${item.displayName.charAt(0).toUpperCase()}</div>
        <span class="participant-name">${escapeHtml(item.displayName)}</span>
      </div>
      ${isHost ? `
        <div class="queue-actions">
          <button class="promote-btn" onclick="promoteToSeat('${item.id}')" data-testid="button-promote-${item.id}">
            Promote
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Update seat display
function updateSeatDisplay(seatDocs) {
  const emptySeat = document.getElementById('empty-seat');
  const occupiedSeat = document.getElementById('occupied-seat');
  const seatAvatar = document.getElementById('seat-avatar');
  const seatName = document.getElementById('seat-participant-name');
  const endTurnBtn = document.getElementById('end-turn-btn');
  const removeBtn = document.getElementById('remove-participant-btn');
  
  if (seatDocs.length === 0) {
    // Seat is empty
    if (emptySeat) emptySeat.style.display = 'block';
    if (occupiedSeat) occupiedSeat.style.display = 'none';
    isInSeat = false;
    stopSessionTimer();
  } else {
    // Seat is occupied
    const seatData = seatDocs[0].data();
    if (emptySeat) emptySeat.style.display = 'none';
    if (occupiedSeat) occupiedSeat.style.display = 'block';
    
    if (seatAvatar) seatAvatar.textContent = seatData.displayName.charAt(0).toUpperCase();
    if (seatName) seatName.textContent = seatData.displayName;
    
    // Show controls based on user role
    const isCurrentUser = seatData.uid === currentUser.uid;
    isInSeat = isCurrentUser;
    
    if (endTurnBtn) endTurnBtn.style.display = isCurrentUser ? 'block' : 'none';
    if (removeBtn) removeBtn.style.display = isHost && !isCurrentUser ? 'block' : 'none';
    
    if (isCurrentUser && seatData.startTime) {
      startSessionTimer(seatData.startTime.toDate ? seatData.startTime.toDate() : new Date(seatData.startTime));
    }
  }
}

// Update questions display
function updateQuestionsDisplay(questionDocs) {
  const questionsList = document.getElementById('questions-list');
  const emptyQuestions = document.getElementById('empty-questions');
  const questionsCount = document.getElementById('questions-count');
  
  if (!questionsList) return;
  
  if (questionDocs.length === 0) {
    if (emptyQuestions) emptyQuestions.style.display = 'block';
    questionsList.innerHTML = '';
    if (questionsCount) questionsCount.textContent = '0';
    return;
  }
  
  if (emptyQuestions) emptyQuestions.style.display = 'none';
  if (questionsCount) questionsCount.textContent = questionDocs.length;
  
  questionsList.innerHTML = questionDocs.map(doc => {
    const question = doc.data();
    return `
      <div class="question-item" data-testid="question-${doc.id}">
        <div class="question-content">
          <p class="question-text">${escapeHtml(question.question)}</p>
          <div class="question-meta">
            <span class="question-author">by ${escapeHtml(question.submitterName)}</span>
            <span class="question-time">${formatTime(question.submittedAt)}</span>
          </div>
        </div>
        ${isHost ? `
          <div class="question-actions">
            <button class="feature-btn" onclick="featureQuestion('${doc.id}')" data-testid="button-feature-${doc.id}">
              Feature
            </button>
            <button class="remove-btn" onclick="removeQuestion('${doc.id}')" data-testid="button-remove-${doc.id}">
              Remove
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Update participants list
function updateParticipantsList(participantDocs) {
  const audienceList = document.getElementById('audience-list');
  const audienceCount = document.getElementById('audience-count');
  
  if (!audienceList) return;
  
  if (audienceCount) audienceCount.textContent = participantDocs.length;
  
  audienceList.innerHTML = participantDocs.map(doc => {
    const participant = doc.data();
    return `
      <div class="audience-member" data-testid="audience-${participant.uid}">
        <div class="member-avatar">${participant.displayName.charAt(0).toUpperCase()}</div>
        <span class="member-name">${escapeHtml(participant.displayName)}</span>
        ${participant.role === 'host' ? '<span class="host-badge">👑</span>' : ''}
      </div>
    `;
  }).join('');
}

// Update user queue position
function updateUserQueuePosition(queueDocs) {
  const waitingQueue = queueDocs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => item.status === 'waiting');
  
  const userPosition = waitingQueue.findIndex(item => item.uid === currentUser.uid);
  queuePosition = userPosition >= 0 ? userPosition + 1 : -1;
  
  const joinQueueBtn = document.getElementById('join-queue-btn');
  if (joinQueueBtn) {
    if (queuePosition > 0) {
      joinQueueBtn.innerHTML = `
        <span class="btn-icon">🙋</span>
        <span class="btn-text">In Queue (#${queuePosition})</span>
      `;
      joinQueueBtn.disabled = true;
    } else {
      joinQueueBtn.innerHTML = `
        <span class="btn-icon">🙋</span>
        <span class="btn-text">Join Queue</span>
      `;
      joinQueueBtn.disabled = false;
    }
  }
}

// Session timer functions
function startSessionTimer(startTime = null) {
  sessionStartTime = startTime || new Date();
  
  sessionTimer = setInterval(() => {
    const elapsed = Math.floor((new Date() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function stopSessionTimer() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  
  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.textContent = '0:00';
  }
}

// Show reaction animation
function showReactionAnimation(emoji) {
  const container = document.getElementById('reaction-animations');
  if (!container) return;
  
  const animation = document.createElement('div');
  animation.className = 'reaction-animation';
  animation.textContent = emoji;
  animation.style.left = Math.random() * 80 + 10 + '%';
  
  container.appendChild(animation);
  
  setTimeout(() => {
    if (animation.parentNode) {
      animation.parentNode.removeChild(animation);
    }
  }, 3000);
}

// Modal functions
function openHostModal() {
  const modal = document.getElementById('host-modal-backdrop');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeHostModal() {
  const modal = document.getElementById('host-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Show host controls
function showHostControls() {
  const hostElements = document.querySelectorAll('.host-only');
  hostElements.forEach(el => el.style.display = 'block');
}

// Leave hot seat session
async function leaveHotSeatSession() {
  if (!currentUser) return;
  
  try {
    // Remove from participants
    await deleteDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid));
    
    // Remove from queue if in it
    const queueQuery = query(
      collection(db, 'stages_events', eventId, 'hot_seat_queue'),
      where('uid', '==', currentUser.uid)
    );
    const queueSnapshot = await getDocs(queueQuery);
    queueSnapshot.forEach(async (docSnap) => {
      await deleteDoc(docSnap.ref);
    });
    
    console.log('✅ Left hot seat session');
    window.location.href = 'stages.html';
    
  } catch (error) {
    console.error('❌ Error leaving session:', error);
    showError('Failed to leave session. Please try again.');
  }
}

// Utility functions
function formatTime(timestamp) {
  if (!timestamp) return 'just now';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleReactions() {
  const reactions = document.getElementById('quick-reactions');
  if (reactions) {
    reactions.style.display = reactions.style.display === 'none' ? 'flex' : 'none';
  }
}

function toggleAudienceList() {
  const audienceList = document.getElementById('audience-list');
  const toggleBtn = document.getElementById('toggle-audience-btn');
  
  if (audienceList && toggleBtn) {
    const isHidden = audienceList.style.display === 'none';
    audienceList.style.display = isHidden ? 'block' : 'none';
    toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
  }
}

function updateEventDisplay() {
  // Update any event-specific displays
  const totalParticipants = document.getElementById('total-participants');
  if (totalParticipants) {
    totalParticipants.textContent = currentEvent.participantCount || 0;
  }
}

function updateParticipantCount(count) {
  const totalParticipants = document.getElementById('total-participants');
  if (totalParticipants) {
    totalParticipants.textContent = count;
  }
}

// Host control functions (placeholder implementations)
function nextParticipant() {
  console.log('Next participant (to be implemented)');
}

function clearQueue() {
  console.log('Clear queue (to be implemented)');
}

function clearQuestions() {
  console.log('Clear questions (to be implemented)');
}

function pauseSession() {
  console.log('Pause session (to be implemented)');
}

function endSession() {
  console.log('End session (to be implemented)');
}

function saveSettings() {
  console.log('Save settings (to be implemented)');
  closeSettingsModal();
}

// Utility functions
function showSuccess(message) {
  console.log('✅ Success:', message);
  window.toast.success(message);
}

function showError(message) {
  console.error('❌ Error:', message);
  window.toast.success(message);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventListener) eventListener();
  if (participantsListener) participantsListener();
  if (questionsListener) questionsListener();
  if (queueListener) queueListener();
  if (seatListener) seatListener();
  if (sessionTimer) clearInterval(sessionTimer);
});

// Export functions for global access (if needed)
window.promoteToSeat = function(queueId) {
  console.log('Promote to seat:', queueId);
};

window.featureQuestion = function(questionId) {
  console.log('Feature question:', questionId);
};

window.removeQuestion = function(questionId) {
  console.log('Remove question:', questionId);
};

console.log('🔥 Hot Seat module loaded successfully!');