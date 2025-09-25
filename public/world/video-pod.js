// Video Pod JavaScript - WebRTC Video Chat Platform
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

console.log('📹 Video Pod module loading...');

// Global variables
let currentUser = null;
let eventId = null;
let currentEvent = null;
let isHost = false;

// WebRTC and Media
let localStream = null;
let peerConnections = new Map();
let remoteStreams = new Map();
let isScreenSharing = false;
let mediaConstraints = {
  video: { width: 640, height: 480, frameRate: 30 },
  audio: { echoCancellation: true, noiseSuppression: true }
};

// UI State
let isCameraEnabled = true;
let isMicrophoneEnabled = true;
let isChatVisible = true;

// Real-time listeners
let eventListener = null;
let participantsListener = null;
let chatListener = null;
let signalsListener = null;

// WebRTC Configuration
const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log('📹 Video Pod initializing...');
  
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
    window.toast.info('Please sign in to join the video pod.');
    window.location.href = '../login.html';
    return;
  }
  
  // Get user profile data (read-only)
  const userProfile = await getUserDoc(currentUser.uid);
  if (userProfile) {
    currentUser.displayName = userProfile.displayName || currentUser.displayName;
  }
  console.log('✅ User authenticated:', currentUser.displayName);
  
  // Initialize the video pod
  await initializeVideoPod();
});

// Initialize video pod
async function initializeVideoPod() {
  try {
    // Load event details
    await loadEventDetails();
    
    // Setup event listeners
    setupEventListeners();
    
    // Request media permissions
    showPermissionModal();
    
    console.log('✅ Video pod initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing video pod:', error);
    window.toast.error('Failed to join video pod. Please try again.');
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
    
    // Check participant limit
    const currentCount = currentEvent.participantCount || 0;
    if (currentCount >= currentEvent.maxParticipants && !isHost) {
      alert('This video pod is full. Please try joining another one.');
      window.location.href = 'stages.html';
      return;
    }
    
    // Update UI with event details
    document.getElementById('pod-title').textContent = currentEvent.title;
    document.getElementById('pod-description').textContent = currentEvent.description || 'Welcome to the video pod!';
    document.getElementById('max-participants').textContent = currentEvent.maxParticipants;
    
    // Show host controls if user is host
    if (isHost) {
      document.getElementById('host-controls').style.display = 'flex';
      document.getElementById('host-only-settings').style.display = 'block';
    }
    
    console.log('📊 Event loaded:', currentEvent.title);
    
  } catch (error) {
    console.error('❌ Error loading event:', error);
    throw error;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Leave pod button
  document.getElementById('leave-pod-btn')?.addEventListener('click', leaveVideoPod);
  
  // Media control buttons
  document.getElementById('camera-btn')?.addEventListener('click', toggleCamera);
  document.getElementById('microphone-btn')?.addEventListener('click', toggleMicrophone);
  document.getElementById('screen-share-btn')?.addEventListener('click', toggleScreenShare);
  
  // UI control buttons
  document.getElementById('toggle-chat-btn')?.addEventListener('click', toggleChat);
  document.getElementById('pod-settings-btn')?.addEventListener('click', openPodSettingsModal);
  
  // Host controls
  document.getElementById('mute-all-btn')?.addEventListener('click', muteAllParticipants);
  document.getElementById('record-btn')?.addEventListener('click', toggleRecording);
  
  // Additional event listeners (converted from onclick handlers)
  document.getElementById('close-chat-btn')?.addEventListener('click', toggleChat);
  document.getElementById('close-participants-btn')?.addEventListener('click', closeParticipantsList);
  document.getElementById('deny-permissions-btn')?.addEventListener('click', handlePermissionDenied);
  document.getElementById('request-permissions-btn')?.addEventListener('click', requestPermissions);
  document.getElementById('close-pod-settings-btn')?.addEventListener('click', closePodSettingsModal);
  document.getElementById('cancel-pod-settings-btn')?.addEventListener('click', closePodSettingsModal);
  document.getElementById('save-pod-settings-btn')?.addEventListener('click', savePodSettings);
  document.getElementById('stop-screen-share-btn')?.addEventListener('click', stopScreenShare);
  document.getElementById('dismiss-alert-btn')?.addEventListener('click', dismissAlert);
  
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
  
  console.log('🎯 Event listeners setup complete');
}

// Show permission modal
function showPermissionModal() {
  const modal = document.getElementById('permission-modal-backdrop');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

// Request media permissions
async function requestPermissions() {
  try {
    console.log('🎥 Requesting camera and microphone access...');
    
    localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    console.log('✅ Media access granted');
    
    // Hide permission modal
    const modal = document.getElementById('permission-modal-backdrop');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
    
    // Setup local video and continue with pod initialization
    await setupLocalVideo();
    await joinVideoPod();
    
  } catch (error) {
    console.error('❌ Error accessing media:', error);
    handlePermissionDenied();
  }
}

// Handle permission denied
function handlePermissionDenied() {
  console.log('⚠️ Media access denied, joining audio-only');
  
  // Try to get audio-only access
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      localStream = stream;
      isCameraEnabled = false;
      setupLocalVideo();
      joinVideoPod();
    })
    .catch(() => {
      // Join without any media
      localStream = null;
      isCameraEnabled = false;
      isMicrophoneEnabled = false;
      setupLocalVideo();
      joinVideoPod();
    });
  
  // Hide permission modal
  const modal = document.getElementById('permission-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// Setup local video stream
async function setupLocalVideo() {
  const videoGrid = document.getElementById('video-grid');
  if (!videoGrid) return;
  
  // Create local video container
  const localVideoContainer = createVideoStreamContainer('local', currentUser.uid, {
    displayName: currentUser.displayName || 'You',
    isLocal: true
  });
  
  videoGrid.appendChild(localVideoContainer);
  
  if (localStream) {
    const videoElement = localVideoContainer.querySelector('video');
    if (videoElement) {
      videoElement.srcObject = localStream;
      videoElement.muted = true; // Prevent echo
    }
  }
  
  // Update media button states
  updateMediaButtonStates();
  updateConnectionStatus('connected');
  
  console.log('🎥 Local video setup complete');
}

// Join video pod
async function joinVideoPod() {
  try {
    // Add user as participant
    const participantData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Unknown',
      role: isHost ? 'host' : 'participant',
      isCameraEnabled,
      isMicrophoneEnabled,
      isScreenSharing: false,
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
        status: 'live'
      });
    }
    
    // Start real-time listeners
    startRealtimeListeners();
    
    // Send join message to chat
    await sendSystemMessage(`${currentUser.displayName || 'Someone'} joined the video pod`);
    
    console.log('✅ Joined video pod successfully');
    
    // Track video pod participation for passport
    if (typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('video-pod', 'Joined video pod session');
      window.PassportAPI.awardStamp('stage_performer', 'video-pod', 'Joined video pod event');
    }
    
    // Update daily missions progress for joining events
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      try {
        await window.DailyMissionsAPI.updateProgress('events_joined', 1, {
          eventType: 'video',
          eventTitle: currentEvent.title,
          action: 'joined',
          location: 'video-pod'
        });
      } catch (error) {
        console.error('❌ Error tracking video pod join:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error joining video pod:', error);
    throw error;
  }
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
    updateVideoGrid(snapshot.size);
  });
  
  // Listen to chat messages
  const chatRef = collection(db, 'stages_events', eventId, 'chat');
  const chatQuery = query(chatRef, orderBy('timestamp', 'desc'), limit(50));
  
  chatListener = onSnapshot(chatQuery, (snapshot) => {
    updateChatMessages(snapshot.docs.reverse());
  });
  
  // Listen to WebRTC signals
  const signalsRef = collection(db, 'stages_signals');
  const signalsQuery = query(signalsRef, 
    where('eventId', '==', eventId),
    where('to', '==', currentUser.uid),
    orderBy('timestamp', 'desc')
  );
  
  signalsListener = onSnapshot(signalsQuery, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        handleWebRTCSignal(change.doc.data());
      }
    });
  });
  
  console.log('👂 Real-time listeners started');
}

// Create video stream container
function createVideoStreamContainer(type, userId, participant) {
  const container = document.createElement('div');
  container.className = `video-stream ${type}`;
  container.dataset.testid = `video-${userId}`;
  container.dataset.userId = userId;
  
  const hasVideo = participant.isCameraEnabled && !participant.isScreenSharing;
  
  if (hasVideo || type === 'local') {
    container.innerHTML = `
      <video autoplay ${type === 'local' ? 'muted' : ''} data-testid="video-element-${userId}"></video>
      <div class="video-overlay">
        <div class="participant-info">
          <span class="participant-name">${escapeHtml(participant.displayName)}</span>
          <div class="participant-status">
            <span class="status-icon ${!participant.isMicrophoneEnabled ? 'muted' : ''}" data-testid="mic-status-${userId}">
              ${participant.isMicrophoneEnabled ? '🎙️' : '🔇'}
            </span>
            ${!participant.isCameraEnabled ? '<span class="status-icon camera-off" data-testid="camera-status-' + userId + '">📹</span>' : ''}
            ${participant.isScreenSharing ? '<span class="status-icon" data-testid="screen-status-' + userId + '">🖥️</span>' : ''}
          </div>
        </div>
      </div>
    `;
  } else {
    // No video placeholder
    container.innerHTML = `
      <div class="video-placeholder">
        <div class="placeholder-avatar">${participant.displayName ? participant.displayName.charAt(0).toUpperCase() : '?'}</div>
        <div class="placeholder-name">${escapeHtml(participant.displayName)}</div>
        <div class="placeholder-status">
          ${!participant.isCameraEnabled ? 'Camera off' : 'Connecting...'}
        </div>
      </div>
      <div class="video-overlay">
        <div class="participant-info">
          <span class="participant-name">${escapeHtml(participant.displayName)}</span>
          <div class="participant-status">
            <span class="status-icon ${!participant.isMicrophoneEnabled ? 'muted' : ''}">
              ${participant.isMicrophoneEnabled ? '🎙️' : '🔇'}
            </span>
            <span class="status-icon camera-off">📹</span>
          </div>
        </div>
      </div>
    `;
  }
  
  return container;
}

// Update video grid layout based on participant count
function updateVideoGrid(participantCount) {
  const videoGrid = document.getElementById('video-grid');
  if (!videoGrid) return;
  
  // Remove existing participant count classes
  videoGrid.classList.remove('participants-1', 'participants-2', 'participants-3', 'participants-4', 'participants-5', 'participants-6');
  
  // Add appropriate class based on count
  const count = Math.min(participantCount, 6);
  videoGrid.classList.add(`participants-${count}`);
}

// Update participants list
function updateParticipantsList(participantDocs) {
  const currentParticipants = document.getElementById('current-participants');
  if (currentParticipants) {
    currentParticipants.textContent = participantDocs.length;
  }
  
  // Update video streams
  updateVideoStreams(participantDocs);
}

// Update video streams
function updateVideoStreams(participantDocs) {
  const videoGrid = document.getElementById('video-grid');
  if (!videoGrid) return;
  
  // Get current video containers
  const existingContainers = new Set();
  videoGrid.querySelectorAll('.video-stream').forEach(container => {
    existingContainers.add(container.dataset.userId);
  });
  
  // Add new participants
  participantDocs.forEach(doc => {
    const participant = doc.data();
    const userId = doc.id;
    
    if (!existingContainers.has(userId)) {
      const container = createVideoStreamContainer('remote', userId, participant);
      videoGrid.appendChild(container);
      
      // Initiate WebRTC connection for remote participants
      if (userId !== currentUser.uid) {
        initiateWebRTCConnection(userId);
      }
    }
  });
  
  // Remove participants who left
  const currentParticipants = new Set(participantDocs.map(doc => doc.id));
  videoGrid.querySelectorAll('.video-stream').forEach(container => {
    const userId = container.dataset.userId;
    if (!currentParticipants.has(userId)) {
      // Clean up WebRTC connection
      if (peerConnections.has(userId)) {
        peerConnections.get(userId).close();
        peerConnections.delete(userId);
      }
      if (remoteStreams.has(userId)) {
        remoteStreams.delete(userId);
      }
      container.remove();
    }
  });
}

// Initiate WebRTC connection
async function initiateWebRTCConnection(remoteUserId) {
  if (peerConnections.has(remoteUserId) || !localStream) return;
  
  console.log(`🔗 Initiating WebRTC connection to ${remoteUserId}`);
  
  const peerConnection = new RTCPeerConnection(rtcConfiguration);
  peerConnections.set(remoteUserId, peerConnection);
  
  // Add local stream tracks to peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Handle remote stream
  peerConnection.ontrack = (event) => {
    console.log('📺 Received remote stream from', remoteUserId);
    const remoteStream = event.streams[0];
    remoteStreams.set(remoteUserId, remoteStream);
    
    // Update video element
    const videoContainer = videoGrid.querySelector(`[data-user-id="${remoteUserId}"]`);
    if (videoContainer) {
      const videoElement = videoContainer.querySelector('video');
      if (videoElement) {
        videoElement.srcObject = remoteStream;
      }
    }
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendWebRTCSignal(remoteUserId, 'candidate', event.candidate);
    }
  };
  
  // Create and send offer
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await sendWebRTCSignal(remoteUserId, 'offer', offer);
  } catch (error) {
    console.error('❌ Error creating offer:', error);
  }
}

// Handle incoming WebRTC signals
async function handleWebRTCSignal(signal) {
  const { from, type, data } = signal;
  
  if (!peerConnections.has(from)) {
    // Create peer connection for incoming signal
    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    peerConnections.set(from, peerConnection);
    
    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreams.set(from, remoteStream);
      
      // Update video element
      const videoContainer = videoGrid.querySelector(`[data-user-id="${from}"]`);
      if (videoContainer) {
        const videoElement = videoContainer.querySelector('video');
        if (videoElement) {
          videoElement.srcObject = remoteStream;
        }
      }
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendWebRTCSignal(from, 'candidate', event.candidate);
      }
    };
  }
  
  const peerConnection = peerConnections.get(from);
  
  try {
    switch (type) {
      case 'offer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await sendWebRTCSignal(from, 'answer', answer);
        break;
        
      case 'answer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        break;
        
      case 'candidate':
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        break;
    }
  } catch (error) {
    console.error('❌ Error handling WebRTC signal:', error);
  }
}

// Send WebRTC signal
async function sendWebRTCSignal(to, type, data) {
  try {
    const signalData = {
      eventId,
      from: currentUser.uid,
      to,
      type,
      data,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, 'stages_signals'), signalData);
  } catch (error) {
    console.error('❌ Error sending WebRTC signal:', error);
  }
}

// Media control functions
async function toggleCamera() {
  isCameraEnabled = !isCameraEnabled;
  
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isCameraEnabled;
    }
  }
  
  // Update participant status
  await updateParticipantMediaStatus();
  updateMediaButtonStates();
  
  console.log(`📹 Camera ${isCameraEnabled ? 'enabled' : 'disabled'}`);
}

async function toggleMicrophone() {
  isMicrophoneEnabled = !isMicrophoneEnabled;
  
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMicrophoneEnabled;
    }
  }
  
  // Update participant status
  await updateParticipantMediaStatus();
  updateMediaButtonStates();
  
  console.log(`🎙️ Microphone ${isMicrophoneEnabled ? 'enabled' : 'disabled'}`);
}

async function toggleScreenShare() {
  if (isScreenSharing) {
    await stopScreenShare();
  } else {
    await startScreenShare();
  }
}

async function startScreenShare() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    
    // Replace video track in all peer connections
    const videoTrack = screenStream.getVideoTracks()[0];
    if (videoTrack) {
      peerConnections.forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });
      
      // Update local video
      const localVideo = document.querySelector('[data-user-id="' + currentUser.uid + '"] video');
      if (localVideo) {
        localVideo.srcObject = screenStream;
      }
      
      // Show screen share preview
      const preview = document.getElementById('screen-share-preview');
      const previewVideo = document.getElementById('screen-preview');
      if (preview && previewVideo) {
        previewVideo.srcObject = screenStream;
        preview.style.display = 'block';
      }
      
      // Handle screen share end
      videoTrack.onended = () => {
        stopScreenShare();
      };
    }
    
    isScreenSharing = true;
    await updateParticipantMediaStatus();
    updateMediaButtonStates();
    
    console.log('🖥️ Screen sharing started');
    
  } catch (error) {
    console.error('❌ Error starting screen share:', error);
    showConnectionAlert('Failed to start screen sharing');
  }
}

async function stopScreenShare() {
  if (!localStream) return;
  
  try {
    // Replace screen track with camera track
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      peerConnections.forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });
      
      // Update local video
      const localVideo = document.querySelector('[data-user-id="' + currentUser.uid + '"] video');
      if (localVideo) {
        localVideo.srcObject = localStream;
      }
    }
    
    // Hide screen share preview
    const preview = document.getElementById('screen-share-preview');
    if (preview) {
      preview.style.display = 'none';
    }
    
    isScreenSharing = false;
    await updateParticipantMediaStatus();
    updateMediaButtonStates();
    
    console.log('🖥️ Screen sharing stopped');
    
  } catch (error) {
    console.error('❌ Error stopping screen share:', error);
  }
}

// Update participant media status
async function updateParticipantMediaStatus() {
  try {
    await updateDoc(doc(db, 'stages_events', eventId, 'participants', currentUser.uid), {
      isCameraEnabled,
      isMicrophoneEnabled,
      isScreenSharing,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Error updating media status:', error);
  }
}

// Update media button states
function updateMediaButtonStates() {
  const cameraBtn = document.getElementById('camera-btn');
  const micBtn = document.getElementById('microphone-btn');
  const screenBtn = document.getElementById('screen-share-btn');
  
  if (cameraBtn) {
    cameraBtn.className = `media-btn ${isCameraEnabled ? 'enabled' : 'disabled'}`;
    document.getElementById('camera-icon').textContent = isCameraEnabled ? '📹' : '📹';
  }
  
  if (micBtn) {
    micBtn.className = `media-btn ${isMicrophoneEnabled ? 'enabled' : 'disabled'}`;
    document.getElementById('mic-icon').textContent = isMicrophoneEnabled ? '🎙️' : '🔇';
  }
  
  if (screenBtn) {
    screenBtn.className = `media-btn ${isScreenSharing ? 'enabled' : ''}`;
  }
}

// Chat functions
function toggleChat() {
  const chatSidebar = document.getElementById('chat-sidebar');
  const toggleBtn = document.getElementById('toggle-chat-btn');
  
  if (isChatVisible) {
    chatSidebar.classList.add('hidden');
    toggleBtn.classList.remove('active');
    isChatVisible = false;
  } else {
    chatSidebar.classList.remove('hidden');
    toggleBtn.classList.add('active');
    isChatVisible = true;
  }
}

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
    showConnectionAlert('Failed to send message');
  }
}

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

// Leave video pod
async function leaveVideoPod() {
  try {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    peerConnections.forEach(peerConnection => {
      peerConnection.close();
    });
    peerConnections.clear();
    remoteStreams.clear();
    
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
    await sendSystemMessage(`${currentUser.displayName || 'Someone'} left the video pod`);
    
    // Clean up listeners
    cleanupListeners();
    
    // Redirect back to stages
    window.location.href = 'stages.html';
    
  } catch (error) {
    console.error('❌ Error leaving video pod:', error);
    // Force redirect even if error occurs
    window.location.href = 'stages.html';
  }
}

// Host controls
async function muteAllParticipants() {
  if (!isHost) return;
  
  try {
    // This is a UI-only action - actual muting would need WebRTC renegotiation
    await sendSystemMessage('Host requested all participants to mute');
    showConnectionAlert('Mute all request sent to participants');
  } catch (error) {
    console.error('❌ Error muting all participants:', error);
  }
}

function toggleRecording() {
  if (!isHost) return;
  
  // Recording functionality would require server-side implementation
  showConnectionAlert('Recording feature coming soon');
}

// Modal functions
function openPodSettingsModal() {
  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closePodSettingsModal() {
  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

async function savePodSettings() {
  try {
    const videoQuality = document.getElementById('video-quality').value;
    const noiseCancellation = document.getElementById('noise-cancellation').checked;
    const echoCancellation = document.getElementById('echo-cancellation').checked;
    
    // Apply settings locally
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        await audioTrack.applyConstraints({
          echoCancellation,
          noiseSuppression: noiseCancellation
        });
      }
    }
    
    // Save host settings if host
    if (isHost) {
      const autoMuteNew = document.getElementById('auto-mute-new').checked;
      const allowScreenShare = document.getElementById('allow-screen-share').checked;
      
      await updateDoc(doc(db, 'stages_events', eventId), {
        settings: {
          videoQuality,
          autoMuteNew,
          allowScreenShare
        },
        updatedAt: serverTimestamp()
      });
    }
    
    closePodSettingsModal();
    showConnectionAlert('Settings saved successfully');
    
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    showConnectionAlert('Failed to save settings');
  }
}

// Utility functions
function updateEventDisplay() {
  if (currentEvent.status === 'ended') {
    alert('This video pod has ended.');
    window.location.href = 'stages.html';
  }
}

function updateParticipantCount(count) {
  const currentEl = document.getElementById('current-participants');
  if (currentEl) {
    currentEl.textContent = count;
  }
}

function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;
  
  const indicator = statusEl.querySelector('.status-indicator');
  if (indicator) {
    indicator.className = `status-indicator ${status}`;
    indicator.querySelector('span').textContent = 
      status === 'connected' ? 'Connected' : 
      status === 'connecting' ? 'Connecting...' : 'Disconnected';
  }
}

function showConnectionAlert(message) {
  const alert = document.getElementById('connection-alert');
  const messageEl = document.getElementById('alert-message');
  
  if (alert && messageEl) {
    messageEl.textContent = message;
    alert.style.display = 'block';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
      alert.style.display = 'none';
    }, 3000);
  }
}

function dismissAlert() {
  const alert = document.getElementById('connection-alert');
  if (alert) {
    alert.style.display = 'none';
  }
}

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
  if (signalsListener) signalsListener();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  peerConnections.forEach(peerConnection => {
    peerConnection.close();
  });
  cleanupListeners();
});

// Export functions for global access
window.requestPermissions = requestPermissions;
window.handlePermissionDenied = handlePermissionDenied;
window.toggleChat = toggleChat;
window.closePodSettingsModal = closePodSettingsModal;
window.savePodSettings = savePodSettings;
window.stopScreenShare = stopScreenShare;
window.dismissAlert = dismissAlert;
window.closeParticipantsList = function() {
  const overlay = document.getElementById('participants-overlay');
  if (overlay) overlay.style.display = 'none';
};

console.log('📹 Video Pod module loaded successfully!');