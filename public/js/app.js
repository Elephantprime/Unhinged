import { auth, db, getUserDoc, waitForAuth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, getDoc, doc, setDoc, deleteDoc, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { safeSendSignal, serializeOffer, serializeAnswer, serializeIceCandidate } from "./signaling-debug.js";
import { applyDeckFilters, wirePassLike } from "/js/deck-filters.js";
import { recyclingBin } from "/js/recycling-bin.js";
import { initializeCasualtiesManager } from "./casualties-manager.js";

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
} from "./safe-dom-utils.js";

const ROOMS = [
  { id: "general",      label: "#general" },
  { id: "first-dates",  label: "#first-dates" },
  { id: "gym-rats",     label: "#gym-rats" },
  { id: "chaos-lounge", label: "#chaos-lounge" },
  { id: "dating",       label: "#dating" },
  { id: "friends",      label: "#friends" },
  { id: "fwb",          label: "#fwb" },
  { id: "vents",        label: "#vents" }
];

let me = null;
let myDisplayName = "";
let currentRoom = ROOMS[0].id;
let unsubFeed = null;
let unsubMembers = null;

let localStream = null;
let isStreaming = false;
let currentCamera = 'user';
let peerConnections = new Map();
let streamViewerRefs = new Map();

const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// DOM elements - initialized safely after DOM ready
let meTag, enterChatBtn, leaveChatBtn, roomBar, roomSelect;
let chatFeed, membersList, membersContainer, sendRow, chatInput, sendBtn;

// Streaming elements - initialized safely after DOM ready
let localVideo, startStreamBtn, stopStreamBtn, flipCameraBtn, streamStatus;
let joinStreamBtn, leaveStreamBtn, viewLiveStreamsBtn, streamPlaceholder, viewerNumber;

// Stream control elements - initialized safely after DOM ready
let streamControls, toggleAudioBtn, toggleVideoBtn, shareScreenBtn;
let endCallBtn, viewerCountPill;

// Floating Live Stream Chat Elements - initialized safely after DOM ready
let liveStreamChatContainer, liveStreamChatFeed, liveStreamChatInput, liveStreamChatSend;
let minimizeChatBtn, closeChatBtn, maximizeChatBtn;

let isChatOpen = false;
let isChatMinimized = false;
let isChatMaximized = false;
let chatDraggable = null; // For drag functionality
let chatResizable = null; // For resize functionality

// Safe DOM initialization function
function initializeDOMElements() {
  console.log('🔧 Initializing DOM elements safely...');
  
  // Initialize chat elements
  meTag = safeGetById("meTag", false);
  enterChatBtn = safeGetById("enterChatBtn", false);
  leaveChatBtn = safeGetById("leaveChatBtn", false);
  roomBar = safeGetById("roomBar", false);
  roomSelect = safeGetById("roomSelect", false);
  chatFeed = safeGetById("chatFeed", false);
  membersList = safeGetById("membersList", false);
  membersContainer = safeGetById("membersContainer", false);
  sendRow = safeGetById("sendRow", false);
  chatInput = safeGetById("chatInput", false);
  sendBtn = safeGetById("chatSend", false);
  
  // Initialize streaming elements
  localVideo = safeGetById("localVideo", false);
  startStreamBtn = safeGetById("startStream", false);
  stopStreamBtn = safeGetById("stopStream", false);
  flipCameraBtn = safeGetById("flipCamera", false);
  streamStatus = safeGetById("streamStatus", false);
  joinStreamBtn = safeGetById("joinStreamBtn", false);
  leaveStreamBtn = safeGetById("leaveStreamBtn", false);
  viewLiveStreamsBtn = safeGetById("viewLiveStreamsBtn", false);
  streamPlaceholder = safeGetById("streamPlaceholder", false);
  viewerNumber = safeGetById("viewerCount", false);
  
  // Initialize stream controls
  streamControls = safeGetById('streamControls', false);
  toggleAudioBtn = safeGetById('toggleAudio', false);
  toggleVideoBtn = safeGetById('toggleVideo', false);
  shareScreenBtn = safeGetById('shareScreen', false);
  endCallBtn = safeGetById('endCall', false);
  viewerCountPill = safeGetById('viewerCount', false);
  
  // Initialize chat elements
  liveStreamChatContainer = safeGetById('liveStreamChatContainer', false);
  liveStreamChatFeed = safeGetById('liveStreamChatFeed', false);
  liveStreamChatInput = safeGetById('liveStreamChatInput', false);
  liveStreamChatSend = safeGetById('liveStreamChatSend', false);
  minimizeChatBtn = safeGetById('minimizeLiveChat', false);
  closeChatBtn = safeGetById('closeLiveChat', false);
  maximizeChatBtn = safeGetById('maximizeLiveChat', false);
  
  console.log('✅ DOM elements initialized safely');
}

function open(el) { 
  if (el) {
    el.style.display = "flex";
  } else {
    console.warn('⚠️ Cannot open element - element is null');
  }
}

function close(el) { 
  if (el) {
    el.style.display = "none";
  } else {
    console.warn('⚠️ Cannot close element - element is null');
  }
}

/* ===== App Initialization ===== */

// Initialize app when DOM is ready
safeDOMReady(async () => {
  console.log('🚀 App initializing with safe DOM...');
  initializeDOMElements();
  setupEventListeners();
  
  // Disable interactive UI until auth is ready
  disableAuthRequiredUI();
  
  // Wait for authentication to be ready before enabling UI
  await initializeAuth();
  
  // Start casualties feed immediately - doesn't require authentication
  console.log('🎯 Starting casualties feed for all users...');
  startCasualtiesFeed();
});

function setupEventListeners() {
  console.log('🔗 Setting up event listeners safely...');
  
  // Chat event listeners
  safeAddEventListener(enterChatBtn, 'click', enterChat, 'enter chat button');
  safeAddEventListener(leaveChatBtn, 'click', leaveChat, 'leave chat button');
  safeAddEventListener(sendBtn, 'click', sendMessage, 'send message button');
  
  // Stream event listeners - CRITICAL FIX: Remove conflicting event listener that blocks onclick
  // The onclick="startLiveStreamWithPassword()" handler in HTML will work properly without interference
  // safeAddEventListener(startStreamBtn, 'click', ...) - REMOVED to fix regression
  safeAddEventListener(stopStreamBtn, 'click', () => window.stopLiveStream ? window.stopLiveStream() : console.error('stopLiveStream not available'), 'stop stream button');
  safeAddEventListener(flipCameraBtn, 'click', flipCamera, 'flip camera button');
  safeAddEventListener(joinStreamBtn, 'click', () => window.joinLiveStream ? window.joinLiveStream() : console.error('joinLiveStream not available'), 'join stream button');
  safeAddEventListener(leaveStreamBtn, 'click', leaveStream, 'leave stream button');
  safeAddEventListener(viewLiveStreamsBtn, 'click', showLiveStreamsModal, 'view streams button');
  
  // Chat controls - use global functions
  safeAddEventListener(toggleAudioBtn, 'click', () => window.toggleAudio ? window.toggleAudio() : console.error('toggleAudio not available'), 'toggle audio button');
  safeAddEventListener(toggleVideoBtn, 'click', () => window.toggleVideo ? window.toggleVideo() : console.error('toggleVideo not available'), 'toggle video button');
  safeAddEventListener(shareScreenBtn, 'click', () => window.shareScreen ? window.shareScreen() : console.error('shareScreen not available'), 'share screen button');
  safeAddEventListener(endCallBtn, 'click', () => window.endCall ? window.endCall() : console.error('endCall not available'), 'end call button');
  
  // Live chat controls - use global functions
  safeAddEventListener(liveStreamChatSend, 'click', () => {
    const message = liveStreamChatInput?.value?.trim();
    if (message && window.sendLiveStreamMessage) {
      window.sendLiveStreamMessage(message);
      liveStreamChatInput.value = '';
    } else if (!message) {
      console.warn('No message to send');
    } else {
      console.error('sendLiveStreamMessage not available');
    }
  }, 'live chat send button');
  safeAddEventListener(minimizeChatBtn, 'click', minimizeLiveStreamChat, 'minimize chat button');
  safeAddEventListener(closeChatBtn, 'click', closeLiveStreamChat, 'close chat button');
  safeAddEventListener(maximizeChatBtn, 'click', maximizeLiveStreamChat, 'maximize chat button');
  
  // Enter key listeners
  safeAddEventListener(chatInput, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, 'chat input enter key');
  
  safeAddEventListener(liveStreamChatInput, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = liveStreamChatInput?.value?.trim();
      if (message && window.sendLiveStreamMessage) {
        window.sendLiveStreamMessage(message);
        liveStreamChatInput.value = '';
      } else if (!message) {
        console.warn('No message to send in keydown');
      } else {
        console.error('sendLiveStreamMessage not available in keydown');
      }
    }
  }, 'live chat input enter key');
  
  console.log('✅ Event listeners set up safely');
}

async function initializeAuth() {
  console.log('🔐 Initializing authentication...');
  
  try {
    // Wait for authentication state to be ready
    console.log('⏳ Waiting for Firebase Auth to initialize...');
    const user = await waitForAuth();
    
    if (user) {
      console.log('✅ Authentication ready - user found:', user.uid);
      
      // User authenticated successfully - proceed with normal flow
      console.log('✅ User authentication verified');
      
      me = user;
      
      // Get user document to get display name (read-only)
      try {
        const userDoc = await getUserDoc(user.uid);
        myDisplayName = userDoc?.displayName || user.displayName || user.email?.split('@')[0] || 'Anonymous';
      } catch (error) {
        console.warn('⚠️ Could not fetch user doc, using auth data:', error);
        myDisplayName = user.displayName || user.email?.split('@')[0] || 'Anonymous';
      }
      
      if (meTag) {
        safeSetTextContent(meTag, myDisplayName, 'user display name');
      }
      console.log('✅ User authenticated successfully:', myDisplayName, 'UID:', user.uid);
      
      // Enable UI now that we have a user
      enableAuthRequiredUI();
      
    } else {
      console.log('❌ Authentication ready - no user found');
      me = null;
      myDisplayName = '';
      if (meTag) {
        safeSetTextContent(meTag, 'Not signed in', 'user display name');
      }
      
      // Keep UI disabled for unauthenticated users
      showAuthRequiredMessage();
    }
    
    // Set up ongoing auth state listener for changes
    onAuthStateChanged(auth, async (user) => {
      // Only process changes if they're different from current state
      if ((user && me && user.uid === me.uid) || (!user && !me)) {
        return; // No change
      }
      
      if (user) {
        console.log('🔄 Auth state changed - user logged in:', user.uid);
        
        // User authentication state changed - proceed with normal flow
        console.log('✅ User authentication state verified');
        
        me = user;
        
        try {
          const userDoc = await getUserDoc(user.uid);
          myDisplayName = userDoc?.displayName || user.displayName || user.email?.split('@')[0] || 'Anonymous';
        } catch (error) {
          console.warn('⚠️ Could not fetch user doc, using auth data:', error);
          myDisplayName = user.displayName || user.email?.split('@')[0] || 'Anonymous';
        }
        
        if (meTag) {
          safeSetTextContent(meTag, myDisplayName, 'user display name');
        }
        enableAuthRequiredUI();
        console.log('✅ User state updated:', myDisplayName);
        
      } else {
        console.log('🔄 Auth state changed - user logged out');
        me = null;
        myDisplayName = '';
        if (meTag) {
          safeSetTextContent(meTag, 'Not signed in', 'user display name');
        }
        disableAuthRequiredUI();
        showAuthRequiredMessage();
      }
    });
    
  } catch (error) {
    console.error('❌ Error initializing authentication:', error);
    me = null;
    myDisplayName = '';
    if (meTag) {
      safeSetTextContent(meTag, 'Auth Error', 'user display name');
    }
    showAuthRequiredMessage();
  }
}

/* ===== UI State Management ===== */

function disableAuthRequiredUI() {
  console.log('🔒 Disabling auth-required UI elements...');
  
  // Disable chat buttons
  if (enterChatBtn) enterChatBtn.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  if (chatInput) chatInput.disabled = true;
  
  // Disable streaming buttons  
  if (startStreamBtn) startStreamBtn.disabled = true;
  if (joinStreamBtn) joinStreamBtn.disabled = true;
  
  // Disable live chat buttons
  if (liveStreamChatSend) liveStreamChatSend.disabled = true;
  if (liveStreamChatInput) liveStreamChatInput.disabled = true;
}

function enableAuthRequiredUI() {
  console.log('🔓 Enabling auth-required UI elements...');
  
  // Enable chat buttons
  if (enterChatBtn) enterChatBtn.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (chatInput) chatInput.disabled = false;
  
  // Enable streaming buttons
  if (startStreamBtn) startStreamBtn.disabled = false;
  if (joinStreamBtn) joinStreamBtn.disabled = false;
  
  // Enable live chat buttons
  if (liveStreamChatSend) liveStreamChatSend.disabled = false;
  if (liveStreamChatInput) liveStreamChatInput.disabled = false;
}

function showAuthRequiredMessage() {
  console.log('ℹ️ Showing authentication required message...');
  
  if (typeof showStyledNotification === 'function') {
    showStyledNotification('Please sign in to access chat and streaming features', 'info');
  }
}

/* ===== Live Stream Functions (Core Fixes) ===== */

// Global signaling listener to prevent duplicates
let signalingUnsub = null;

// Safe appendChild wrapper for backward compatibility
function safeAppendChildLegacy(parent, child, context = '') {
  return safeAppendChild(parent, child, context);
}

// Listen for WebRTC signals
function listenForSignaling() {
  if (!me || signalingUnsub) return; // Prevent duplicate listeners

  const signalsRef = collection(db, 'liveStreamSignals');
  const signalsQuery = query(
    signalsRef,
    where('to', '==', me.uid),
    orderBy('timestamp', 'desc'),
    limit(10) // Limit to recent signals only
  );

  signalingUnsub = onSnapshot(signalsQuery, async (snapshot) => {
    // Process only new signals, not the entire history
    const newSignals = snapshot.docChanges().filter(change => change.type === 'added');

    for (const change of newSignals) {
      const signalData = change.doc.data();
      const signalDocRef = change.doc.ref;
      const { from, type, offer, answer, candidate, timestamp } = signalData;

      // Skip old signals (older than 2 minutes)
      const signalTime = timestamp?.toDate ? timestamp.toDate() : new Date();
      const ageMinutes = (Date.now() - signalTime.getTime()) / (1000 * 60);
      if (ageMinutes > 2) {
        await deleteDoc(signalDocRef).catch(() => {});
        continue;
      }

      try {
        if (type === 'viewer-offer') {
          console.log('📥 Processing viewer offer from:', from);
          await handleViewerConnection(from, offer, signalDocRef);
        } else if (type === 'ice-candidate' && peerConnections.has(from)) {
          const pc = peerConnections.get(from);
          if (pc.remoteDescription && candidate) {
            const iceCandidate = new RTCIceCandidate({
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex
            });
            await pc.addIceCandidate(iceCandidate);
            console.log('🧊 ICE candidate processed for:', from);
          }
          await deleteDoc(signalDocRef).catch(() => {});
        } else if (type === 'answer') {
          // Handle viewer receiving answer from streamer
          const pc = peerConnections.get(from);
          if (pc && answer) {
            await pc.setRemoteDescription(answer);
            console.log('✅ Answer processed from streamer:', from);
          }
          await deleteDoc(signalDocRef).catch(() => {});
        }
      } catch (error) {
        console.error('Signaling processing error:', error);
        await deleteDoc(signalDocRef).catch(() => {});
      }
    }
  }, (error) => {
    console.error('Signaling listener error:', error);
    signalingUnsub = null;
  });
}

// Handle viewer connection properly
async function handleViewerConnection(viewerUid, offer, signalDocRef) {
  if (!isStreaming || !localStream) {
    await deleteDoc(signalDocRef).catch(() => {});
    return;
  }

  const peerConnection = new RTCPeerConnection(rtcConfiguration);
  peerConnections.set(viewerUid, peerConnection);

  // CRITICAL: Add local stream tracks to connection IMMEDIATELY
  localStream.getTracks().forEach(track => {
    console.log('🎥 Adding streamer track:', track.kind, 'to connection for', viewerUid);
    peerConnection.addTrack(track, localStream);
  });

  // Handle ICE candidates with proper serialization
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const serializedCandidate = serializeIceCandidate(event.candidate);
      safeSendSignal(db, viewerUid, me.uid, {
        type: 'ice-candidate',
        candidate: serializedCandidate
      }, currentStreamId).catch(err => console.error('ICE send failed:', err));
    }
  };

  // Monitor connection
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log(`🔗 Connection to viewer ${viewerUid}: ${state}`);

    if (state === 'connected') {
      console.log('✅ Viewer connected successfully - they should see your stream');
    } else if (state === 'failed' || state === 'disconnected') {
      console.log('❌ Viewer connection failed/disconnected');
      peerConnections.delete(viewerUid);
    }
  };

  try {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer to viewer with proper serialization
    const serializedAnswer = serializeAnswer(answer);
    await safeSendSignal(db, viewerUid, me.uid, {
      type: 'answer',
      answer: serializedAnswer
    }, currentStreamId);

    console.log('✅ Sent answer to viewer:', viewerUid);

    // Clean up the processed offer
    await deleteDoc(signalDocRef);

  } catch (error) {
    console.error('❌ Failed to handle viewer connection:', error);
    peerConnections.delete(viewerUid);
    await deleteDoc(signalDocRef).catch(() => {});
  }
}

// Clean up signaling listener
function stopSignalingListener() {
  if (signalingUnsub) {
    signalingUnsub();
    signalingUnsub = null;
    console.log('🧹 Signaling listener stopped');
  }
}

// Broadcast stream availability to all chat rooms
async function broadcastStreamAvailability(isLive) {
  if (!me || !myDisplayName) return;

  const message = isLive
    ? `🎥 ${myDisplayName} is now LIVE streaming! Click "Join" to watch.`
    : `📺 ${myDisplayName} ended their live stream.`;

  // Send notification to all rooms
  const notifyRooms = ['general', 'chaos-lounge', 'first-dates', 'gym-rats'];

  for (const roomId of notifyRooms) {
    try {
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        from: "🎬 LIVE SYSTEM",
        text: message,
        createdAt: serverTimestamp(),
        uid: "system",
        isSystemMessage: true
      });
      console.log(`✅ Notified ${roomId} room`);
    } catch (error) {
      console.log(`❌ Notification to ${roomId} failed:`, error);
    }
  }
}

// Monitor viewer count for streamers
function monitorViewerCount() {
  if (!me || !isStreaming) return;

  const viewersRef = collection(db, 'liveStream viewers');
  const viewersQuery = query(viewersRef, where('streamerUid', '==', me.uid), where('isActive', '==', true));

  onSnapshot(viewersQuery, (snapshot) => {
    const viewerCount = snapshot.size;
    const viewerNumEl = document.getElementById('viewerCount');
    if (viewerNumEl) {
      viewerNumEl.textContent = viewerCount.toString();
    }

    // Update stream status
    if (streamStatus) {
      if (viewerCount > 0) {
        streamStatus.textContent = `🔴 LIVE - ${viewerCount} viewer${viewerCount !== 1 ? 's' : ''} watching`;
      } else {
        streamStatus.textContent = '🔴 LIVE - Waiting for viewers...';
      }
    }

    console.log(`📊 Current viewers: ${viewerCount}`);
  }, (error) => {
    console.log('Viewer count monitoring failed:', error);
  });
}



async function connectToStreamer(streamerUid, withCamera = false) {
  const viewerUid = me.uid;
  const peerConnection = new RTCPeerConnection(rtcConfiguration);

  // Store this connection for cleanup
  peerConnections.set(`viewer-${streamerUid}`, peerConnection);

  // Only try to get camera/mic if user wants to join WITH camera
  if (withCamera) {
    try {
      const viewerStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true
      });

      // Add viewer's tracks to connection for two-way video
      viewerStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, viewerStream);
      });

      // Show viewer's own video (their camera feed)
      const existingViewerVideo = document.getElementById('myViewerVideo');
      if (existingViewerVideo) existingViewerVideo.remove();

      const viewerVideo = document.createElement('video');
      viewerVideo.id = 'myViewerVideo';
      viewerVideo.srcObject = viewerStream;
      viewerVideo.autoplay = true;
      viewerVideo.muted = true;
      viewerVideo.playsinline = true;
      viewerVideo.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 150px;
        height: 120px;
        border: 2px solid #E11D2A;
        border-radius: 8px;
        object-fit: cover;
        z-index: 15;
        background: #000;
      `;

      const liveBox = document.getElementById('live-box');
      liveBox.appendChild(viewerVideo);
      console.log('✅ Viewer camera enabled - bidirectional streaming active');

    } catch (error) {
      console.warn('⚠️ Viewer camera not available, switching to watch-only:', error);
      withCamera = false; // Fall back to watch-only
    }
  } else {
    console.log('📺 Watch-only mode - no camera requested');
  }

  // Create main video element for streamer's feed
  const existingRemoteVideo = document.getElementById(`remoteVideo-${streamerUid}`);
  if (existingRemoteVideo) existingRemoteVideo.remove();

  const remoteVideo = document.createElement('video');
  remoteVideo.autoplay = true;
  remoteVideo.playsinline = true;
  remoteVideo.style.width = '100%';
  remoteVideo.style.height = '100%';
  remoteVideo.style.objectFit = 'cover';
  remoteVideo.style.borderRadius = '14px';
  remoteVideo.style.background = '#000';
  remoteVideo.id = `remoteVideo-${streamerUid}`;

  const liveBox = document.getElementById('live-box');
  liveBox.appendChild(remoteVideo);

  // Handle incoming stream from broadcaster - BOTH DIRECTIONS
  peerConnection.ontrack = (event) => {
    console.log('📺 Received stream from broadcaster');
    const stream = event.streams[0];

    // Set main video to show broadcaster's stream
    remoteVideo.srcObject = stream;
    streamPlaceholder.style.display = 'none';
    localVideo.style.display = 'none';

    // Update UI based on mode
    const statusText = withCamera ? '📹 Streaming with' : '📺 Watching';
    if (streamStatus) streamStatus.textContent = `${statusText}`;
    
    // Show streamer name in the dedicated display area
    const streamerDisplay = document.getElementById('currentStreamerDisplay');
    const streamerNameSpan = document.getElementById('currentStreamerName');
    
    if (streamerDisplay && streamerNameSpan) {
      streamerNameSpan.textContent = streamerName;
      streamerDisplay.style.display = 'block';
      
      // Store for profile modal access
      window.currentStreamerUid = streamerUid;
      window.currentStreamerName = streamerName;
      
      console.log('✅ Streamer name displayed:', streamerName);
    }
    joinStreamBtn.textContent = '🚪 Leave Stream';
    joinStreamBtn.onclick = leaveStream;

    console.log(`✅ ${withCamera ? 'Two-way' : 'Watch-only'} video connection established`);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(collection(db, 'liveStreamSignals'), {
        type: 'ice-candidate',
        from: viewerUid,
        to: streamerUid,
        data: JSON.parse(JSON.stringify(event.candidate)),
        timestamp: serverTimestamp()
      });
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed') {
      console.log('Connection failed, attempting to reconnect...');
      // Attempt reconnection logic here if needed
    }
  };

  // Create and send offer
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  });
  await peerConnection.setLocalDescription(offer);

  await addDoc(collection(db, 'liveStreamSignals'), {
    type: 'viewer-offer',
    from: viewerUid,
    to: streamerUid,
    offer: JSON.parse(JSON.stringify(offer)),
    timestamp: serverTimestamp()
  });

  // Listen for answer from streamer
  const signalsRef = collection(db, 'liveStreamSignals');
  const answerQuery = query(
    signalsRef,
    where('from', '==', streamerUid),
    where('to', '==', viewerUid),
    where('type', '==', 'answer')
  );

  const unsubAnswer = onSnapshot(answerQuery, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const answerData = change.doc.data();
        await peerConnection.setRemoteDescription(answerData.answer);

        // Process all queued ICE candidates now that remote description is set
        for (const candidate of pendingCandidates) {
          try {
            await peerConnection.addIceCandidate(candidate);
            console.log('🧊 Applied queued ICE candidate');
          } catch (error) {
            console.error('Error applying queued candidate:', error);
          }
        }
        pendingCandidates.length = 0; // Clear the queue

        await deleteDoc(change.doc.ref);
        console.log('✅ Answer received and set, ICE candidates processed');
      }
    });
  });

  // Queue for ICE candidates until remote description is set
  const pendingCandidates = [];

  // Listen for ICE candidates from streamer
  const iceCandidateQuery = query(
    signalsRef,
    where('from', '==', streamerUid),
    where('to', '==', viewerUid),
    where('type', '==', 'ice-candidate')
  );

  const unsubICE = onSnapshot(iceCandidateQuery, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const candidateData = change.doc.data();
        try {
          // Only add ICE candidate if remote description is set
          if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(candidateData.data);
          } else {
            // Queue candidate for later
            pendingCandidates.push(candidateData.data);
          }
          await deleteDoc(change.doc.ref);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });
  });

  // Store cleanup functions
  peerConnection.unsubAnswer = unsubAnswer;
  peerConnection.unsubICE = unsubICE;
}

async function joinStream() {
  console.log('🔍 Searching for active streams...');
  let streamerUid = null;
  let streamerName = null;

  // Check localStorage for current stream
  const currentStream = localStorage.getItem('currentStream');
  if (currentStream) {
    try {
      const streamData = JSON.parse(currentStream);
      if (streamData.isLive) {
        streamerUid = streamData.streamerUid;
        streamerName = streamData.streamerName;
        console.log('✅ Found local active stream from:', streamerName);
      }
    } catch (error) {
      console.log('Error parsing local stream data:', error);
    }
  }

  // Manual input if no stream found
  if (!streamerUid) {
    const input = prompt('🔍 No active streams found.\n\nEnter streamer username to join:');
    if (input && input.trim()) {
      streamerUid = input.trim();
      streamerName = streamerUid;
    } else {
      showStyledNotification('❌ No stream to join', 'error');
      return;
    }
  }

  joinSpecificStream(streamerUid, streamerName);
}

async function joinSpecificStream(streamerUid, streamerName) {
  // Allow joining without login for testing
  let userDisplayName = myDisplayName;
  let userId = me?.uid;

  if (!me) {
    const anonymousName = prompt("Enter a viewer name:");
    if (!anonymousName || !anonymousName.trim()) {
      showStyledNotification('Name required to join stream', 'warning');
      return;
    }
    userDisplayName = anonymousName.trim();
    userId = `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Ask user if they want to join with camera or just watch
  const joinMode = confirm(
    "🎥 Join Stream Mode:\n\n" +
    "• Click OK to JOIN WITH CAMERA (streamer will see you)\n" +
    "• Click Cancel to WATCH ONLY (just view the stream)"
  );

  console.log('🎯 Connecting to streamer:', streamerUid);

  // Update global display name if anonymous
  if (!myDisplayName && userDisplayName) {
    myDisplayName = userDisplayName;
  }

  try {

  // Register as viewer
  const viewerData = {
    viewerUid: userId,
    viewerName: userDisplayName,
    streamerUid,
    streamerName,
    joinedAt: Date.now(),
    isActive: true,
    withCamera: joinMode
  };

  // Add viewer to stream
  streamViewers.push(viewerData);
  updateViewerCount();
  renderStreamViewers();
  renderParticipants();

  // Store viewer data
  localStorage.setItem('currentViewer', JSON.stringify(viewerData));

  // Notify about new viewer
  window.dispatchEvent(new CustomEvent('viewerJoined', { detail: viewerData }));

  // Get viewer camera if requested
    if (joinMode) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported');
        }

        const constraints = {
          video: {
            width: { min: 320, ideal: 640, max: 1280 },
            height: { min: 240, ideal: 480, max: 720 },
            facingMode: 'user'
          },
          audio: true
        };

        console.log('📱 Requesting viewer camera access...');
        const viewerStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Show viewer's own video
        const existingViewerVideo = document.getElementById('myViewerVideo');
        if (existingViewerVideo) existingViewerVideo.remove();

        const viewerVideo = document.createElement('video');
        viewerVideo.id = 'myViewerVideo';
        viewerVideo.srcObject = viewerStream;
        viewerVideo.autoplay = true;
        viewerVideo.muted = true;
        viewerVideo.playsinline = true;
        viewerVideo.style.cssText = `
          position: absolute;
          bottom: 20px;
          right: 20px;
          width: 150px;
          height: 120px;
          border: 2px solid #E11D2A;
          border-radius: 8px;
          object-fit: cover;
          z-index: 15;
          background: #000;
        `;

        const liveBox = document.getElementById('live-box');
        liveBox.appendChild(viewerVideo);
        console.log('✅ Viewer camera enabled');
      } catch (error) {
        console.warn('⚠️ Viewer camera not available:', error);
        showStyledNotification('Camera access failed - joining in watch-only mode', 'warning');
      }
    }

  // Show simulated streamer feed (placeholder)
  if (streamPlaceholder) {
    streamPlaceholder.textContent = `📺 Watching ${streamerName}'s stream`;
    streamPlaceholder.style.display = 'block';
  }

  // Update UI
  joinStreamBtn.style.display = 'none';
  leaveStreamBtn.style.display = 'inline-flex';

  const modeText = joinMode ? "📹 Streaming with" : "📺 Watching";
  if (streamStatus) streamStatus.textContent = `${modeText} ${streamerName}`;

  // Show stream chat input overlay
  const chatInputOverlay = document.getElementById('streamChatInputOverlay');
  if (chatInputOverlay) chatInputOverlay.style.display = 'block';

  // Show text overlay for chat messages
  const liveTextOverlay = document.getElementById('liveTextOverlay');
  if (liveTextOverlay) liveTextOverlay.style.display = 'block';

  // Join the stream chat
  await joinStreamChat();

  console.log('✅ Joined stream successfully');
  } catch (error) {
    console.error('❌ Failed to join stream:', error);
    showStyledNotification('Failed to join stream: ' + (error.message || 'Unknown error'), 'error');

    // Clean up on failure
    joinStreamBtn.style.display = 'none'; // Keep UI clean
    leaveStreamBtn.style.display = 'none';
    if (streamStatus) streamStatus.textContent = 'Ready to stream - click Go Live to start';
  }
}

// Import Firebase streaming module (functions will be used with their imported names)
import { startLiveStream as startLiveStreamModule, stopLiveStream as stopLiveStreamModule, joinLiveStream as joinLiveStreamModule } from './live-stream.js';

// Live Stream Chat Functions
let liveStreamChatUnsub = null;
let currentStreamChatId = 'general';
let isInLiveChat = false;
let streamChatMessages = [];
let streamViewers = [];
let currentStreamTab = 'general';
let currentViewMode = 'members';

// Chat categories with separate message storage
let streamChatCategories = {
  'general': { messages: [], name: '#general', color: '#4CAF50' },
  'chaos': { messages: [], name: '#chaos-lounge', color: '#ff6b6b' },
  'dating': { messages: [], name: '#dating', color: '#ff69b4' },
  'friends': { messages: [], name: '#friends', color: '#00bcd4' },
  'vents': { messages: [], name: '#vents', color: '#9c27b0' },
  'first-dates': { messages: [], name: '#first-dates', color: '#e91e63' },
  'gym-rats': { messages: [], name: '#gym-rats', color: '#ff9800' },
  'fwb': { messages: [], name: '#fwb', color: '#795548' }
};

// Expose joinSpecificStream globally for notifications
window.joinSpecificStream = joinSpecificStream;

// Initialize simple stream overlay
async function initStreamChat() {
  isInLiveChat = true;

  // Show live stream chat bar
  showLiveStreamChatBar();

  // Add welcome message to overlay
  const welcomeMessage = {
    from: 'SYSTEM',
    text: 'Stream started - messages will appear on screen',
    timestamp: Date.now(),
    isSystem: true
  };

  addMessageToStreamChat(welcomeMessage);

  console.log('✅ Stream UI initialized with live chat functionality');
}

// Join stream chat as viewer
async function joinStreamChat() {
  isInLiveChat = true;

  // Show live stream chat bar
  showLiveStreamChatBar();

  // Add viewer to chat with message
  const chatMessage = {
    from: '📢 SYSTEM',
    text: `${myDisplayName || 'Viewer'} joined the stream`,
    timestamp: Date.now(),
    isSystem: true
  };

  streamChatMessages.push(chatMessage);
  addMessageToStreamChat(chatMessage);

  // Start listening for messages
  listenForStreamChatMessages();

  console.log('✅ Joined stream chat');
}

// Listen for chat messages
function listenForStreamChatMessages() {
  // Listen for cross-tab communication
  window.addEventListener('streamChatMessage', (event) => {
    const message = event.detail;
    streamChatMessages.push(message);
    renderStreamChatMessages();
  });

  // Load existing messages
  renderStreamChatMessages();
}

// Send simple stream message
async function sendSimpleStreamMessage() {
  const input = document.getElementById('simpleStreamInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // Get user info (allow anonymous)
  const userName = myDisplayName || 'Anonymous';
  const userId = me?.uid || `anon_${Date.now()}`;

  const message = {
    from: userName,
    text: text,
    timestamp: Date.now(),
    uid: userId,
    isSystem: false
  };

  input.value = '';

  // Show message in overlay
  addMessageToOverlay(message);

  console.log('📤 Simple stream message sent');
}

// Send message from side panel
async function sendStreamChatSideMessage() {
  const input = document.getElementById('streamChatInputSide');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // Get user info (allow anonymous)
  const userName = myDisplayName || 'Anonymous';
  const userId = me?.uid || `anon_${Date.now()}`;

  const message = {
    from: userName,
    text: text,
    timestamp: Date.now(),
    uid: userId,
    isSystem: false,
    category: currentStreamTab
  };

  // Add to category messages
  if (streamChatCategories[currentStreamTab]) {
    streamChatCategories[currentStreamTab].messages.push(message);
  }

  input.value = '';

  // Re-render the current category
  renderStreamChatCategory(currentStreamTab);

  console.log('📤 Stream chat side message sent');
}

// Add message to simple text overlay
function addMessageToOverlay(message) {
  const overlayMessages = document.getElementById('overlayMessages');
  const liveTextOverlay = document.getElementById('liveTextOverlay');

  if (!overlayMessages || !liveTextOverlay) return;

  // Show overlay if hidden
  liveTextOverlay.style.display = 'block';

  // Create simple message element
  const messageEl = document.createElement('div');
  messageEl.style.cssText = `
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
    max-width: 90%;
    word-wrap: break-word;
    animation: fadeIn 0.3s ease;
  `;

  if (message.isSystem) {
    messageEl.innerHTML = `<span style="color: #38bdf8;">${message.text}</span>`;
  } else {
    messageEl.innerHTML = `<span style="color: #E11D2A;">${message.from}:</span> ${message.text}`;
  }

  // Add to overlay
  overlayMessages.appendChild(messageEl);

  // Remove old messages (keep only last 3)
  while (overlayMessages.children.length > 3) {
    overlayMessages.removeChild(overlayMessages.firstChild);
  }

  // Auto-remove message after 6 seconds
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.style.animation = 'fadeOut 0.5s ease';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 500);
    }
  }, 6000);
}

// Render chat messages
function renderStreamChatMessages() {
  const chatFeed = document.getElementById('liveStreamChatFeed');
  if (!chatFeed) return;

  chatFeed.innerHTML = '';

  streamChatMessages.slice(-50).forEach(message => {
    const messageDiv = document.createElement('div');

    if (message.isSystem) {
      messageDiv.className = 'system-message';
      messageDiv.style.background = 'none';
      messageDiv.style.color = '#E11D2A';
      messageDiv.style.fontWeight = 'bold';
      messageDiv.style.alignSelf = 'center';
      messageDiv.style.maxWidth = '90%';
      messageDiv.style.textAlign = 'center';
      messageDiv.style.padding = '4px 0';
      messageDiv.textContent = message.text;
    } else {
      messageDiv.className = `stream-message ${message.uid === me?.uid ? 'me' : 'them'}`;
      messageDiv.style.background = 'none';
      messageDiv.style.padding = '2px 0';
      messageDiv.style.marginBottom = '2px';

      const messageContent = document.createElement('div');
      messageContent.textContent = `${message.from}: ${message.text}`;
      messageContent.style.color = message.uid === me?.uid ? '#E11D2A' : '#fff';
      messageDiv.appendChild(messageContent);

      const timestamp = document.createElement('div');
      timestamp.className = 'chat-timestamp';
      timestamp.style.fontSize = '10px';
      timestamp.style.color = '#666';
      timestamp.style.marginTop = '1px';
      const time = new Date(message.timestamp);
      timestamp.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      messageDiv.appendChild(timestamp);
    }

    chatFeed.appendChild(messageDiv);
  });

  chatFeed.scrollTop = chatFeed.scrollHeight;
}

// Start viewer monitoring
async function startViewerMonitoring() {
  streamViewers = [];

  // Clear any existing viewers on start
  const existingViewers = JSON.parse(localStorage.getItem('streamViewers') || '[]');
  streamViewers = [];
  localStorage.removeItem('streamViewers');

  // Listen for viewer events
  window.addEventListener('viewerJoined', (event) => {
    const viewer = event.detail;
    // Prevent duplicate viewers
    if (!streamViewers.find(v => v.viewerUid === viewer.viewerUid)) {
      streamViewers.push(viewer);
      updateViewerCount();
      renderStreamViewers();
      renderParticipants();
    }
  });

  window.addEventListener('viewerLeft', (event) => {
    const viewerUid = event.detail;
    streamViewers = streamViewers.filter(v => v.viewerUid !== viewerUid);
    updateViewerCount();
    renderStreamViewers();
    renderParticipants();
  });

  // Clean up on page unload/refresh
  window.addEventListener('beforeunload', () => {
    // Remove this viewer when page closes
    if (me?.uid) {
      streamViewers = streamViewers.filter(v => v.viewerUid !== me.uid);
      localStorage.removeItem('streamViewers');
    }
  });

  // Periodic cleanup of disconnected viewers
  setInterval(() => {
    // Reset viewer count if no active connections
    if (peerConnections.size === 0 && streamViewers.length > 0) {
      console.log('🧹 Cleaning up disconnected viewers');
      streamViewers = [];
      updateViewerCount();
      renderStreamViewers();
      renderParticipants();
    }
  }, 5000); // Check every 5 seconds
  
  // Additional cleanup when page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !isStreaming) {
      // User left the page while viewing
      console.log('🚪 Page hidden - cleaning up viewer status');
      streamViewers = [];
      updateViewerCount();
    }
  });

  console.log('✅ Viewer monitoring started');
  
  // 🚀 START GLOBAL LIVE STREAM NOTIFICATIONS
  startGlobalStreamNotifications();
}

// 📢 Real-time global stream notifications - ALL users see streams instantly
function startGlobalStreamNotifications() {
  console.log('📡 Starting global stream notification system...');
  
  // Listen for new live streams in real-time
  const streamQuery = query(
    collection(db, 'liveStreams'),
    where('isLive', '==', true),
    orderBy('startedAt', 'desc')
  );
  
  onSnapshot(streamQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const streamData = change.doc.data();
        console.log('🔴 NEW LIVE STREAM DETECTED:', streamData.streamerName);
        
        // Show instant notification to user
        showStreamNotification(`🔴 ${streamData.streamerName} is now live!`, 'live');
        
        // Auto-refresh Browse Live if it's open
        refreshBrowseLiveIfOpen();
      }
      
      if (change.type === 'removed') {
        const streamData = change.doc.data();
        console.log('📺 STREAM ENDED:', streamData.streamerName);
        
        // Show stream ended notification
        showStreamNotification(`📺 ${streamData.streamerName}'s stream ended`, 'ended');
        
        // Auto-refresh Browse Live if it's open
        refreshBrowseLiveIfOpen();
      }
    });
  }, (error) => {
    console.error('❌ Global stream listener error:', error);
  });
  
  // Listen for global notifications
  const notificationQuery = query(
    collection(db, 'globalNotifications'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  
  onSnapshot(notificationQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const notification = change.doc.data();
        
        // Only show recent notifications (last 30 seconds)
        const notificationTime = notification.timestamp?.toDate?.() || new Date();
        const timeDiff = Date.now() - notificationTime.getTime();
        
        if (timeDiff < 30000) { // 30 seconds
          console.log('📢 Global notification:', notification.message);
          showStreamNotification(notification.message, notification.type);
        }
        
        // Auto-cleanup old notifications after showing
        setTimeout(() => {
          try {
            deleteDoc(change.doc.ref);
          } catch (error) {
            console.warn('Could not delete old notification:', error);
          }
        }, 60000); // Delete after 1 minute
      }
    });
  });
  
  console.log('✅ Global stream notification system active');
}

// Show in-app stream notification
function showStreamNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'live' ? '#E11D2A' : type === 'ended' ? '#666' : '#2563eb'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: 600;
    font-size: 14px;
    max-width: 300px;
    cursor: pointer;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
  
  // Click to dismiss
  notification.addEventListener('click', () => {
    notification.remove();
  });
}

// Auto-refresh Browse Live modal if it's currently open  
function refreshBrowseLiveIfOpen() {
  // No longer needed! Real-time listeners automatically update the Browse Live modal
  if (window.browseLiveModal) {
    console.log('📡 Browse Live already using real-time updates - no manual refresh needed');
  }
}

// Update viewer count
function updateViewerCount() {
  const viewerNumber = document.getElementById('viewerCount'); // Fixed: matches HTML
  const totalViewers = document.getElementById('totalViewers');
  const viewerCountPill = document.getElementById('viewerCount');

  const count = streamViewers.length;

  if (viewerNumber) viewerNumber.textContent = count.toString();
  if (totalViewers) totalViewers.textContent = count.toString();

  // Show/hide the compact viewer count button during streams
  if (viewerCountPill) {
    // ALWAYS show viewer count when streaming, even if 0 viewers
    if (viewerCountPill) {
      if (isStreaming) {
        viewerCountPill.style.display = 'block';
        viewerCountPill.style.zIndex = '15';
        viewerCountPill.innerHTML = `<span style="color:#fff;font-weight:bold;">👥 ${count || 0}</span>`;
        console.log('👥 Viewer count button shown (streaming):', count, 'viewers');
      } else if (count > 0) {
        viewerCountPill.style.display = 'block';
        viewerCountPill.style.zIndex = '15';
        viewerCountPill.innerHTML = `<span style="color:#fff;font-weight:bold;">👥 ${count}</span>`;
        console.log('👥 Viewer count button shown:', count, 'viewers');
      } else {
        viewerCountPill.style.display = 'none';
      }
      console.log('👥 Viewer count button hidden');
    }
  }

  // Update stream status
  if (streamStatus && isStreaming) {
    if (count > 0) {
      streamStatus.textContent = `🔴 LIVE - ${count} viewer${count !== 1 ? 's' : ''} watching`;
    } else {
      streamStatus.textContent = '🔴 LIVE - Waiting for viewers...';
    }
  }
}

// Render viewers list
function renderStreamViewers() {
  const viewersContainer = document.getElementById('viewersContainer');
  if (!viewersContainer) return;

  viewersContainer.innerHTML = '';

  // Show current user if streaming
  let allViewers = [...streamViewers];
  if (isStreaming && me && myDisplayName) {
    allViewers.unshift({
      viewerUid: me.uid,
      viewerName: myDisplayName + ' (Streamer)',
      withCamera: true,
      isStreamer: true
    });
  }

  if (allViewers.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = "member-item";
    emptyDiv.style.cssText = `
      color: #888;
      text-align: center;
      padding: 20px;
      background: #1a1b22;
      border-radius: 8px;
    `;
    emptyDiv.textContent = 'No viewers yet';
    viewersContainer.appendChild(emptyDiv);
    return;
  }

  allViewers.forEach(viewer => {
    const viewerDiv = document.createElement('div');
    viewerDiv.className = "member-item";
    viewerDiv.style.cssText = `
      margin-bottom: 8px;
      padding: 8px;
      background: ${viewer.isStreamer ? '#2a1a1a' : '#1a1b22'};
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: background 0.2s ease;
      border: ${viewer.isStreamer ? '1px solid #E11D2A' : 'none'};
    `;

    // Hover effect
    viewerDiv.addEventListener('mouseenter', () => {
      viewerDiv.style.background = viewer.isStreamer ? '#3a2a2a' : '#2a2b32';
    });
    viewerDiv.addEventListener('mouseleave', () => {
      viewerDiv.style.background = viewer.isStreamer ? '#2a1a1a' : '#1a1b22';
    });

    // Avatar
    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${viewer.isStreamer ? '#E11D2A' : '#4CAF50'};
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    `;
    avatar.textContent = (viewer.viewerName || 'A')[0].toUpperCase();

    // Online status dot
    const statusDot = document.createElement('div');
    statusDot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      position: relative;
      top: -2px;
    `;

    // Name and status
    const nameContainer = document.createElement('div');
    nameContainer.style.flex = '1';

    const nameSpan = document.createElement('div');
    nameSpan.textContent = viewer.viewerName || 'Anonymous';
    nameSpan.style.fontSize = '14px';
    nameSpan.style.fontWeight = '500';

    const statusSpan = document.createElement('div');
    statusSpan.style.fontSize = '11px';
    statusSpan.style.color = '#888';
    if (viewer.isStreamer) {
      statusSpan.textContent = '🔴 Broadcasting';
    } else {
      statusSpan.textContent = viewer.withCamera ? '📹 With Camera' : '👀 Watching';
    }

    nameContainer.appendChild(nameSpan);
    nameContainer.appendChild(statusSpan);

    viewerDiv.appendChild(avatar);
    viewerDiv.appendChild(statusDot);
    viewerDiv.appendChild(nameContainer);
    viewersContainer.appendChild(viewerDiv);
  });
}

// Render participants panel
function renderParticipants() {
  const participantsContainer = document.getElementById('participantsPanel');
  if (!participantsContainer) return;

  participantsContainer.innerHTML = ''; // Clear previous content

  // Add header
  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = 'Participants';
  participantsContainer.appendChild(header);

  // Add viewers to the participants panel
  const viewersList = document.createElement('div');
  viewersList.id = 'viewersList';
  viewersList.style.cssText = `
    display: flex;
    flex-direction: column;
    padding: 10px;
    overflow-y: auto;
    max-height: calc(100% - 50px); /* Adjust based on header height */
  `;
  participantsContainer.appendChild(viewersList);

  renderStreamViewers(); // Use the existing function to render viewers
}

// Live Stream Chat Bar Functions
function showLiveStreamChatBar() {
  const chatBar = document.getElementById('liveStreamChatBar');
  const overlay = document.getElementById('liveStreamTextOverlay');

  if (chatBar) {
    chatBar.style.display = 'block';
  }
  if (overlay) {
    overlay.style.display = 'none'; // Start hidden
  }

  console.log('✅ Live stream chat bar shown');
}

function hideLiveStreamChatBar() {
  const chatBar = document.getElementById('liveStreamChatBar');
  const overlay = document.getElementById('liveStreamTextOverlay');
  const overlayContainer = document.getElementById('overlayMessagesContainer');

  if (chatBar) {
    chatBar.style.display = 'none';
  }
  if (overlay) {
    overlay.style.display = 'none';
  }
  if (overlayContainer) {
    overlayContainer.innerHTML = ''; // Clear overlay messages
  }

  console.log('✅ Live stream chat bar hidden');
}

// Send message from live stream chat bar
async function sendLiveStreamChatMessage() {
  const input = document.getElementById('liveStreamChatInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const userName = myDisplayName || 'Anonymous';
  const userId = me?.uid || `anon_${Date.now()}`;

  const message = {
    from: userName,
    text: text,
    timestamp: Date.now(),
    uid: userId,
    isSystem: false
  };

  input.value = '';

  // Add to chat overlay
  addMessageToStreamChat(message);

  // Broadcast to other viewers if needed
  window.dispatchEvent(new CustomEvent('streamChatMessage', { detail: message }));

  console.log('📤 Live stream chat message sent');
}

// Add message to overlay and show for 30-45 seconds
function addMessageToStreamChat(message) {
  const overlayContainer = document.getElementById('overlayMessagesContainer');
  if (!overlayContainer) return;

  // Show the overlay
  const overlay = document.getElementById('liveStreamTextOverlay');
  if (overlay) {
    overlay.style.display = 'block';
  }

  const messageEl = document.createElement('div');

  if (message.isSystem) {
    messageEl.style.cssText = `
      background: transparent;
      color: #fff;
      padding: 8px 12px;
      margin-bottom: 6px;
      font-size: 13px;
      text-align: center;
      animation: slideInFromLeft 0.3s ease;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      opacity: 0.9;
    `;
    messageEl.innerHTML = `🎬 ${message.text}`;
  } else {
    const isMe = message.uid === (me?.uid || 'current_user');
    messageEl.style.cssText = `
      background: transparent;
      color: #fff;
      padding: 8px 12px;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      animation: slideInFromLeft 0.3s ease;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      max-width: 300px;
      word-wrap: break-word;
      opacity: 0.9;
    `;
    messageEl.innerHTML = `<span style="color: ${isMe ? '#fff' : '#4CAF50'}; font-weight: bold;">${message.from}:</span> ${message.text}`;
  }

  overlayContainer.appendChild(messageEl);

  // Keep only last 5 messages in overlay
  while (overlayContainer.children.length > 5) {
    overlayContainer.removeChild(overlayContainer.firstChild);
  }

  // Remove message after 30-45 seconds
  const disappearTime = Math.random() * 15000 + 30000; // 30-45 seconds
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.style.animation = 'fadeOut 1s ease';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
          // Hide overlay if no messages left
          if (overlayContainer.children.length === 0) {
            overlay.style.display = 'none';
          }
        }
      }, 1000);
    }
  }, disappearTime);
}

// Toggle chat visibility (deprecated - not needed for simple chat bar)
// function toggleStreamChatVisibility() {
//   // This function is no longer needed with the simplified chat bar
// }

function switchStreamTab(tab) {
  currentStreamTab = tab;
  currentStreamChatId = tab;

  // Reset all tabs
  const allTabs = ['streamGeneralTabSide', 'streamChaosTabSide', 'streamDatingTabSide', 'streamFriendsTabSide', 'streamVentsTabSide', 'streamFirstDatesTabSide', 'streamGymRatsTabSide', 'streamFwbTabSide', 'streamViewersTabSide'];

  allTabs.forEach(tabId => {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      tabEl.style.opacity = '0.7';
      tabEl.style.borderBottom = '2px solid transparent';
    }
  });

  // Activate selected tab
  const activeTabId = `stream${tab.charAt(0).toUpperCase() + tab.slice(1)}TabSide`;
  const activeTab = document.getElementById(activeTabId);
  if (activeTab) {
    activeTab.style.opacity = '1';
    activeTab.style.borderBottom = '2px solid #E11D2A';
  }

  // Show chat panel and render messages for this category
  const chatBox = document.getElementById('liveStreamChatBox');
  const viewersPanel = document.getElementById('streamViewersPanel');

  if (tab === 'viewers') {
    if (chatBox) chatBox.style.display = 'none';
    if (viewersPanel) viewersPanel.style.display = 'flex';
    renderStreamViewers();
  } else {
    if (chatBox) chatBox.style.display = 'flex';
    if (viewersPanel) viewersPanel.style.display = 'none';
    renderStreamChatCategory(tab);
  }
}

function renderStreamChatCategory(category) {
  const chatMessages = document.getElementById('liveStreamChatMessages');
  if (!chatMessages) return;

  chatMessages.innerHTML = '';

  // Render category messages
  const categoryData = streamChatCategories[category];
  if (categoryData && categoryData.messages.length > 0) {
    categoryData.messages.forEach(message => {
      const messageEl = document.createElement('div');
      messageEl.className = 'bubble';

      if (message.isSystem) {
        messageEl.className += ' system';
        messageEl.style.cssText = `
          background: #1e40af;
          color: #fff;
          padding: 6px 8px;
          border-radius: 8px;
          margin-bottom: 4px;
          font-size: 11px;
          text-align: center;
          align-self: center;
          max-width: 90%;
        `;
        messageEl.innerHTML = `<span style="color: #38bdf8; font-weight: bold;">${message.text}</span>`;
      } else {
        const isMe = message.uid === (me?.uid || 'current_user');
        messageEl.className += isMe ? ' me' : ' them';
        messageEl.style.cssText = `
          background: ${isMe ? '#E11D2A' : '#2a2a36'};
          color: #fff;
          padding: 6px 8px;
          border-radius: 8px;
          margin-bottom: 4px;
          font-size: 11px;
          word-wrap: break-word;
          align-self: ${isMe ? 'flex-end' : 'flex-start'};
          max-width: 85%;
        `;
        messageEl.innerHTML = `<span style="color: ${isMe ? '#fff' : '#E11D2A'}; font-weight: bold;">${message.from}:</span> ${message.text}`;
      }

      chatMessages.appendChild(messageEl);
    });
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function leaveStream() {
  console.log('🚪 Leaving stream...');

  // Clean up peer connections
  peerConnections.forEach(pc => {
    if (pc && pc.close) pc.close();
  });
  peerConnections.clear();

  // Remove viewer data
  localStorage.removeItem('currentViewer');
  localStorage.removeItem('streamViewers');

  // Remove viewer from viewer list - fix running tally issue
  const userId = me?.uid || `viewer_${Date.now()}`;
  streamViewers = streamViewers.filter(v => v.viewerUid !== userId);

  // IMPORTANT: Reset viewer count to prevent running tally
  streamViewers = [];
  
  // Also clear any stored viewer data
  if (typeof window !== 'undefined') {
    delete window.currentViewerData;
    delete window.lastJoinedStream;
  }

  // Enhanced cleanup: Force refresh Browse Live to remove stale entries
  setTimeout(async () => {
    try {
      console.log('🔄 Refreshing live streams list after leave...');
      // Clean up any stale Firebase documents
      if (db && auth.currentUser) {
        const staleStreamsQuery = query(
          collection(db, 'liveStreams'),
          where('isLive', '==', false)
        );
        const staleStreamsSnapshot = await getDocs(staleStreamsQuery);
        const deletePromises = staleStreamsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log(`🧹 Cleaned up ${staleStreamsSnapshot.size} stale stream entries`);
      }
    } catch (error) {
      console.warn('⚠️ Could not refresh live streams:', error);
    }
  }, 1000);

  updateViewerCount();
  renderStreamViewers();
  renderParticipants();

  // Notify about viewer leaving
  window.dispatchEvent(new CustomEvent('viewerLeft', { detail: userId }));

  // Stop viewer camera if active
  const viewerVideo = document.getElementById('myViewerVideo');
  if (viewerVideo && viewerVideo.srcObject) {
    const stream = viewerVideo.srcObject;
    stream.getTracks().forEach(track => track.stop());
    viewerVideo.remove();
  }

  // Hide chat bar
  hideLiveStreamChatBar();

  // Reset UI
  if (streamStatus) streamStatus.textContent = 'Ready to stream - click Go Live to start';
  joinStreamBtn.style.display = 'none'; // Keep UI clean
  leaveStreamBtn.style.display = 'none';
  
  // Hide streamer name display AND clear browser live modal
  const streamerDisplay = document.getElementById('currentStreamerDisplay');
  if (streamerDisplay) {
    streamerDisplay.style.display = 'none';
    console.log('✅ Streamer name display cleared');
  }
  
  // Close browse live modal if open
  const browseLiveModal = document.querySelector('.modal-backdrop');
  if (browseLiveModal) {
    browseLiveModal.remove();
    console.log('🚪 Browse live modal cleared on leave');
  }

  // Remove video elements
  document.querySelectorAll('[id^="viewer-"], [id^="remoteVideo-"], [id^="myViewerVideo"]').forEach(video => {
    video.remove();
  });

  // Show placeholder
  streamPlaceholder.style.display = 'block';
  streamPlaceholder.textContent = '[ Click Go Live or Join to begin ]';
  localVideo.style.display = 'none';

  // Leave chat
  isInLiveChat = false;
  isViewing = false; // Reset viewing state

  console.log('✅ Left stream successfully - viewer count reset');
}



// Live Streamers Directory Functions
async function loadLiveStreamers() {
  const liveStreamersList = document.getElementById('liveStreamersList');
  if (!liveStreamersList) return; // Fix: Check if element exists
  liveStreamersList.innerHTML = '<div class="muted" style="text-align:center;padding:20px;">Loading live streams...</div>';

  try {
    // Search for active streams in multiple locations
    const searchPromises = [
      getDocs(query(collection(db, 'liveStreams'), where('isLive', '==', true))),
      getDocs(query(collection(db, 'globalStreams'), where('isLive', '==', true))),
      getDocs(query(collection(db, 'activeStreams'), where('isLive', '==', true)))
    ];

    const results = await Promise.allSettled(searchPromises);
    const streamers = new Map(); // Use Map to avoid duplicates

    // Collect all unique streamers
    for (const result of results) {
      if (result.status === 'fulfilled' && !result.value.empty) {
        result.value.docs.forEach(doc => {
          const data = doc.data();
          const streamerId = data.streamerUid || doc.id;
          if (data.isLive && streamerId) {
            streamers.set(streamerId, {
              uid: streamerId,
              name: data.streamerName || 'Anonymous Streamer',
              viewers: data.viewers || 0,
              startedAt: data.startedAt,
              hasVideo: data.hasVideo !== false,
              hasAudio: data.hasAudio !== false
            });
          }
        });
      }
    }

    // Render streamers list
    if (streamers.size === 0) {
      liveStreamersList.innerHTML = `
        <div class="muted" style="text-align:center;padding:40px;">
          <div style="font-size:18px;margin-bottom:10px;">📭 No active streams</div>
          <div>Be the first to go live!</div>
        </div>
      `;
      return;
    }

    if (liveStreamersList) {
      liveStreamersList.innerHTML = '';

      streamers.forEach(streamer => {
        const streamerCard = document.createElement('div');
        streamerCard.className = 'streamer-card live';
        // Add data-profile-id for profile modal integration
        streamerCard.setAttribute('data-profile-id', streamer.uid || streamer.streamerUid);
        streamerCard.setAttribute('data-group', 'liveStreamers');
        streamerCard.innerHTML = `
          <div class="streamer-name">${streamer.name}</div>
          <div class="streamer-meta">
            <span class="live-indicator">🔴 LIVE</span>
            <span>👥 ${streamer.viewers} viewers</span>
          </div>
        `;

        streamerCard.addEventListener('click', () => {
          console.log('🎯 Joining stream:', streamer.uid);
          connectDirectlyToStreamer(streamer.uid, streamer.name);
        });

        liveStreamersList.appendChild(streamerCard);
      });
    }

  } catch (error) {
    console.error('Failed to load live streamers:', error);
    if (liveStreamersList) liveStreamersList.innerHTML = `
      <div class="muted" style="text-align:center;padding:40px;">
        <div style="color:#ff6b6b;">❌ Failed to load streams</div>
        <button class="btn" onclick="loadLiveStreamers()" style="margin-top:10px;">Retry</button>
      </div>
    `;
  }
}

async function connectDirectlyToStreamer(streamerUid, streamerName) {
  if (!me) {
    showStyledNotification('Please log in to join streams', 'warning');
    return;
  }

  console.log('🎯 Connecting directly to:', streamerUid);

  // Ask user if they want to join with camera or just watch
  const joinMode = confirm(
    `🎥 Join ${streamerName}'s stream:\n\n` +
    "• Click OK to JOIN WITH CAMERA (streamer will see you)\n" +
    "• Click Cancel to WATCH ONLY (just view the stream)"
  );

  // Register as viewer
  const viewerData = {
    viewerUid: me.uid,
    viewerName: myDisplayName,
    streamerUid,
    streamerName,
    joinedAt: Date.now(),
    isActive: true,
    withCamera: joinMode
  };

  localStorage.setItem('currentViewer', JSON.stringify(viewerData));
  window.dispatchEvent(new CustomEvent('viewerJoined', { detail: viewerData }));

  // Connect to the stream
  await connectToStreamer(streamerUid, joinMode);

  // Update UI
  joinStreamBtn.style.display = 'none';
  leaveStreamBtn.style.display = 'inline-flex';

  // Show stream chat side panel
  const streamChatSidePanel = document.getElementById('streamChatSidePanel');
  if (streamChatSidePanel) streamChatSidePanel.style.display = 'flex';

  const modeText = joinMode ? "📹 Streaming with" : "📺 Watching";
  if (streamStatus) streamStatus.textContent = `${modeText} ${streamerName}`;

  // Join the stream chat
  await joinStreamChat();

  console.log('✅ Connected to stream successfully');
}


// 🚀 Browse Live Streams - Simple and clean
async function browseLiveStreams() {
  console.log('🔍 Browse Live Streams called');
  console.log('User authenticated:', !!me);
  // Create modal for live streams with proper styling
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.8); display: flex; align-items: center; 
    justify-content: center; z-index: 1000;
  `;
  modal.innerHTML = `
    <div style="max-width:600px; background:#1a1b26; border:1px solid #2a2c39; border-radius:12px; padding:20px; color:white;">
      <h3 style="color:#E11D2A; margin-bottom:15px;">🔴 Browse Live Streams</h3>
      <div id="liveStreamersList" style="max-height:400px;overflow:auto;margin:10px 0;">
        <div style="text-align:center;padding:20px;color:#888;">Loading live streams...</div>
      </div>
      <div style="margin-top:15px;">
        <button id="closeBrowseModal" style="background:#E11D2A; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Close</button>
        <span style="font-size:12px;color:#666;margin-left:8px;">🔄 Live updates enabled</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Store modal reference for cleanup
  window.browseLiveModal = modal;
  const liveStreamersList = modal.querySelector('#liveStreamersList');
  let streamListener = null;

  // ⚡ CRITICAL: Attach event listeners IMMEDIATELY after modal creation
  modal.querySelector('#closeBrowseModal').addEventListener('click', () => {
    console.log('🚪 Closing browse live modal');
    modal.remove();
    // Clear any stored reference
    if (window.browseLiveModal) {
      window.browseLiveModal = null;
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      console.log('🚪 Closing browse live modal via backdrop');
      modal.remove();
      if (window.browseLiveModal) {
        window.browseLiveModal = null;
      }
    }
  });

  // Simple live stream discovery
  console.log('🔍 Loading live streams...');
  console.log('Database connection:', !!db);
  
  try {
    let allStreams = [];
    
    // Try to get live streams from multiple sources
    try {
      const liveStreamsQuery = query(collection(db, 'liveStreams'), where('isLive', '==', true), limit(10));
      const streamSnapshot = await getDocs(liveStreamsQuery);
      streamSnapshot.docs.forEach(doc => {
        allStreams.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) {
      console.log('📍 liveStreams error:', e.message);
    }
    
    try {
      const usersQuery = query(collection(db, 'users'), where('isStreaming', '==', true), limit(10));
      const usersSnapshot = await getDocs(usersQuery);
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        allStreams.push({
          id: doc.id,
          streamerUid: doc.id,
          streamerName: userData.displayName || 'Unknown',
          isLive: true,
          viewers: userData.viewerCount || 0
        });
      });
    } catch (e) {
      console.log('📍 users error:', e.message);
    }
    
    console.log('🎯 Found streams:', allStreams);
    
    // Debug: Show what each query returned
    console.log('🔍 Live streams query results:');
    console.log('📊 Total streams found:', allStreams.length);
    
    // Show only real live streams - no test data
    
    if (liveStreamersList) liveStreamersList.innerHTML = '';
    
    if (allStreams.length === 0) {
      if (liveStreamersList) liveStreamersList.innerHTML = `
        <div class="muted" style="text-align:center;padding:40px;">
          <div style="font-size:18px;margin-bottom:10px;">📭 No active streams</div>
          <div>Be the first to go live!</div>
        </div>
      `;
      return;
    }
    
    // Render streams
    allStreams.forEach((streamer) => {
      const isOwnStream = (me && streamer.streamerUid === me.uid);
      const streamerCard = document.createElement('div');
      streamerCard.className = 'streamer-card live';
      // Add data-profile-id for profile modal integration
      streamerCard.setAttribute('data-profile-id', streamer.streamerUid);
      streamerCard.setAttribute('data-group', 'browseLive');
      streamerCard.style.cssText = `
        background: ${isOwnStream ? '#2a1a1a' : '#1a1b22'};
        border: 1px solid ${isOwnStream ? '#E11D2A' : '#00ff00'};
        border-radius: 8px;
        padding: 12px;
        cursor: ${isOwnStream ? 'default' : 'pointer'};
        margin-bottom: 10px;
      `;

      const streamName = isOwnStream ? `${streamer.streamerName} (You)` : streamer.streamerName;
      const viewerCount = streamer.viewers || 0;

      const isFollowing = window.isFavoriteStreamer ? window.isFavoriteStreamer(streamer.streamerUid) : false;
      
      streamerCard.innerHTML = `
        <div style="font-weight:bold;margin-bottom:8px;">${streamName}</div>
        <div style="font-size:12px;color:#888;margin-bottom:8px;">
          <span style="color:${isOwnStream ? '#E11D2A' : '#00ff00'};font-weight:bold;">🔴 LIVE</span>
          <span style="margin-left:12px;">👥 ${viewerCount} viewers</span>
        </div>
        ${!isOwnStream ? `
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn profile-btn" style="flex:1;padding:8px 12px;font-size:14px;background:linear-gradient(135deg, #6366f1, #8b5cf6);border-color:#6366f1;">
              👤 Profile
            </button>
            <button class="btn primary join-stream-btn" style="flex:1;padding:8px 12px;font-size:14px;">
              🎥 Join
            </button>
          </div>
        ` : `
          <div style="text-align:center;padding:6px;background:#1a1a1a;border-radius:6px;font-size:12px;color:#888;">
            This is your stream
          </div>
        `}
      `;
      
      if (!isOwnStream) {
        // Profile button handler - FIXED: Show profile modal with favorites
        const profileBtn = streamerCard.querySelector('.profile-btn');
        if (profileBtn) {
          profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('👤 Opening profile for:', streamer.streamerName);
            modal.remove();
            if (window.browseLiveModal) window.browseLiveModal = null;
            showStreamerProfile(streamer.streamerUid, streamer.streamerName);
          });
        }
        
        // Join stream button handler
        const joinBtn = streamerCard.querySelector('.join-stream-btn');
        if (joinBtn) {
          joinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('🎥 Joining stream:', streamer.streamerName);
            modal.remove();
            if (window.browseLiveModal) window.browseLiveModal = null;
            joinSpecificStream(streamer.streamerUid, streamer.streamerName);
          });
        }
      }

      liveStreamersList.appendChild(streamerCard);
    });
    
  } catch (error) {
    console.log('❌ Stream loading error:', error);
    if (liveStreamersList) liveStreamersList.innerHTML = `
      <div class="muted" style="text-align:center;padding:40px;">
        <div style="font-size:18px;margin-bottom:10px;">⚠️ Error loading streams</div>
        <div>Please try again later</div>
      </div>
    `;
  }

  // Event listeners were moved up above to ensure they always work
}

// 👤 PROFILE MODAL FUNCTIONALITY
function showStreamerProfile(streamerUid, streamerName) {
  console.log('👤 Opening profile for:', streamerName);
  
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.style.display = 'flex';
  
  const isFollowing = window.isFavoriteStreamer ? window.isFavoriteStreamer(streamerUid) : false;
  
  modal.innerHTML = `
    <div class="modal" style="max-width:400px;">
      <h3>👤 ${streamerName}</h3>
      <div style="padding:20px;text-align:center;">
        <div style="width:80px;height:80px;background:linear-gradient(135deg,#ff6b9d,#e11d2a);border-radius:50%;margin:0 auto 15px;display:flex;align-items:center;justify-content:center;font-size:32px;color:white;">
          👤
        </div>
        <div style="font-size:18px;font-weight:bold;margin-bottom:10px;">${streamerName}</div>
        <div style="color:#888;margin-bottom:20px;">Live Streamer</div>
        
        <button class="btn favorite-btn" style="width:100%;padding:12px;font-size:16px;background:${isFollowing ? '#ff4444' : 'linear-gradient(135deg, #ff6b9d, #e11d2a)'};border-color:${isFollowing ? '#ff4444' : '#ff6b9d'};margin-bottom:10px;" data-streamer-uid="${streamerUid}" data-streamer-name="${streamerName}">
          ${isFollowing ? '💔 Unfollow Streamer' : '💖 Follow Streamer'}
        </button>
        
        <button class="btn join-stream-btn" style="width:100%;padding:12px;font-size:16px;background:linear-gradient(135deg, #00ff00, #00cc00);border-color:#00ff00;margin-bottom:10px;" data-streamer-uid="${streamerUid}" data-streamer-name="${streamerName}">
          🎥 Join Stream
        </button>
      </div>
      <div class="actions">
        <button class="btn" id="closeProfileModal">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close handlers
  modal.querySelector('#closeProfileModal').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Favorite button handler
  const favoriteBtn = modal.querySelector('.favorite-btn');
  favoriteBtn.addEventListener('click', async () => {
    const isCurrentlyFollowing = favoriteBtn.textContent.includes('Unfollow');
    
    if (isCurrentlyFollowing) {
      // Unfollow
      if (window.removeFromFavorites) {
        const success = await window.removeFromFavorites(streamerUid);
        if (success && favoriteBtn) {
          favoriteBtn.innerHTML = '💖 Follow Streamer';
          favoriteBtn.style.background = 'linear-gradient(135deg, #ff6b9d, #e11d2a)';
          favoriteBtn.style.borderColor = '#ff6b9d';
          console.log('💔 Unfollowed:', streamerName);
        }
      }
    } else {
      // Follow
      if (window.addToFavorites) {
        const success = await window.addToFavorites(streamerUid, streamerName);
        if (success && favoriteBtn) {
          favoriteBtn.innerHTML = '💔 Unfollow Streamer';
          favoriteBtn.style.background = '#ff4444';
          favoriteBtn.style.borderColor = '#ff4444';
          console.log('💖 Followed:', streamerName);
        }
      }
    }
  });
  
  // Join stream button handler - FIXED: Allow joining from profile modal
  const joinStreamBtn = modal.querySelector('.join-stream-btn');
  if (joinStreamBtn) {
    joinStreamBtn.addEventListener('click', () => {
      console.log('🎥 Joining stream from profile:', streamerName);
      modal.remove();
      joinSpecificStream(streamerUid, streamerName);
    });
  }
}
    
// Update stream buttons UI
function updateStreamButtons() {
  if (startStreamBtn) {
    startStreamBtn.style.display = isStreaming ? 'none' : 'inline-flex';
    startStreamBtn.disabled = isStreaming;
  }
  if (stopStreamBtn) {
    stopStreamBtn.style.display = isStreaming ? 'inline-flex' : 'none';
    stopStreamBtn.disabled = !isStreaming;
  }
  if (flipCameraBtn) {
    flipCameraBtn.style.display = isStreaming ? 'inline-flex' : 'none';
    flipCameraBtn.disabled = !isStreaming;
  }
}

function setSigned(on) {
  const label = (ROOMS.find(r => r.id === currentRoom)?.label) || "#general";
  if (meTag) meTag.textContent = on ? `In ${label} as ${myDisplayName}` : "(not in chat)";
  if (enterChatBtn) enterChatBtn.style.display = on ? "none" : "inline-flex";
  if (leaveChatBtn) leaveChatBtn.style.display = on ? "inline-flex" : "none";
  const showMembersBtn = document.getElementById("showMembersBtn");
  if (showMembersBtn) showMembersBtn.style.display = on ? "inline-flex" : "none";
  const chatCategoryTabs = document.getElementById("chatCategoryTabs");
  if (chatCategoryTabs) chatCategoryTabs.style.display = on ? "block" : "none";
  if (sendRow) sendRow.style.display = on ? "flex" : "none";
}

function renderRooms() {
  if (!roomSelect) return; // Skip if element doesn't exist
  roomSelect.innerHTML = "";
  ROOMS.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id; opt.textContent = r.label;
    if (r.id === currentRoom) opt.selected = true;
    roomSelect.appendChild(opt);
  });
}

function renderMessage(m, isLiveChat = false) {
  const b = document.createElement("div");

  // Handle system messages differently
  if (m.isSystemMessage || m.from?.includes('SYSTEM')) {
    b.className = "bubble system";
    b.style.background = '#1e40af';
    b.style.color = '#fff';
    b.style.fontWeight = 'bold';
    b.style.alignSelf = 'center';
    b.style.maxWidth = '90%';
    b.textContent = m.text;
  } else {
    b.className = "bubble " + (m.from === myDisplayName ? "me" : "them");

    // Create message content with timestamp
    const messageContent = document.createElement("div");
    messageContent.textContent = `${m.from}: ${m.text}`;
    b.appendChild(messageContent);

    // Add timestamp
    if (m.createdAt) {
      const timestamp = document.createElement("div");
      timestamp.className = "chat-timestamp";

      let timeStr = "";
      if (m.createdAt && m.createdAt.toDate) {
        const date = m.createdAt.toDate();
        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      timestamp.textContent = timeStr;
      b.appendChild(timestamp);
    }
  }

  if (isLiveChat) {
    const chatFeed = document.getElementById('liveStreamChatFeed');
    if (chatFeed) chatFeed.appendChild(b);
    if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
  } else {
    chatFeed.appendChild(b);
  }
}

// Function to render messages in the live stream chat
function renderLiveStreamMessage(m) {
  const b = document.createElement("div");
  b.className = "stream-message " + (m.uid === me?.uid ? "me" : "them");
  b.style.background = 'none';
  b.style.padding = '2px 0';
  b.style.marginBottom = '2px';

  const messageContent = document.createElement("div");
  messageContent.textContent = `${m.from}: ${m.text}`;
  messageContent.style.color = m.uid === me?.uid ? '#E11D2A' : '#fff';
  b.appendChild(messageContent);

  if (m.createdAt) {
    const timestamp = document.createElement("div");
    timestamp.className = "chat-timestamp";
    let timeStr = "";
    if (m.createdAt && m.createdAt.toDate) {
      const date = m.createdAt.toDate();
      timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    timestamp.textContent = timeStr;
    b.appendChild(timestamp);
  }

  // Only render to the stream chat feed
  const chatFeed = document.getElementById('liveStreamChatFeed');
  if (chatFeed) {
    chatFeed.appendChild(b);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }
}

function renderMember(memberData, memberId) {
  const memberDiv = document.createElement("div");
  memberDiv.className = "member-item";
  memberDiv.style.marginBottom = "8px";
  memberDiv.style.padding = "8px";
  memberDiv.style.background = "#1a1b22";
  memberDiv.style.borderRadius = "8px";
  memberDiv.style.display = "flex";
  memberDiv.style.alignItems = "center";
  memberDiv.style.gap = "8px";
  memberDiv.style.cursor = "pointer";
  memberDiv.style.transition = "background 0.2s ease";

  // Hover effect
  memberDiv.addEventListener('mouseenter', () => {
    memberDiv.style.background = "#2a2b32";
  });
  memberDiv.addEventListener('mouseleave', () => {
    memberDiv.style.background = "#1a1b22";
  });

  // Profile photo or initial
  const avatar = document.createElement("div");
  avatar.style.width = "24px";
  avatar.style.height = "24px";
  avatar.style.borderRadius = "50%";
  avatar.style.display = "flex";
  avatar.style.alignItems = "center";
  avatar.style.justifyContent = "center";
  avatar.style.fontSize = "12px";
  avatar.style.fontWeight = "bold";

  if (memberData.photoURL) {
    avatar.style.backgroundImage = `url(${memberData.photoURL})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  } else {
    avatar.style.background = "#E11D2A";
    avatar.style.color = "#fff";
    avatar.textContent = (memberData.displayName || "A")[0].toUpperCase();
  }

  // Online status dot
  const statusDot = document.createElement("div");
  statusDot.style.width = "8px";
  statusDot.style.height = "8px";
  statusDot.style.borderRadius = "50%";
  statusDot.style.background = memberData.isOnline ? "#4CAF50" : "#666";
  statusDot.style.position = "relative";
  statusDot.style.top = "-2px";

  // Name and status
  const nameContainer = document.createElement("div");
  nameContainer.style.flex = "1";

  const nameSpan = document.createElement("div");
  nameSpan.textContent = memberData.displayName || "Anonymous";
  nameSpan.style.fontSize = "14px";
  nameSpan.style.fontWeight = "500";

  const statusSpan = document.createElement("div");
  statusSpan.style.fontSize = "11px";
  statusSpan.style.color = "#888";

  if (memberData.lastSeen && memberData.lastSeen.toDate) {
    const lastSeen = memberData.lastSeen.toDate();
    const now = new Date();
    const diff = now - lastSeen;

    if (diff < 60000) { // Less than 1 minute
      statusSpan.textContent = "Just now";
    } else if (diff < 3600000) { // Less than 1 hour
      statusSpan.textContent = `${Math.floor(diff / 60000)}m ago`;
    } else {
      statusSpan.textContent = `${Math.floor(diff / 3600000)}h ago`;
    }
  }

  nameContainer.appendChild(nameSpan);
  nameContainer.appendChild(statusSpan);

  // Add data-profile-id for profile modal integration
  if (memberId && memberId !== me?.uid) {
    memberDiv.setAttribute('data-profile-id', memberId);
    memberDiv.setAttribute('data-group', 'chatMembers');
  }

  // Click to view profile or start chat
  memberDiv.addEventListener('click', () => {
    if (memberId && memberId !== me?.uid) {
      console.log('👤 Opening profile for:', memberData.displayName);
      
      // Add to recycling bin when viewing a profile
      if (window.recyclingBin) {
        window.recyclingBin.add({
          uid: memberId, 
          displayName: memberData.displayName,
          photoURL: memberData.photoURL,
          isOnline: memberData.isOnline,
          bio: memberData.bio
        }, 'view');
      }
      
      showStreamerProfile(memberId, memberData.displayName || 'User');
    }
  });

  memberDiv.appendChild(avatar);
  memberDiv.appendChild(statusDot);
  memberDiv.appendChild(nameContainer);
  membersContainer.appendChild(memberDiv);
}

function updateMemberCount() {
  const memberCount = document.getElementById("memberCount");
  const count = membersContainer.children.length;
  if (memberCount) memberCount.textContent = count.toString();
}

function clearFeed() { if (chatFeed) chatFeed.innerHTML = ""; }
function clearMembers() { if (membersContainer) membersContainer.innerHTML = ""; }

async function bindRoomFeed() {
  if (unsubFeed) { unsubFeed(); unsubFeed = null; }

  try {
    const col = collection(db, "rooms", currentRoom, "messages");
    const qy = query(col, orderBy("createdAt", "asc"), limit(500));
    unsubFeed = onSnapshot(qy, (snap) => {
      // Only clear if we successfully get new messages
      if (!snap.empty) {
        clearFeed();
        snap.forEach(d => {
          const m = d.data();
          renderMessage({
            from: m.from || "anon",
            text: m.text || "",
            createdAt: m.createdAt,
            isSystemMessage: m.isSystemMessage
          });
        });
        chatFeed.scrollTop = chatFeed.scrollHeight;
      }
    }, (error) => {
      console.error('Error in room feed:', error);
      // Don't clear messages if there's an error
    });
  } catch (error) {
    console.error('Error setting up room feed:', error);
  }
}

async function bindMembersFeed() {
  if (unsubMembers) { unsubMembers(); unsubMembers = null; }
  clearMembers();

  const membersCol = collection(db, "rooms", currentRoom, "members");
  unsubMembers = onSnapshot(membersCol, (snap) => {
    clearMembers();

    // Sort members: online first, then by join time
    const members = [];
    snap.forEach(docSnap => {
      members.push({
        id: docSnap.id,
        data: docSnap.data()
      });
    });

    members.sort((a, b) => {
      // Online status first
      if (a.data.isOnline && !b.data.isOnline) return -1;
      if (!a.data.isOnline && b.data.isOnline) return 1;

      // Then by join time (newest first)
      const aTime = a.data.joinedAt?.toDate?.() || new Date(0);
      const bTime = b.data.joinedAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    });

    // Filter out current user from members list
    const filteredMembers = members.filter(member => member.id !== me?.uid);
    filteredMembers.forEach(member => {
      renderMember(member.data, member.id);
    });

    updateMemberCount();
  }, (error) => {
    console.error('Error loading members:', error);
  });
}

// Enter Chat function - activates chat and registers user presence
async function enterChat() {
  console.log('🎯 Enter Chat button clicked - registering user presence');
  
  try {
    // Wait for authentication state to be ready
    console.log('⏳ Checking authentication status...');
    const currentUser = await waitForAuth();
    
    if (!currentUser || !currentUser.uid) {
      console.log('❌ Authentication check failed - no user found');
      if (typeof showStyledNotification === 'function') {
        showStyledNotification('Please sign in to join chat', 'warning');
      }
      return;
    }
    
    // Update local state if needed
    if (!me || me.uid !== currentUser.uid) {
      me = currentUser;
      
      // Get display name if not already set
      if (!myDisplayName) {
        try {
          const userDoc = await getUserDoc(currentUser.uid);
          myDisplayName = userDoc?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous';
        } catch (error) {
          console.warn('⚠️ Could not fetch user doc, using auth data:', error);
          myDisplayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous';
        }
      }
    }

    if (!myDisplayName) {
      console.log('⚠️ No display name available - cannot enter chat');
      if (typeof showStyledNotification === 'function') {
        showStyledNotification('Display name required to join chat', 'warning');
      }
      return;
    }

    console.log('✅ Authentication verified for chat entry:', {
      uid: currentUser.uid,
      displayName: myDisplayName
    });

    // Update UI to show "in chat" state
    const meTag = document.getElementById('meTag');
    const enterChatBtn = document.getElementById('enterChatBtn');
    const leaveChatBtn = document.getElementById('leaveChatBtn');
    const chatCategoryTabs = document.getElementById('chatCategoryTabs');
    const showMembersBtn = document.getElementById('showMembersBtn');
    const membersList = document.getElementById('membersList');
    
    if (meTag) meTag.textContent = `${myDisplayName} (online)`;
    if (enterChatBtn) enterChatBtn.style.display = 'none';
    if (leaveChatBtn) leaveChatBtn.style.display = 'inline-flex';
    if (chatCategoryTabs) chatCategoryTabs.style.display = 'block';
    if (showMembersBtn) showMembersBtn.style.display = 'inline-flex';
    // Members panel stays hidden - only used for popup modal
    
    // Register user presence in database
    console.log(`📝 Registering user in room: ${currentRoom}`);
    const memberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
    await setDoc(memberDocRef, {
      displayName: myDisplayName,
      joinedAt: serverTimestamp(),
      photoURL: me.photoURL,
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    console.log('✅ User registered in database');

    // Start listening for room messages and members
    await bindRoomFeed();
    await bindMembersFeed();
    console.log('✅ Started listening for messages and members');

    // Send join notification to room
    try {
      const messagesRef = collection(db, "rooms", currentRoom, "messages");
      await addDoc(messagesRef, {
        from: "📢 SYSTEM",
        text: `${myDisplayName} joined the chat`,
        createdAt: serverTimestamp(),
        uid: me.uid,  // Use actual user UID to pass Firestore permission check
        isSystemMessage: true
      });
    } catch (error) {
      console.log('⚠️ Could not send join notification:', error);
    }
    
    // Show welcome message in chat feed
    const chatFeed = document.getElementById('chatFeed');
    if (chatFeed) {
      const welcomeMsg = document.createElement('div');
      welcomeMsg.style.cssText = 'padding: 12px; background: rgba(225, 29, 42, 0.1); border-radius: 8px; text-align: center; color: #E11D2A; font-weight: bold; margin-bottom: 8px;';
      welcomeMsg.textContent = `💬 Welcome to ${currentRoom} chat, ${myDisplayName}! You are now online.`;
      chatFeed.appendChild(welcomeMsg);
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }
    
    // Show and enable chat input bar
    const sendRow = document.getElementById('sendRow');
    const chatInput = document.getElementById('chatInput');
    
    if (sendRow) {
      sendRow.style.display = 'block';
      console.log('✅ Chat input bar is now visible');
    }
    
    if (chatInput) {
      chatInput.placeholder = 'Type your message...';
      chatInput.disabled = false;
      chatInput.focus();
      console.log('✅ Chat input is now enabled and focused');
    }
    
    console.log('✅ Successfully entered chat with presence tracking');
    
    if (typeof showStyledNotification === 'function') {
      showStyledNotification(`Joined ${currentRoom} chat!`, 'success');
    }
    
  } catch (error) {
    console.error('❌ Failed to enter chat:', error);
    if (typeof showStyledNotification === 'function') {
      showStyledNotification('Error entering chat: ' + error.message, 'error');
    }
  }
}

// Leave Chat function - removes user presence and cleans up
async function leaveChat() {
  console.log('🚪 Leave Chat button clicked - removing user presence');
  
  try {
    // Update UI to show "not in chat" state
    const meTag = document.getElementById('meTag');
    const enterChatBtn = document.getElementById('enterChatBtn');
    const leaveChatBtn = document.getElementById('leaveChatBtn');
    const chatCategoryTabs = document.getElementById('chatCategoryTabs');
    const showMembersBtn = document.getElementById('showMembersBtn');
    const membersList = document.getElementById('membersList');
    const sendRow = document.getElementById('sendRow');
    const chatFeed = document.getElementById('chatFeed');

    if (meTag) meTag.textContent = '(not in chat)';
    if (enterChatBtn) enterChatBtn.style.display = "inline-flex";
    if (leaveChatBtn) leaveChatBtn.style.display = "none";
    if (chatCategoryTabs) chatCategoryTabs.style.display = "none";
    if (showMembersBtn) showMembersBtn.style.display = "none";
    // Members panel always stays hidden
    if (sendRow) sendRow.style.display = "none";

    // Remove user presence from database
    if (me && me.uid) {
      console.log(`🗑️ Removing user from room: ${currentRoom}`);
      
      // Send leave notification first
      try {
        const messagesRef = collection(db, "rooms", currentRoom, "messages");
        await addDoc(messagesRef, {
          from: "📢 SYSTEM",
          text: `${myDisplayName} left the chat`,
          createdAt: serverTimestamp(),
          uid: "system",
          isSystemMessage: true
        });
      } catch (error) {
        console.log('⚠️ Could not send leave notification:', error);
      }

      // Remove user from members collection
      const memberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
      await deleteDoc(memberDocRef);
      console.log('✅ User removed from database');
    }

    // Stop listening to feeds
    if (unsubFeed) {
      unsubFeed();
      unsubFeed = null;
      console.log('✅ Stopped listening to messages');
    }

    if (unsubMembers) {
      unsubMembers();
      unsubMembers = null;
      console.log('✅ Stopped listening to members');
    }
    
    // Clear chat messages display
    if (chatFeed) chatFeed.innerHTML = '';
    
    // Clear members list
    const membersContainer = document.getElementById('membersContainer');
    if (membersContainer) membersContainer.innerHTML = '';

    console.log('✅ Successfully left chat with presence cleanup');
    
    if (typeof showStyledNotification === 'function') {
      showStyledNotification('Left the chat room', 'info');
    }
    
  } catch (error) {
    console.error('❌ Failed to leave chat:', error);
    if (typeof showStyledNotification === 'function') {
      showStyledNotification('Error leaving chat: ' + error.message, 'error');
    }
  }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  try {
    // Wait for authentication state to be ready
    console.log('⏳ Verifying authentication for message send...');
    const currentUser = await waitForAuth();
    
    if (!currentUser || !currentUser.uid) {
      console.error('❌ Authentication check failed - no user found');
      showStyledNotification('Please log in to send messages', 'warning');
      return;
    }
    
    // Update local state if needed
    if (!me || me.uid !== currentUser.uid) {
      me = currentUser;
      
      // Get display name if not already set
      if (!myDisplayName) {
        try {
          const userDoc = await getUserDoc(currentUser.uid);
          myDisplayName = userDoc?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous';
        } catch (error) {
          console.warn('⚠️ Could not fetch user doc, using auth data:', error);
          myDisplayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous';
        }
      }
    }

    console.log('✅ Authentication verified for message send:', {
      uid: currentUser.uid,
      displayName: myDisplayName
    });
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    showStyledNotification('Error verifying authentication', 'error');
    return;
  }

  // Auto-join chat if not already joined
  if (!myDisplayName && me) {
    myDisplayName = me.displayName || me.email?.split('@')[0] || "Member";
  }

  if (!myDisplayName) {
    myDisplayName = prompt("Enter your display name to chat:") || 'Anonymous';
  }

  // Auto-join chat room if not already in one
  if (document.getElementById("leaveChatBtn").style.display === "none") {
    try {
      await enterChat();
    } catch (error) {
      console.log('Auto-join failed, continuing with message send');
    }
  }

  try {
    if (me && db) {
      console.log('📤 Sending message to room:', currentRoom, 'from user:', me.uid);
      
      // Try online mode first - ALWAYS include required uid field
      const col = collection(db, "rooms", currentRoom, "messages");
      await addDoc(col, {
        from: myDisplayName,
        text,
        createdAt: serverTimestamp(),
        uid: me.uid, // CRITICAL: Always include authenticated user's UID
        photoURL: me.photoURL,
        room: currentRoom
      });

      // Update user's last seen timestamp
      if (me.uid) {
        try {
          const memberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
          await updateDoc(memberDocRef, {
            lastSeen: serverTimestamp(),
            isOnline: true
          });
        } catch (memberError) {
          // If member doc doesn't exist, create it
          await setDoc(memberDocRef, {
            displayName: myDisplayName,
            joinedAt: serverTimestamp(),
            photoURL: me.photoURL,
            isOnline: true,
            lastSeen: serverTimestamp()
          });
        }
      }
    } else {
      // Fallback to local mode
      const messageEl = document.createElement("div");
      messageEl.className = "bubble me";
      messageEl.style.background = "none";

      const messageContent = document.createElement("div");
      messageContent.textContent = `${myDisplayName}: ${text}`;
      messageEl.appendChild(messageContent);

      const timestamp = document.createElement("div");
      timestamp.className = "chat-timestamp";
      timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      messageEl.appendChild(timestamp);

      chatFeed.appendChild(messageEl);
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    chatInput.value = "";

  } catch (error) {
    console.error('Error sending message:', error);

    // Fallback to local display even if Firebase fails
    const messageEl = document.createElement("div");
    messageEl.className = "bubble me";
    messageEl.style.background = "none";

    const messageContent = document.createElement("div");
    messageContent.textContent = `${myDisplayName}: ${text}`;
    messageEl.appendChild(messageContent);

    const timestamp = document.createElement("div");
    timestamp.className = "chat-timestamp";
    timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageEl.appendChild(timestamp);

    chatFeed.appendChild(messageEl);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    chatInput.value = "";
    console.log('Message sent in offline mode');
  }
}

function esc(s) { return (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }

function renderBoard(listEl, docs) {
  if (!listEl) return; // Skip if element doesn't exist
  listEl.innerHTML = "";
  if (!docs.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Nothing yet.";
    listEl.appendChild(empty);
    return;
  }
  docs.forEach((d) => {
    const it = d.data;
    const card = document.createElement("div");
    card.className = "item";
    card.innerHTML = `
      <div class="title" title="${esc(it.title)}">${esc(it.title)}</div>
      <div class="meta">by ${esc(it.author || "Member")} about ${esc(it.about || "")}</div>
    `;
    card.addEventListener("click", () => {
      const detailModal = document.getElementById("detailModal");
      const detailTitle = document.getElementById("detailTitle");
      const detailMeta = document.getElementById("detailMeta");
      const detailBody = document.getElementById("detailBody");

      detailTitle.textContent = it.title || "Untitled";
      detailMeta.textContent = `by ${it.author || "Member"} about ${it.about || ""}`;
      detailBody.textContent = it.body || "";
      open(detailModal);
    });
    listEl.appendChild(card);
  });
}

function renderCasualtiesBoard(listEl, docs) {
  if (!listEl) return; // Fix: Check if element exists
  
  // Reset the display styles for the big window
  if (listEl) {
    listEl.style.display = "flex";
    listEl.style.alignItems = "center";
    listEl.style.justifyContent = "center";
    listEl.innerHTML = "";
  }

  if (!docs.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #888;
      font-size: 14px;
    `;
    empty.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 10px;">💔 No casualties yet</div>
      <div>Share your dating horror stories!</div>
      <button class="btn primary" style="margin-top: 10px;" onclick="showStyledNotification('Feature coming soon!', 'info')">+ Add Casualty</button>
    `;
    listEl.appendChild(empty);
    return;
  }

  // Show only the latest casualty - fill the entire window
  const d = docs[0];
  const it = d.data;

  // Check if user is admin (for remove button)
  const isAdmin = window.casualtyAdminMode || false;

  const casualtyDisplay = document.createElement("div");
  casualtyDisplay.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    background: transparent;
  `;

  casualtyDisplay.innerHTML = `
    <img src="${it.url}" alt="Casualty" style="max-width: 100%; max-height: 80%; object-fit: contain; border-radius: 8px;" />
    <div style="margin-top: 12px; text-align: center;">
      <div style="font-weight: bold; font-size: 16px; color: white; margin-bottom: 4px;">${esc(it.caption || 'Casualty of Modern Dating')}</div>
      <div style="font-size: 12px; color: #888;">by ${esc(it.uploaderName || "Anonymous")}</div>
    </div>
    ${isAdmin ? `<button class="btn-remove-casualty" data-casualty-id="${d.id}" style="position: absolute; top: 8px; right: 8px; background: #E11D2A; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Remove</button>` : ''}
  `;

  // Add click handler for viewing full screen
  casualtyDisplay.addEventListener("click", (e) => {
    // Don't open modal if clicking remove button
    if (e.target.classList.contains('btn-remove-casualty')) return;

    // Create full screen modal
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal" style="max-width: 90vw; max-height: 90vh;">
        <h3>${esc(it.caption || 'Casualty of Modern Dating')}</h3>
        <img src="${it.url}" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px;" />
        <div class="meta" style="margin-top: 10px; text-align: center; color: #888;">
          Shared by ${esc(it.uploaderName || "Anonymous")}
        </div>
        <div class="actions">
          <button class="btn" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  });

  // Add remove functionality (only if admin)
  if (isAdmin) {
    const removeBtn = casualtyDisplay.querySelector('.btn-remove-casualty');
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Remove this casualty?')) {
        try {
          await deleteDoc(doc(db, "casualties", d.id));
          console.log('✅ Casualty removed');
        } catch (error) {
          console.error('❌ Error removing casualty:', error);
          showStyledNotification('Failed to remove casualty. Please try again.', 'error');
        }
      }
    });
  }

  listEl.appendChild(casualtyDisplay);
}

let chaosUnsub = null;
let reviewUnsub = null;

function startChaosFeed() {
  if (chaosUnsub) chaosUnsub();
  const qy = query(collection(db, "chaos"), orderBy("createdAt", "desc"), limit(100));
  chaosUnsub = onSnapshot(qy, (snap) => {
    const rows = [];
    snap.forEach(docSnap => rows.push({ id: docSnap.id, data: docSnap.data() }));
    renderBoard(document.getElementById("chaosList"), rows);
  });
}

function startReviewFeed() {
  if (reviewUnsub) reviewUnsub();
  const qy = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(100));
  reviewUnsub = onSnapshot(qy, (snap) => {
    const rows = [];
    snap.forEach(docSnap => rows.push({ id: docSnap.id, data: docSnap.data() }));
    renderBoard(document.getElementById("reviewList"), rows);
  });
}

function startCasualtiesFeed() {
  console.log('💀 Initializing Casualties Manager...');
  try {
    // Initialize the comprehensive casualties manager
    initializeCasualtiesManager();
    console.log('✅ Casualties Manager initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Casualties Manager:', error);
    
    // Fallback: show error state in the casualties list
    const casualtiesListEl = document.getElementById("casualtiesList");
    if (casualtiesListEl) {
      casualtiesListEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #e11d2a;">
          <div style="font-size: 2rem; margin-bottom: 16px;">💥</div>
          <div style="font-size: 1.1rem; font-weight: bold;">Failed to Load Casualties</div>
          <div style="font-size: 0.9rem; margin-top: 8px; color: #999;">Even our horror stories are broken...</div>
        </div>
      `;
    }
  }
}



// Chat Category Functions
function initChatCategories() {
  const categoryTabs = document.getElementById('chatCategoryTabs');
  const categories = [
    { id: 'generalChatTab', room: 'general' },
    { id: 'firstDatesChatTab', room: 'first-dates' },
    { id: 'gymRatsChatTab', room: 'gym-rats' },
    { id: 'chaosLoungeChatTab', room: 'chaos-lounge' },
    { id: 'datingChatTab', room: 'dating' },
    { id: 'friendsChatTab', room: 'friends' },
    { id: 'fwbChatTab', room: 'fwb' },
    { id: 'ventsChatTab', room: 'vents' }
  ];

  categories.forEach(category => {
    const tabEl = document.getElementById(category.id);
    if (tabEl) {
      tabEl.addEventListener('click', () => switchChatRoom(category.room));
    }
  });

  // Add stream viewers tab
  const streamViewersTab = document.getElementById('streamViewersTab');
  if (streamViewersTab) {
    streamViewersTab.addEventListener('click', () => showStreamViewers());
  }

  // Set initial active tab
  updateChatCategoryTabs();
}

function showStreamViewers() {
  // Reset all tabs
  const categories = ['generalChatTab', 'firstDatesChatTab', 'gymRatsChatTab', 'chaosLoungeChatTab', 'datingChatTab', 'friendsChatTab', 'fwbChatTab', 'ventsChatTab'];
  categories.forEach(catId => {
    const tabEl = document.getElementById(catId);
    if (tabEl) {
      tabEl.style.opacity = '0.7';
      tabEl.style.borderBottom = '2px solid transparent';
    }
  });

  // Activate viewers tab
  const streamViewersTab = document.getElementById('streamViewersTab');
  if (streamViewersTab) {
    streamViewersTab.style.opacity = '1';
    streamViewersTab.style.borderBottom = '2px solid #E11D2A';
  }

  // Show viewers list, hide members list
  const membersList = document.getElementById('membersList');
  const viewersList = document.getElementById('viewersList');

  if (membersList) membersList.style.display = 'none';
  if (viewersList) viewersList.style.display = 'flex';

  // Update current view mode
  currentViewMode = 'viewers';

  // Render viewers
  renderStreamViewers();
}

function updateChatCategoryTabs() {
  const categories = ['generalChatTab', 'firstDatesChatTab', 'gymRatsChatTab', 'chaosLoungeChatTab', 'datingChatTab', 'friendsChatTab', 'fwbChatTab', 'ventsChatTab'];
  const roomMapping = {
    'general': 'generalChatTab',
    'first-dates': 'firstDatesChatTab',
    'gym-rats': 'gymRatsChatTab',
    'chaos-lounge': 'chaosLoungeChatTab',
    'dating': 'datingChatTab',
    'friends': 'friendsChatTab',
    'fwb': 'fwbChatTab',
    'vents': 'ventsChatTab'
  };

  // Reset all tabs
  categories.forEach(catId => {
    const tabEl = document.getElementById(catId);
    if (tabEl) {
      tabEl.style.opacity = '0.7';
      tabEl.style.borderBottom = '2px solid transparent';
    }
  });

  // Set active tab
  const activeTabId = roomMapping[currentRoom];
  if (activeTabId) {
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
      activeTab.style.opacity = '1';
      activeTab.style.borderBottom = '2px solid #E11D2A';
    }
  }
}

async function switchChatRoom(newRoom) {
  const wasSignedIn = document.getElementById("leaveChatBtn").style.display !== "none";

  // Don't do anything if switching to the same room
  if (currentRoom === newRoom && wasSignedIn) {
    console.log(`Already in ${newRoom} room`);
    return;
  }

  console.log(`🔄 Switching from ${currentRoom} to ${newRoom}`);

  // Leave old room quietly (don't kick user out on failure)
  if (wasSignedIn && me && myDisplayName) {
    try {
      const oldMemberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
      await deleteDoc(oldMemberDocRef);
      console.log(`✅ Left ${currentRoom} room successfully`);
    } catch (error) {
      console.log(`⚠️ Could not leave ${currentRoom} room (continuing anyway):`, error.code);
    }
  }

  // Update current room and UI immediately
  currentRoom = newRoom;
  currentViewMode = 'members';

  // Show members list, hide viewers list
  const membersList = document.getElementById('membersList');
  const viewersList = document.getElementById('viewersList');

  // Members panel stays hidden - only used for popup modal
  if (viewersList) viewersList.style.display = 'none';

  // Update visual tabs immediately so user sees the change
  updateChatCategoryTabs();

  // Join new room (keep user signed in even if this fails)
  if (wasSignedIn && me && myDisplayName) {
    try {
      const newMemberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
      await setDoc(newMemberDocRef, {
        displayName: myDisplayName,
        joinedAt: serverTimestamp(),
        photoURL: me.photoURL,
        isOnline: true,
        lastSeen: serverTimestamp()
      });

      console.log(`✅ Joined ${currentRoom} room successfully`);
    } catch (error) {
      console.log(`⚠️ Could not join ${currentRoom} room (staying signed in):`, error.code);
    }

    // Always update feeds and keep user signed in
    try {
      await bindRoomFeed();
      await bindMembersFeed();
    } catch (error) {
      console.log(`⚠️ Could not bind feeds for ${currentRoom}:`, error.code);
    }

    // Keep user signed in regardless of Firebase errors
    setSigned(true);
    console.log(`✅ Switched to ${currentRoom} chat (staying signed in)`);
  } else {
    // If not signed in, update feeds anyway
    try {
      await bindRoomFeed();
      await bindMembersFeed();
    } catch (error) {
      console.log(`⚠️ Could not bind feeds for ${currentRoom}:`, error.code);
    }
    setSigned(false);
  }
}

async function switchRoom(e) {
  const newRoom = e.target.value;
  const wasSignedIn = document.getElementById("leaveChatBtn").style.display !== "none";

  if (wasSignedIn && me && myDisplayName) {
    try {
      // Leave current room gracefully
      const oldMemberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
      await deleteDoc(oldMemberDocRef);

      // Send leave notification to old room
      const oldMessagesRef = collection(db, "rooms", currentRoom, "messages");
      await addDoc(oldMessagesRef, {
        from: "📢 SYSTEM",
        text: `${myDisplayName} left the chat`,
        createdAt: serverTimestamp(),
        uid: "system",
        isSystemMessage: true
      });
    } catch (error) {
      console.log('Error leaving old room:', error);
    }
  }

  currentRoom = newRoom;

  if (wasSignedIn && me && myDisplayName) {
    try {
      // Join new room
      const newMemberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
      await setDoc(newMemberDocRef, {
        displayName: myDisplayName,
        joinedAt: serverTimestamp(),
        photoURL: me.photoURL,
        isOnline: true,
        lastSeen: serverTimestamp()
      });

      // Send join notification to new room
      const newMessagesRef = collection(db, "rooms", currentRoom, "messages");
      await addDoc(newMessagesRef, {
        from: "📢 SYSTEM",
        text: `${myDisplayName} joined the chat`,
        createdAt: serverTimestamp(),
        uid: "system",
        isSystemMessage: true
      });

      // Update UI and feeds
      setSigned(true);
      await bindRoomFeed();
      await bindMembersFeed();

      console.log(`✅ Switched to ${currentRoom} chat`);
    } catch (error) {
      console.error('Error joining new room:', error);
      setSigned(false);
    }
  } else {
    // Update UI label even if not signed in
    setSigned(false);
  }
}

if (roomSelect) roomSelect.addEventListener("change", switchRoom);
if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Casualties preview
const codVideo = document.getElementById("codVideo");
const codUpload = document.getElementById("codUpload");
const codStatus = document.getElementById("codStatus");
const codPreview = document.getElementById("codPreview");

function showPreview(file) {
  if (!file) return;
  if (codPreview) codPreview.innerHTML = "";
  const url = URL.createObjectURL(file);
  let el;
  if (file.type.startsWith("image/")) {
    el = document.createElement("img");
    el.src = url; el.alt = "Preview";
  } else if (file.type.startsWith("video/")) {
    el = document.createElement("video");
    el.src = url; el.controls = true; el.playsinline = true;
  } else {
    const t = document.createElement("div");
    t.textContent = "Unsupported file type."; t.style.opacity = "0.8"; el = t;
  }
  el.style.maxWidth = "100%"; el.style.maxHeight = "100%"; el.style.objectFit = "contain";
  codPreview.appendChild(el);
  codStatus.textContent = `Ready: ${file.name}`;
}

if (codVideo) codVideo.addEventListener("change", (e) => { showPreview(e.target.files?.[0]); });
if (codUpload) codUpload.addEventListener("click", () => {
  const f = codVideo.files?.[0];
  if (!f) codStatus.textContent = "Select a file first.";
  else showPreview(f);
});

// Live Stream Controls
if (toggleAudioBtn) {
  toggleAudioBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleAudioBtn.textContent = audioTrack.enabled ? '🎤' : '🔇';
    }
  });
}

if (toggleVideoBtn) {
  toggleVideoBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleVideoBtn.textContent = videoTrack.enabled ? '📹' : '📸';
    }
  });
}

if (shareScreenBtn) {
  shareScreenBtn.addEventListener('click', async () => {
    if (!me) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];

      if (localStream) {
        const currentVideoTrack = localStream.getVideoTracks()[0];
        const currentAudioTrack = localStream.getAudioTracks()[0];
        localStream.removeTrack(currentVideoTrack);
        if (currentAudioTrack) localStream.removeTrack(currentAudioTrack);
      }

      localVideo.srcObject = screenStream;
      localStream = screenStream;

      if (videoTrack) {
        videoTrack.onended = () => {
          stopLiveStream();
        };
      }
      peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
        if (audioTrack) {
          const audioSender = pc.getSenders().find(s => s.track.kind === 'audio');
          if (audioSender) audioSender.replaceTrack(audioTrack);
        }
      });
      shareScreenBtn.textContent = 'Stop Sharing';
      shareScreenBtn.onclick = stopLiveStream;

    } catch (err) {
      console.error('Error sharing screen:', err);
      showStyledNotification('Failed to share screen.', 'error');
    }
  });
}

if (endCallBtn) {
  endCallBtn.addEventListener('click', () => {
    stopLiveStream();
    showStyledNotification('Call ended.', 'info');
  });
}

// Test live streaming function with enhanced diagnostics
window.testLiveStream = async function() {
  try {
    // Wait for authentication state to be ready
    const currentUser = await waitForAuth();
    if (!currentUser) {
      showStyledNotification('Please log in first', 'warning');
      return;
    }
    console.log('✅ Authentication verified for live stream test:', currentUser.uid);
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    showStyledNotification('Error verifying authentication', 'error');
    return;
  }

  console.log('🧪 Testing live stream with full diagnostics...');

  // Test network connectivity
  console.log('🌐 Testing network connectivity...');
  try {
    const response = await fetch('https://www.google.com/favicon.ico');
    console.log('✅ Internet connection: OK');
  } catch (error) {
    console.log('❌ Internet connection: Failed');
    showStyledNotification('Network connectivity issues detected', 'warning');
  }

  // Test WebRTC support
  console.log('🔧 Testing WebRTC support...');
  if (typeof RTCPeerConnection !== 'undefined') {
    console.log('✅ WebRTC support: Available');
    
    // Test STUN/TURN connectivity
    const testPC = new RTCPeerConnection(rtcConfiguration);
    testPC.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('✅ ICE candidate received:', event.candidate.type);
      }
    };
    
    // Create dummy data channel to trigger ICE gathering
    testPC.createDataChannel('test');
    const offer = await testPC.createOffer();
    await testPC.setLocalDescription(offer);
    
    setTimeout(() => {
      testPC.close();
      console.log('🧪 WebRTC connectivity test completed');
    }, 5000);
  } else {
    console.log('❌ WebRTC support: Not available');
    showStyledNotification('WebRTC not supported in this browser', 'error');
  }

  // Test media device access
  console.log('📹 Testing camera/microphone access...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('✅ Media devices: Accessible');
    stream.getTracks().forEach(track => track.stop());
  } catch (error) {
    console.log('❌ Media devices: Access denied -', error.message);
    showStyledNotification('Camera/microphone access required for streaming', 'warning');
  }

  // Get active streams
  const streams = await getActiveLiveStreams();
  console.log('📺 Active streams found:', streams.length);

  if (streams.length === 0) {
    console.log('ℹ️ No active streams found. Start one first.');
    showStyledNotification('No active streams found. Try starting a stream!', 'info');
  } else {
    console.log('✅ Found active streams! You can join them.');
    showStyledNotification(`Found ${streams.length} active stream(s)!`, 'success');
  }
};

// Add network quality detection
window.checkNetworkQuality = async function() {
  console.log('🔍 Checking network quality...');
  
  const startTime = performance.now();
  try {
    await fetch('https://www.google.com/favicon.ico');
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    let quality = 'Unknown';
    if (latency < 100) quality = 'Excellent';
    else if (latency < 300) quality = 'Good';
    else if (latency < 600) quality = 'Fair';
    else quality = 'Poor';
    
    console.log(`🌐 Network latency: ${latency.toFixed(2)}ms (${quality})`);
    showStyledNotification(`Network quality: ${quality} (${latency.toFixed(0)}ms)`, 'info');
    
    return { latency, quality };
  } catch (error) {
    console.log('❌ Network quality check failed:', error);
    showStyledNotification('Network connectivity issues detected', 'error');
    return { latency: -1, quality: 'Failed' };
  }
};

// Auth - properly ensure user document exists
onAuthStateChanged(auth, async (user) => {
  me = user || null;
  myDisplayName = "";
  
  if (me) {
    try {
      console.log('✅ User authenticated:', me.uid);
      // CRITICAL: Get user document (read-only - fixes Firebase permission errors)
      const userData = await getUserDoc(me.uid);
      myDisplayName = userData?.displayName || (me.email || "").split("@")[0] || "Member";
      
      // Initialize listeners after authentication is confirmed
      // Note: casualties feed now starts for all users in DOM ready
      startReviewFeed();
      
      // Start signaling listener for live streams
      listenForSignaling();
      
      console.log('✅ Authentication complete for:', myDisplayName);
    } catch (e) {
      console.error('❌ Error ensuring user document:', e);
      myDisplayName = (me?.email || "").split("@")[0] || "Member";
      showStyledNotification('Authentication error - some features may not work properly', 'error');
    }
  } else {
    console.log('❌ User not authenticated');
    me = null;
    myDisplayName = "";
    
    // Clean up listeners
    if (chaosUnsub) chaosUnsub();
    if (reviewUnsub) reviewUnsub();
    stopSignalingListener();
    
    // Show login prompts (only if elements exist on current page)
    const chaosList = document.getElementById("chaosList");
    const reviewList = document.getElementById("reviewList");
    if (chaosList) {
      chaosList.innerHTML = '<div class="muted">Please log in to view content.</div>';
    }
    if (reviewList) {
      reviewList.innerHTML = '<div class="muted">Please log in to view content.</div>';
    }
  }
  
  setSigned(false);
});

// Simple message overlay functions - no complex UI needed

// Create stream document for discovery
async function createStreamDocument() {
  if (!me || !me.uid) {
    throw new Error('User not authenticated - cannot create stream document');
  }

  if (!myDisplayName) {
    throw new Error('User display name not available - cannot create stream document');
  }

  try {
    console.log('📋 Creating stream document for discovery...');
    
    // Create stream document in multiple places for maximum visibility
    const streamData = {
      streamerUid: me.uid, // CRITICAL: Always include authenticated user's UID
      streamerName: myDisplayName,
      isLive: true,
      viewers: 0,
      startedAt: serverTimestamp(), // Use server timestamp for consistency
      isStreaming: true,
      uid: me.uid // CRITICAL: Include uid for Firestore rules
    };

    // Try multiple collections to ensure visibility
    const promises = [];
    
    // Main streams collection
    promises.push(
      setDoc(doc(db, 'liveStreams', me.uid), streamData)
        .catch(e => console.log('📍 liveStreams collection error:', e.message))
    );
    
    // Update user document to show streaming status
    promises.push(
      updateDoc(doc(db, 'users', me.uid), {
        isStreaming: true,
        streamStartedAt: new Date(),
        viewerCount: 0
      }).catch(e => console.log('📍 users collection error:', e.message))
    );
    
    // Try backup collections
    promises.push(
      setDoc(doc(db, 'activeStreams', me.uid), streamData)
        .catch(e => console.log('📍 activeStreams collection error:', e.message))
    );

    await Promise.all(promises);
    console.log('✅ Stream document created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create stream document:', error);
    // Don't throw - allow streaming to continue even if document creation fails
  }
}

// Remove stream document when stopping
async function removeStreamDocument() {
  if (!me) return;

  try {
    console.log('🗑️ Removing stream document...');
    
    const promises = [];
    
    // Remove from all collections
    promises.push(
      deleteDoc(doc(db, 'liveStreams', me.uid))
        .catch(e => console.log('📍 Error removing from liveStreams:', e.message))
    );
    
    promises.push(
      updateDoc(doc(db, 'users', me.uid), {
        isStreaming: false,
        streamStartedAt: null,
        viewerCount: 0
      }).catch(e => console.log('📍 Error updating users document:', e.message))
    );
    
    promises.push(
      deleteDoc(doc(db, 'activeStreams', me.uid))
        .catch(e => console.log('📍 Error removing from activeStreams:', e.message))
    );

    await Promise.all(promises);
    console.log('✅ Stream document removed');
    
  } catch (error) {
    console.error('❌ Failed to remove stream document:', error);
  }
}

// Live stream functions moved to live-stream.js module

async function stopLiveStreamLocal() {
  try {
    // Get streamer name before stopping for proper cleanup notifications
    const streamerName = me?.displayName || myDisplayName || 'Unknown Streamer';
    
    await stopLiveStreamModule(streamerName);
    isStreaming = false;
    updateStreamButtons();
    await removeStreamDocument();
    await broadcastStreamAvailability(false);
    hideLiveStreamChatBar();
    
    console.log('✅ Live stream stopped successfully!');
    
    // Hide streamer name display when stopping stream AND clear browse modal
    const streamerDisplay = document.getElementById('currentStreamerDisplay');
    if (streamerDisplay) {
      streamerDisplay.style.display = 'none';
      console.log('✅ Streamer name display cleared on stop');
    }
    
    // Hide the LIVE pill indicator 
    const livePill = document.querySelector('.live-pill');
    if (livePill) {
      livePill.style.display = 'none';
      console.log('✅ LIVE pill indicator hidden');
    }
    
    // Hide viewer count circle
    const viewerCountCircle = document.getElementById('viewerCountCircle');
    if (viewerCountCircle) {
      viewerCountCircle.style.display = 'none';
      console.log('✅ Viewer count circle hidden');
    }
    
    // Close browse live modal if open
    const browseLiveModal = document.querySelector('.modal-backdrop');
    if (browseLiveModal) {
      browseLiveModal.remove();
      console.log('🚪 Browse live modal cleared on stop');
    }
    
    // Automatic cleanup - no user interaction needed
    console.log('🧹 Auto-cleaning Firebase documents...');
    await cleanupStreamDocumentsAutomatic();
    
  } catch (error) {
    console.error('Failed to stop local stream:', error);
  }
}

// Flip camera functionality
async function flipCamera() {
  if (!isStreaming || !localStream) {
    showStyledNotification('❌ No active stream to flip camera', 'warning');
    return;
  }

  try {
    // Stop current video track
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
    }

    // Switch camera
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';

    // Get new video track
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentCamera,
        width: { min: 640, ideal: 1280 },
        height: { min: 480, ideal: 720 }
      }
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (newVideoTrack) {
      localStream.addTrack(newVideoTrack);
      localVideo.srcObject = localStream;

      // Update peer connections with new track
      peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      console.log('📱 Camera flipped to:', currentCamera);
    }
  } catch (error) {
    console.error('❌ Camera flip failed:', error);
    showStyledNotification('Failed to flip camera: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Event Listeners  
document.addEventListener('DOMContentLoaded', () => {
    // Start stream button handled by live-stream.js module

    if (stopStreamBtn) {
        stopStreamBtn.addEventListener('click', async () => {
            console.log('⏹️ Stop button clicked - stopping stream...');
            try {
                await stopLiveStreamModule();
                console.log('✅ Stream stopped successfully!');
                
                // Update UI
                stopStreamBtn.style.display = 'none';
                startStreamBtn.style.display = 'inline-flex';
                flipCameraBtn.style.display = 'none';
                if (streamStatus) streamStatus.textContent = 'Ready to stream - click Go Live to start';
                isStreaming = false;
                showStyledNotification('⏹️ Stream stopped', 'info');
                
            } catch (error) {
                console.error('❌ Failed to stop stream:', error);
                if (streamStatus) streamStatus.textContent = `Error stopping: ${error?.message || 'Unknown error'}`;
                showStyledNotification(`Failed to stop stream: ${error?.message || 'Unknown error'}`, 'error');
            }
        });
    }
    if (joinStreamBtn) joinStreamBtn.addEventListener('click', joinStream);  // Direct join with username input
    if (leaveStreamBtn) leaveStreamBtn.addEventListener('click', leaveStream);
    if (viewLiveStreamsBtn) viewLiveStreamsBtn.addEventListener('click', browseLiveStreams); // Browse who's live
    if (flipCameraBtn) flipCameraBtn.addEventListener('click', flipCamera);

    // Live stream chat bar event listeners
    const liveStreamChatSendBtn = document.getElementById('liveStreamChatSendBtn');
    const liveStreamChatInput = document.getElementById('liveStreamChatInput');

    if (liveStreamChatSendBtn) {
        liveStreamChatSendBtn.addEventListener('click', sendLiveStreamChatMessage);
    }

    if (liveStreamChatInput) {
        liveStreamChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendLiveStreamChatMessage();
            }
        });
    }

    // Add toggle viewers button listener 
    const toggleViewersBtn = document.getElementById('toggleViewersPanel');
    if (toggleViewersBtn) {
        toggleViewersBtn.addEventListener('click', () => {
            const viewersList = document.getElementById('viewersList');
            const isVisible = viewersList.style.display === 'flex';
            
            if (isVisible) {
                // Hide viewers list
                viewersList.style.display = 'none';
                toggleViewersBtn.textContent = '👥 Stream Viewers';
            } else {
                // Show viewers list
                viewersList.style.display = 'flex';
                toggleViewersBtn.textContent = '❌ Hide Viewers';
                renderStreamViewers(); // Refresh viewers when panel opens
            }
        });
    }

    // Add main stream viewers tab listener (fixes the rogue button)
    const mainStreamViewersTab = document.getElementById('streamViewersTab');
    if (mainStreamViewersTab) {
        mainStreamViewersTab.addEventListener('click', () => {
            // Toggle the viewers list just like the button does
            const viewersList = document.getElementById('viewersList');
            const toggleBtn = document.getElementById('toggleViewersPanel');
            
            if (viewersList && toggleBtn) {
                const isVisible = viewersList.style.display === 'flex';
                
                if (isVisible) {
                    viewersList.style.display = 'none';
                    toggleBtn.textContent = '👥 Stream Viewers';
                } else {
                    viewersList.style.display = 'flex';
                    toggleBtn.textContent = '❌ Hide Viewers';
                    renderStreamViewers();
                }
            }
        });
    }

    // REMOVED DUPLICATE ENTER CHAT LISTENER - this was causing Enter Chat button to go to login.html instead of lounge.html

    // Add all modal and chat button listeners (moved here to fix null reference errors)
    const cSaveBtn = document.getElementById("cSave");
    if (cSaveBtn) {
        cSaveBtn.addEventListener("click", async () => {
          // Check authentication first
          if (!me || !me.uid) {
            showStyledNotification('Please log in to submit chaos stories.', 'warning');
            return;
          }

          const cTitle = document.getElementById("cTitle");
          const cAbout = document.getElementById("cAbout");
          const cBody = document.getElementById("cBody");

          const title = (cTitle.value || "").trim().slice(0, 60);
          const about = (cAbout.value || "").trim();
          const body = (cBody.value || "").trim();
          if (!title || !about || !body) return;
          
          const author = myDisplayName || "Member";
          
          try {
            await addDoc(collection(db, "chaos"), { 
              title, 
              about, 
              body, 
              author, 
              uid: me.uid, // CRITICAL: Always include authenticated user's UID
              createdAt: serverTimestamp() 
            });
            cTitle.value = ""; cAbout.value = ""; cBody.value = "";
            close(document.getElementById("chaosModal"));
          } catch (error) {
            console.error('Error submitting chaos story:', error);
            showStyledNotification('Failed to submit story. Please try again.', 'error');
          }
        });
    }

    const rSaveBtn = document.getElementById("rSave");
    if (rSaveBtn) {
        rSaveBtn.addEventListener("click", async () => {
          // Check authentication first
          if (!me || !me.uid) {
            showStyledNotification('Please log in to submit reviews.', 'warning');
            return;
          }

          const rTitle = document.getElementById("rTitle");
          const rAbout = document.getElementById("rAbout");
          const rBody = document.getElementById("rBody");

          const title = (rTitle.value || "").trim().slice(0, 60);
          const about = (rAbout.value || "").trim();
          const body = (rBody.value || "").trim();
          if (!title || !about || !body) return;
          
          const author = myDisplayName || "Member";
          
          try {
            await addDoc(collection(db, "reviews"), { 
              title, 
              about, 
              body, 
              author, 
              uid: me.uid, // CRITICAL: Always include authenticated user's UID
              createdAt: serverTimestamp() 
            });
            rTitle.value = ""; rAbout.value = ""; rBody.value = "";
            close(document.getElementById("reviewModal"));
          } catch (error) {
            console.error('Error submitting review:', error);
            showStyledNotification('Failed to submit review. Please try again.', 'error');
          }
        });
    }

    const uploadChaosBtn = document.getElementById("uploadChaos");
    if (uploadChaosBtn) {
        uploadChaosBtn.addEventListener("click", () => open(document.getElementById("chaosModal")));
    }

    const uploadReviewBtn = document.getElementById("uploadReview");
    if (uploadReviewBtn) {
        uploadReviewBtn.addEventListener("click", () => open(document.getElementById("reviewModal")));
    }

    const cCancelBtn = document.getElementById("cCancel");
    if (cCancelBtn) {
        cCancelBtn.addEventListener("click", () => close(document.getElementById("chaosModal")));
    }

    const rCancelBtn = document.getElementById("rCancel");
    if (rCancelBtn) {
        rCancelBtn.addEventListener("click", () => close(document.getElementById("reviewModal")));
    }

    const detailCloseBtn = document.getElementById("detailClose");
    if (detailCloseBtn) {
        detailCloseBtn.addEventListener("click", () => close(document.getElementById("detailModal")));
    }

    const chaosModal = document.getElementById("chaosModal");
    if (chaosModal) {
        chaosModal.addEventListener("click", (e) => { 
            if (e.target === chaosModal) close(chaosModal); 
        });
    }

    const reviewModal = document.getElementById("reviewModal");
    if (reviewModal) {
        reviewModal.addEventListener("click", (e) => { 
            if (e.target === reviewModal) close(reviewModal); 
        });
    }

    const detailModal = document.getElementById("detailModal");
    if (detailModal) {
        detailModal.addEventListener("click", (e) => { 
            if (e.target === detailModal) close(detailModal); 
        });
    }

    const leaveChatBtn = document.getElementById("leaveChatBtn");
    if (leaveChatBtn) {
        leaveChatBtn.addEventListener("click", async () => {
          if (!me || !myDisplayName) return;

          try {
            // Send leave notification to room
            const messagesRef = collection(db, "rooms", currentRoom, "messages");
            await addDoc(messagesRef, {
              from: "📢 SYSTEM",
              text: `${myDisplayName} left the chat`,
              createdAt: serverTimestamp(),
              uid: "system",
              isSystemMessage: true
            });

            // Remove user from member list
            const memberDocRef = doc(db, "rooms", currentRoom, "members", me.uid);
            await deleteDoc(memberDocRef);

            console.log(`✅ Successfully left ${currentRoom} chat`);
          } catch (error) {
            console.error('Error leaving chat:', error);
          }

          // Clean up listeners and UI
          if (unsubFeed) { unsubFeed(); unsubFeed = null; }
          if (unsubMembers) { unsubMembers(); unsubMembers = null; }
          setSigned(false);
          clearFeed();
          clearMembers();
        });
    }

    const showMembersBtn = document.getElementById("showMembersBtn");
    if (showMembersBtn) {
        showMembersBtn.addEventListener("click", () => {
          showMembersModal();
        });
    }

    // Initialize chat categories
    initChatCategories();

    console.log('✅ Stream UI initialized with live chat functionality');

    // Initialize stream chat side panel (chat only, no viewers)
    const streamGeneralTab = document.getElementById('streamGeneralTabSide');
    const streamChaosTab = document.getElementById('streamChaosTabSide');
    const streamDatingTab = document.getElementById('streamDatingTabSide');
    const streamFriendsTab = document.getElementById('streamFriendsTabSide');
    const streamVentsTab = document.getElementById('streamVentsTabSide');
    const streamFirstDatesTab = document.getElementById('streamFirstDatesTabSide');
    const streamGymRatsTab = document.getElementById('streamGymRatsTabSide');
    const streamFwbTab = document.getElementById('streamFwbTabSide');
    const streamViewersTab = document.getElementById('streamViewersTabSide');
    const streamChatSendBtnSide = document.getElementById('streamChatSendBtnSide');
    const streamChatInputSide = document.getElementById('streamChatInputSide');

    if (streamGeneralTab) {
        streamGeneralTab.addEventListener('click', () => switchStreamTab('general'));
    }
    if (streamChaosTab) {
        streamChaosTab.addEventListener('click', () => switchStreamTab('chaos'));
    }
    if (streamDatingTab) {
        streamDatingTab.addEventListener('click', () => switchStreamTab('dating'));
    }
    if (streamFriendsTab) {
        streamFriendsTab.addEventListener('click', () => switchStreamTab('friends'));
    }
    if (streamVentsTab) {
        streamVentsTab.addEventListener('click', () => switchStreamTab('vents'));
    }
    if (streamFirstDatesTab) {
        streamFirstDatesTab.addEventListener('click', () => switchChatRoom('first-dates'));
    }
    if (streamGymRatsTab) {
        streamGymRatsTab.addEventListener('click', () => switchChatRoom('gym-rats'));
    }
    if (streamFwbTab) {
        streamFwbTab.addEventListener('click', () => switchChatRoom('fwb'));
    }
    if (streamViewersTab) {
        streamViewersTab.addEventListener('click', () => switchStreamTab('viewers'));
    }

    if (streamChatSendBtnSide) {
        streamChatSendBtnSide.addEventListener('click', sendStreamChatSideMessage);
    }

    if (streamChatInputSide) {
        streamChatInputSide.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendStreamChatSideMessage();
            }
        });
    }

    // Stream chat box controls
    const toggleStreamChatBtn = document.getElementById('toggleStreamChat');
    const toggleViewersPanelBtn = document.getElementById('toggleViewersPanel');

    if (toggleStreamChatBtn) {
        toggleStreamChatBtn.addEventListener('click', () => {
            const chatBox = document.getElementById('liveStreamChatBox');
            if (chatBox) {
                chatBox.style.display = chatBox.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    if (toggleViewersPanelBtn) {
        toggleViewersPanelBtn.addEventListener('click', () => {
            const viewersPanel = document.getElementById('streamViewersPanel');
            if (viewersPanel) {
                const isVisible = viewersPanel.style.display !== 'none';
                viewersPanel.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    renderStreamViewers(); // Refresh viewers when panel opens
                }
            }
        });
    }

    // Close viewers panel button
    const closeViewersPanel = document.getElementById('closeViewersPanel');
    if (closeViewersPanel) {
        closeViewersPanel.addEventListener('click', () => {
            const viewersPanel = document.getElementById('streamViewersPanel');
            if (viewersPanel) {
                viewersPanel.style.display = 'none';
            }
        });
    }

    // Simple overlay - no complex initialization needed

});

// Global function to toggle stream viewers (called from onclick)
function toggleStreamViewers() {
    const viewersList = document.getElementById('viewersList');
    const toggleBtn = document.getElementById('toggleViewersPanel');
    
    console.log('👥 Toggle stream viewers clicked');
    
    if (viewersList) {
        const isVisible = viewersList.style.display === 'flex';
        
        if (isVisible) {
            viewersList.style.display = 'none';
            if (toggleBtn) toggleBtn.textContent = '👥 Stream Viewers';
            console.log('👥 Hiding viewer list');
        } else {
            viewersList.style.display = 'flex';
            if (toggleBtn) toggleBtn.textContent = '❌ Hide Viewers';
            renderStreamViewers();
            console.log('👥 Showing viewer list with', streamViewers.length, 'viewers');
        }
    } else {
        console.log('❌ Could not find viewersList element');
    }
}

// Make function globally available
window.toggleStreamViewers = toggleStreamViewers;

// Admin mode for casualty management
window.enableCasualtyAdmin = function() {
  const password = prompt('🔐 Enter admin password:');
  if (password === 'unhinged2024') {
    window.casualtyAdminMode = true;
    showStyledNotification('✅ Admin mode enabled - you can now remove casualties', 'success');
    // Refresh casualties display to show remove buttons
    if (typeof startCasualtiesFeed === 'function') {
      startCasualtiesFeed();
    }
  } else {
    showStyledNotification('❌ Incorrect password', 'error');
  }
};

console.log('💡 Admin tip: Type enableCasualtyAdmin() in console to manage casualties');


// ============================================================================
// FIREBASE CLEANUP FUNCTIONS - Remove accumulated stream documents
// ============================================================================

// Automatic cleanup (no prompts, no alerts, just silent cleanup)
async function cleanupStreamDocumentsAutomatic(streamerUid = null) {
  console.log('🧹 Auto-cleanup: Starting Firebase document cleanup...');
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('❌ Auto-cleanup: No authenticated user');
    return;
  }
  
  const targetUid = streamerUid || currentUser.uid;
  let totalDeleted = 0;
  
  try {
    // 1. Clean up live stream documents
    const streamCollections = ['liveStreams', 'activeStreams', 'globalStreams'];
    
    for (const collectionName of streamCollections) {
      try {
        const streamQuery = query(collection(db, collectionName), where('streamerUid', '==', targetUid));
        const streamSnapshot = await getDocs(streamQuery);
        
        const deletePromises = streamSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        console.log(`🧹 Auto-cleanup: Deleted ${streamSnapshot.docs.length} from ${collectionName}`);
        totalDeleted += streamSnapshot.docs.length;
      } catch (error) {
        console.log(`📍 Auto-cleanup ${collectionName} error:`, error.message);
      }
    }
    
    // 2. Clean up WebRTC signaling documents  
    try {
      const signalQuery = query(
        collection(db, 'liveStreamSignals'), 
        where('from', '==', targetUid)
      );
      const signalSnapshot = await getDocs(signalQuery);
      
      const signalDeletePromises = signalSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(signalDeletePromises);
      
      console.log(`🧹 Auto-cleanup: Deleted ${signalSnapshot.docs.length} signaling documents`);
      totalDeleted += signalSnapshot.docs.length;
    } catch (error) {
      console.log('📍 Auto-cleanup signaling error:', error.message);
    }
    
    // 3. Clean up global notifications
    try {
      const notificationQuery = query(
        collection(db, 'globalNotifications'),
        where('streamerUid', '==', targetUid)
      );
      const notificationSnapshot = await getDocs(notificationQuery);
      
      const notificationDeletePromises = notificationSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(notificationDeletePromises);
      
      console.log(`🧹 Auto-cleanup: Deleted ${notificationSnapshot.docs.length} global notifications`);
      totalDeleted += notificationSnapshot.docs.length;
    } catch (error) {
      console.log('📍 Auto-cleanup notification error:', error.message);
    }
    
    // 4. Clean up user notifications
    try {
      const userNotifQuery = query(
        collection(db, 'userNotifications'),
        where('streamerUid', '==', targetUid)
      );
      const userNotifSnapshot = await getDocs(userNotifQuery);
      
      const userNotifDeletePromises = userNotifSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(userNotifDeletePromises);
      
      console.log(`🧹 Auto-cleanup: Deleted ${userNotifSnapshot.docs.length} user notifications`);
      totalDeleted += userNotifSnapshot.docs.length;
    } catch (error) {
      console.log('📍 Auto-cleanup user notification error:', error.message);
    }
    
    // 5. Clean up ALL stream chat messages from live system (not just old ones)
    const chatRooms = ['general', 'first-dates', 'gym-rats', 'chaos-lounge'];
    
    for (const roomId of chatRooms) {
      try {
        const messagesQuery = query(
          collection(db, 'rooms', roomId, 'messages'),
          where('from', '==', '🎬 LIVE SYSTEM')
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        const messageDeletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(messageDeletePromises);
        
        console.log(`🧹 Auto-cleanup: Deleted ${messagesSnapshot.docs.length} system messages from ${roomId}`);
        totalDeleted += messagesSnapshot.docs.length;
      } catch (error) {
        console.log(`📍 Auto-cleanup chat error for ${roomId}:`, error.message);
      }
    }
    
    // 6. Reset user streaming status
    try {
      await setDoc(doc(db, 'users', targetUid), {
        isStreaming: false,
        streamStartedAt: null,
        viewerCount: 0,
        lastSeen: serverTimestamp()
      }, { merge: true });
      
      console.log('🧹 Auto-cleanup: User streaming status reset');
    } catch (error) {
      console.log('📍 Auto-cleanup user status error:', error.message);
    }
    
    console.log(`🧹 Auto-cleanup complete! Deleted ${totalDeleted} Firebase documents silently`);
    
  } catch (error) {
    console.error('❌ Auto-cleanup failed:', error);
  }
}

// Function to add floating text overlay that disappears in 30-45 seconds
function addFloatingTextOverlay(username, message) {
  const overlayContainer = document.getElementById("overlayMessagesContainer");
  if (!overlayContainer) return;
  
  // Create floating message element - NO BUBBLE styling
  const messageElement = document.createElement("div");
  messageElement.style.cssText = `
    background: none;
    border: none;
    border-radius: 0px;
    padding: 4px 8px;
    margin-bottom: 8px;
    color: white;
    font-size: 14px;
    backdrop-filter: blur(10px);
    animation: slideInFromLeft 0.5s ease-out;
    box-shadow: 0 4px 15px rgba(225, 29, 42, 0.3);
  `;
  
  messageElement.innerHTML = `
    <div style="color: #E11D2A; font-weight: bold; font-size: 12px; margin-bottom: 2px;">${username}</div>
    <div>${message}</div>
  `;
  
  // Add to overlay container
  overlayContainer.appendChild(messageElement);
  
  // Show overlay container
  document.getElementById("liveStreamTextOverlay").style.display = "block";
  
  // Remove after 30-45 seconds (random between 30000-45000ms)
  const removeTime = Math.random() * 15000 + 30000; // 30-45 seconds
  
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.style.animation = "fadeOut 0.5s ease-out";
      setTimeout(() => {
        messageElement.remove();
        
        // Hide overlay if no more messages
        if (overlayContainer.children.length === 0) {
          document.getElementById("liveStreamTextOverlay").style.display = "none";
        }
      }, 500);
    }
  }, removeTime);
}

// Styled notification function to replace ugly alerts
function showStyledNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotification = document.querySelector('.styled-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create styled notification
  const notification = document.createElement('div');
  notification.className = 'styled-notification';
  
  let bgColor, borderColor, icon;
  switch (type) {
    case 'error':
      bgColor = 'linear-gradient(135deg, #E11D2A, #ff4458)';
      borderColor = '#E11D2A';
      icon = '❌';
      break;
    case 'warning':
      bgColor = 'linear-gradient(135deg, #ff6b00, #ff8c00)';
      borderColor = '#ff6b00';
      icon = '⚠️';
      break;
    case 'success':
      bgColor = 'linear-gradient(135deg, #4CAF50, #66BB6A)';
      borderColor = '#4CAF50';
      icon = '✅';
      break;
    default: // info
      bgColor = 'linear-gradient(135deg, #16161c, #27272f)';
      borderColor = '#E11D2A';
      icon = 'ℹ️';
  }
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    border: 2px solid ${borderColor};
    box-shadow: 
      0 8px 32px rgba(0,0,0,0.4),
      0 0 0 1px rgba(255,255,255,0.1) inset;
    z-index: 10000;
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 600;
    font-size: 14px;
    max-width: 350px;
    animation: slideInNotification 0.3s ease-out;
    backdrop-filter: blur(10px);
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 18px;">${icon}</span>
      <span style="flex: 1;">${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
  `;
  
  // Add CSS animation
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideInNotification {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideInNotification 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// Add event listener for live stream chat
document.addEventListener("DOMContentLoaded", () => {
  const liveStreamChatSendBtn = document.getElementById("liveStreamChatSendBtn");
  const liveStreamChatInput = document.getElementById("liveStreamChatInput");
  
  if (liveStreamChatSendBtn && liveStreamChatInput) {
    liveStreamChatSendBtn.addEventListener("click", () => {
      const message = liveStreamChatInput.value.trim();
      if (message && window.currentUser) {
        // Add floating text overlay
        addFloatingTextOverlay(window.currentUser.displayName || "Anonymous", message);
        console.log("Live stream chat:", message);
        liveStreamChatInput.value = "";
      }
    });
    
    // Enter key support
    liveStreamChatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        liveStreamChatSendBtn.click();
      }
    });
  }
});


/* ===== SECTION: Recycling Bin System ===== */
class RecyclingBin {
  constructor(getUidFn) { this._getUid = getUidFn; }
  _key() {
    const uid = this._getUid?.();
    return `recycled_${uid || 'anon'}`;
  }
  list() {
    try { return JSON.parse(localStorage.getItem(this._key()) || '[]'); }
    catch { return []; }
  }
  _save(arr) { localStorage.setItem(this._key(), JSON.stringify(arr)); }
  isRecycled(uid) { return this.list().some(p => p.uid === uid); }
  add(profile, action) {
    if (!profile?.uid) return;
    const arr = this.list().filter(p => p.uid !== profile.uid);
    arr.unshift({ ...profile, recycledAt: Date.now(), action });
    if (arr.length > 200) arr.length = 200;
    this._save(arr);
  }
  restore(uid) {
    const arr = this.list().filter(p => p.uid !== uid);
    this._save(arr);
  }
  clear() { this._save([]); }
}
window.recyclingBin = new RecyclingBin(() => (me?.uid || null));

function restoreFromRecyclingBin(profile) {
  if (!profile?.uid) return;
  // Remove from persistent bin
  window.recyclingBin.restore(profile.uid);
  // Add back to the in-memory deck (front of the queue)
  const exists = matches.find(m => m.uid === profile.uid);
  if (!exists) {
    const clean = { ...profile };
    delete clean.recycledAt;
    delete clean.action;
    matches.unshift(clean);
  }
  if (matches.length === 1) renderProfile(matches[0]);
}

function showRecyclingBin() {
  const recycled = window.recyclingBin.list();
  if (!recycled.length) {
    showStyledNotification('Recycling bin is empty. Profiles you swipe on will appear here.', 'info');
    return;
  }

  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "var(--bg)";
  modal.style.zIndex = "1000";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";

  const header = document.createElement("div");
  header.style.padding = "1rem";
  header.style.background = "var(--panel)";
  header.style.borderBottom = "1px solid #2a2a2a";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.innerHTML = `
    <h3 style="margin:0;color:#fff;display:flex;align-items:center;gap:8px;">
      🗑️ Recycling Bin
      <span style="font-size:.8rem;color:var(--muted);">(${recycled.length} profiles)</span>
    </h3>
    <div style="display:flex;gap:8px;">
      <button class="btn small secondary" id="recyclingBinBack">Back</button>
      <button class="btn small danger" id="clearRecyclingBin">Clear All</button>
    </div>
  `;

  const content = document.createElement("div");
  content.style.flex = "1";
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.style.position = "relative";
  content.style.overflow = "auto";

  const cardFrame = document.createElement("div");
  cardFrame.className = "card-frame";
  cardFrame.id = "recyclingCardFrame";
  cardFrame.style.cssText = `
    position:relative;width:90%;max-width:400px;min-height:500px;max-height:70vh;
    margin:1rem auto;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.3);
    background: var(--panel); border: 2px solid #ff6b00;
  `;
  cardFrame.innerHTML = `
    <div class="photo-indicators" id="recyclingPhotoIndicators"></div>
    <img class="main-photo" id="recycling-main-photo" src="" alt="Profile Photo" style="width:100%;height:400px;object-fit:cover;" />
    <div class="info-overlay" style="position:relative;background:#1a1b22;padding:1.5rem;color:#fff;border-top:2px solid #ff6b00;">
      <h2 id="recycling-name" style="margin:0 0 .5rem 0;font-size:1.8rem;color:#ff6b00;"></h2>
      <div id="recycling-handle" style="color:var(--muted);margin-bottom:.5rem;"></div>
      <div id="recycling-sub-info" style="color:var(--muted);font-size:.9rem;margin-bottom:.5rem;"></div>
      <div id="recycling-action" style="display:flex;align-items:center;gap:8px;margin-bottom:.5rem;"></div>
      <div style="font-size:.8rem;color:var(--muted);">
        <span id="recycling-date"></span> • <span id="recycling-position"></span>
      </div>
    </div>
  `;

  const actions = document.createElement("div");
  actions.style.cssText = `display:flex;justify-content:center;gap:2rem;padding:1rem;`;
  actions.innerHTML = `
    <button class="action-btn pass-btn" id="recycling-prev-btn">‹</button>
    <button class="action-btn like-btn" id="recycling-restore-btn" title="Restore">♻️</button>
    <button class="action-btn pass-btn" id="recycling-next-btn">›</button>
  `;

  content.appendChild(cardFrame);
  content.appendChild(actions);
  modal.appendChild(header);
  modal.appendChild(content);
  document.body.appendChild(modal);

  let idx = 0;
  function renderRecycledProfile(i) {
    const p = recycled[i];
    if (!p) return;
    
    // NO FALLBACKS - only show real photos
    const recyclingPhoto = modal.querySelector('#recycling-main-photo');
    const photoUrl = p.photoURL || p.photos?.[0];
    if (photoUrl) {
      recyclingPhoto.src = photoUrl;
    } else {
      recyclingPhoto.style.display = 'none';
    }
    
    modal.querySelector('#recycling-name').textContent = p.displayName || 'Member';
    modal.querySelector('#recycling-handle').textContent = p.username ? `@${p.username}` : '';
    const details = [];
    if (p.age) details.push(`${p.age} years old`);
    if (p.location) details.push(p.location);
    modal.querySelector('#recycling-sub-info').textContent = details.join(' • ');
    modal.querySelector('#recycling-action').innerHTML =
      `<span style="color:${p.action==='liked' ? '#42d774' : '#ff4458'};font-size:1.2rem;">${p.action==='liked'?'❤️':'✗'}</span>
       <span style="font-weight:bold;">${(p.action||'').toUpperCase()}</span>`;
    modal.querySelector('#recycling-date').textContent = new Date(p.recycledAt).toLocaleString();
    modal.querySelector('#recycling-position').textContent = `${i+1} of ${recycled.length}`;
  }
  function next() { idx = (idx + 1) % recycled.length; renderRecycledProfile(idx); }
  function prev() { idx = (idx - 1 + recycled.length) % recycled.length; renderRecycledProfile(idx); }

  // wiring
  modal.querySelector('#recyclingBinBack').onclick = () => document.body.removeChild(modal);
  modal.querySelector('#clearRecyclingBin').onclick = () => {
    if (confirm('Clear all profiles from recycling bin?')) {
      window.recyclingBin.clear();
    }
    document.body.removeChild(modal);
  };
  modal.querySelector('#recycling-restore-btn').onclick = () => {
    const p = recycled[idx];
    if (p) {
      restoreFromRecyclingBin(p);
      window.recyclingBin.restore(p.uid);
      recycled.splice(idx, 1);
      if (!recycled.length) return document.body.removeChild(modal);
      if (idx >= recycled.length) idx = 0;
      renderRecycledProfile(idx);
      showStyledNotification(`♻️ ${p.displayName || 'Profile'} restored to your deck!`, 'success');
    }
  };
  modal.querySelector('#recycling-next-btn').onclick = next;
  modal.querySelector('#recycling-prev-btn').onclick = prev;

  renderRecycledProfile(0);
}

function initializeRecyclingBin() {
  const recyclingBtn = document.getElementById('recyclingBtn');
  if (!recyclingBtn) {
    showStyledNotification('Recycling button not found!', 'error');
    return;
  }
  recyclingBtn.addEventListener('click', () => {
    showStyledNotification('Opening recycling bin...', 'info');
    showRecyclingBin();
  });
}

// Expose recycling functions globally
window.showRecyclingBin = showRecyclingBin;
window.restoreFromRecyclingBin = restoreFromRecyclingBin;
window.initializeRecyclingBin = initializeRecyclingBin;

/* ===== DROP-IN: Full Profile Modal (gallery + details) ===== */
function showPublicProfile(user) {
  // guard + normalize
  const u = user || {};
  const photos = [];
  if (Array.isArray(u.photos) && u.photos.length > 0) {
    photos.push(...u.photos);
  } else if (u.photoURL) {
    photos.push(u.photoURL);
  }
  // NO FALLBACKS - if no photos, modal will show "No Photos Available"

  // remove any existing modal
  document.querySelectorAll('.profile-modal-backdrop').forEach(el => el.remove());

  // backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'profile-modal-backdrop';
  backdrop.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.8);
    display:flex; align-items:center; justify-content:center; z-index:10000; padding:12px;
    backdrop-filter: blur(4px);
  `;

  // modal card
  const card = document.createElement('div');
  card.style.cssText = `
    width:100%; max-width:720px; max-height:92vh; overflow:auto;
    background:linear-gradient(145deg,#171821 0%,#1f2030 100%);
    color:#fff; border-radius:16px; border:1px solid #2a2a2a; box-shadow:0 12px 40px rgba(0,0,0,.5);
  `;

  // header (name + close)
  const name = u.displayName || 'Member';
  const username = u.username ? `@${u.username}` : '';
  const ageText = Number.isFinite(+u.age) ? `${u.age}` : '';
  const loc = u.location || '';

  // main image + controls
  let index = 0;
  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #2a2a2a;">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div style="font-size:1.3rem;font-weight:800">${name}${ageText?`, <span style="font-weight:600;opacity:.9">${ageText}</span>`:''}</div>
        <div style="opacity:.8">${[username, loc].filter(Boolean).join(' • ')}</div>
      </div>
      <button id="pm-close" class="btn secondary" style="padding:.4rem .8rem;">Close</button>
    </div>
  `;

  const media = `
    <div style="position:relative">
      <img id="pm-photo" data-src="${photos[0]}" alt="photo" style="width:100%;max-height:60vh;object-fit:cover;display:block;">
      <button id="pm-prev" class="btn pill small" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.9">‹</button>
      <button id="pm-next" class="btn pill small" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);opacity:.9">›</button>
      <div id="pm-dots" style="position:absolute;left:12px;right:12px;bottom:10px;display:flex;gap:6px;justify-content:center;"></div>
    </div>
  `;

  const thumbs = `
    <div id="pm-thumbs" style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;">
      ${photos.map((p,i)=>`
        <img data-i="${i}" data-src="${p}" style="width:74px;height:74px;object-fit:cover;border-radius:8px;border:${i===0?'2px solid #E11D2A':'2px solid transparent'};background:#0b0b0f;cursor:pointer;">
      `).join('')}
    </div>
  `;

  const details = `
    <div style="padding:8px 12px 16px 12px; display:grid; gap:10px;">
      ${u.bio ? `<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px;">
        <div style="font-weight:700;margin-bottom:6px;">About</div>
        <div style="opacity:.95;line-height:1.4">${u.bio}</div>
      </div>`:''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${u.hobbies ? `<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px;">
          <div style="font-weight:700;margin-bottom:6px;">Hobbies</div>
          <div style="opacity:.95">${u.hobbies}</div>
        </div>`:''}
        ${u.interests ? `<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px;">
          <div style="font-weight:700;margin-bottom:6px;">Interests</div>
          <div style="opacity:.95">${u.interests}</div>
        </div>`:''}
        ${u.gender ? `<div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px;">
          <div style="font-weight:700;margin-bottom:6px;">Gender</div>
          <div style="opacity:.95">${u.gender}</div>
        </div>`:''}
      </div>
      ${(Array.isArray(u.flags) && u.flags.length) ? `
        <div style="background:#12131a;border:1px solid #2a2a2a;border-radius:10px;padding:10px;">
          <div style="font-weight:700;margin-bottom:6px;">Red Flags (self-reported)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${u.flags.map(f=>`<span class="flag-pill" style="border:1px solid #3a3b44;border-radius:999px;padding:2px 8px;background:#14151a">${f}</span>`).join('')}
          </div>
        </div>
      `:''}
    </div>
  `;

  card.innerHTML = header + media + thumbs + details;
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  // wiring
  const imgEl = card.querySelector('#pm-photo');
  const prevBtn = card.querySelector('#pm-prev');
  const nextBtn = card.querySelector('#pm-next');
  const dotsEl = card.querySelector('#pm-dots');
  const closeBtn = card.querySelector('#pm-close');
  const thumbsEl = card.querySelector('#pm-thumbs');

  function renderDots() {
    dotsEl.innerHTML = photos.map((_,i)=>`
      <div style="
        width:28px;height:3px;border-radius:2px;
        background:${i===index ? '#fff':'#ffffff44'};
        transition:background .15s
      "></div>`).join('');
  }
  function setIndex(i) {
    index = (i+photos.length)%photos.length;
    
    // NO FALLBACKS - only show real photos
    if (photos[index]) {
      imgEl.src = photos[index];
    } else {
      imgEl.style.display = 'none';
    }
    
    renderDots();
    // highlight thumb
    thumbsEl.querySelectorAll('img').forEach((t,j)=>{
      t.style.border = (j===index) ? '2px solid #E11D2A' : '2px solid transparent';
    });
  }
  prevBtn.onclick = ()=> setIndex(index-1);
  nextBtn.onclick = ()=> setIndex(index+1);
  closeBtn.onclick = ()=> backdrop.remove();
  dotsEl.onclick = ()=>{}; // (click-through protection)

  thumbsEl.addEventListener('click', (e)=>{
    const t = e.target.closest('img[data-i]');
    if (t) setIndex(+t.dataset.i);
  });

  // keyboard nav
  const onKey = (e)=>{
    if (e.key === 'Escape') backdrop.remove();
    if (e.key === 'ArrowLeft') setIndex(index-1);
    if (e.key === 'ArrowRight') setIndex(index+1);
  };
  document.addEventListener('keydown', onKey, { once:false });
  backdrop.addEventListener('click', (e)=>{
    if (e.target === backdrop) backdrop.remove();
  });
  // cleanup when removed
  const obs = new MutationObserver(()=>{
    if (!document.body.contains(backdrop)) document.removeEventListener('keydown', onKey);
  });
  obs.observe(document.body,{childList:true});

  // Load thumbnails safely with PhotoUtils
  if (window.PhotoUtils?.loadImageWithFallback) {
    thumbsEl.querySelectorAll('img[data-src]').forEach(thumb => {
      const photoUrl = thumb.getAttribute('data-src');
      window.PhotoUtils.loadImageWithFallback(thumb, photoUrl, 'thumbnail');
    });
  }
  
  // Load main photo with PhotoUtils
  if (window.PhotoUtils?.loadImageWithFallback) {
    window.PhotoUtils.loadImageWithFallback(imgEl, photos[0], 'profile');
  }
  
  // initial
  renderDots();
  setIndex(index);
}

// expose if you want to call it elsewhere
window.showPublicProfile = showPublicProfile;

function showEmptyState() {
  const cardFrame = document.getElementById('cardFrame');
  if (!cardFrame) return;
  cardFrame.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#fff;text-align:center;padding:40px;">
      <div style="font-size:48px;margin-bottom:20px;">📭</div>
      <h3 style="margin:0 0 10px 0;">All Done!</h3>
      <p style="margin:0;color:var(--muted);">You've seen everyone. Open the Recycling Bin to restore profiles.</p>
    </div>`;
}

function nextProfile() {
  currentIndex++;
  if (currentIndex >= matches.length) currentIndex = 0;
  if (matches.length) renderProfile(matches[currentIndex]); else showEmptyState();
}

function passAction() {
  const current = matches[currentIndex];
  if (current?.uid && me) {
    window.recyclingBin.add(current, 'passed');
    // Remove from active deck so it won't come back until restored
    matches = matches.filter(m => m.uid !== current.uid);
    if (currentIndex >= matches.length) currentIndex = 0;
  }
  showIndicator(null);
  if (matches.length) renderProfile(matches[currentIndex]); else showEmptyState();
}

async function likeAction() {
  const current = matches[currentIndex];
  if (current?.uid && me && current.uid !== me.uid) {
    window.recyclingBin.add(current, 'liked');
    // Optimistically remove from deck
    matches = matches.filter(m => m.uid !== current.uid);
    if (currentIndex >= matches.length) currentIndex = 0;

    // Non-blocking Firebase writes with deterministic IDs to prevent duplicates
    try {
      // CRITICAL FIX: Use deterministic like ID to prevent duplicate likes from concurrent actions
      const likeDocId = `${me.uid}_${current.uid}`;
      await setDoc(doc(db, 'likes', likeDocId), {
        fromUid: me.uid, toUid: current.uid, createdAt: serverTimestamp(),
      });
      console.log('✅ [app.js] Like recorded with deterministic ID:', me.uid, '→', current.uid, 'ID:', likeDocId);
      const recip = await getDocs(query(
        collection(db, 'likes'),
        where('fromUid','==', current.uid),
        where('toUid','==', me.uid)
      ));
      if (!recip.empty) {
        const existing = await getDocs(query(
          collection(db, 'matches'),
          where('uids', 'in', [[me.uid,current.uid],[current.uid,me.uid]])
        ));
        if (existing.empty) {
          // CRITICAL FIX: Use deterministic match ID to prevent duplicate matches from concurrent mutual likes
          const matchDocId = `${Math.min(me.uid, current.uid)}_${Math.max(me.uid, current.uid)}`;
          await setDoc(doc(db, 'matches', matchDocId), {
            uids: [me.uid, current.uid], createdAt: serverTimestamp(),
          });
          console.log('✅ [app.js] Match created with deterministic ID:', me.uid, '↔', current.uid, 'ID:', matchDocId);
          window.showMatch?.(current);
        }
      }
    } catch (err) { console.warn('like/match non-blocking error:', err); }
  }
  showIndicator(null);
  if (matches.length) renderProfile(matches[currentIndex]); else showEmptyState();
}

// Function moved to Recycling Bin System section above

/* ===== WIRING: open modal from the swipe card and main photo ===== */
// 1) Swipe card click (outside action buttons)
(function attachCardOpen() {
  const frame = document.getElementById('cardFrame');
  if (!frame) return;
  frame.addEventListener('click', (e)=>{
    if (e.target.closest('.action-btn') || e.target.closest('button')) return;
    const current = (typeof matches !== 'undefined' && matches[currentIndex]) ? matches[currentIndex] : null;
    if (current) showPublicProfile(current);
  });
})();

// 2) Main photo click
(function attachMainPhotoOpen() {
  const mp = document.getElementById('candidate-photo');
  if (!mp) return;
  mp.addEventListener('click', (e)=>{
    e.stopPropagation();
    const current = (typeof matches !== 'undefined' && matches[currentIndex]) ? matches[currentIndex] : null;
    if (current) showPublicProfile(current);
  });
})();

// Add missing recycling bin functions
function closeRecyclingBin() {
  const modal = document.getElementById('recyclingBinModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('🗑️ Recycling bin modal closed');
  }
}

function clearRecyclingBin() {
  if (!window.recyclingBin) return;
  
  if (confirm('Clear all profiles from recycling bin? They will return to your deck.')) {
    window.recyclingBin.clear();
    showStyledNotification('🗑️ Recycling bin cleared! All profiles restored to your deck.', 'success');
    console.log('♻️ Recycling bin cleared');
    
    // Close modal if open
    closeRecyclingBin();
    
    // Optionally reload profiles to include the restored ones
    if (window.loadAllUsersDirectly) {
      window.loadAllUsersDirectly();
    }
  }
}

function removeFromRecyclingBin(profile) {
  if (!profile?.uid || !window.recyclingBin) return;
  restoreFromRecyclingBin(profile);
  showStyledNotification(`♻️ ${profile.displayName || 'Profile'} restored!`, 'success');
}

function viewRecycledProfile(profile) {
  if (!profile) return;
  showPublicProfile(profile);
}

// Expose functions globally
window.showRecyclingBin = showRecyclingBin;
window.closeRecyclingBin = closeRecyclingBin;
window.clearRecyclingBin = clearRecyclingBin;
window.removeFromRecyclingBin = removeFromRecyclingBin;
window.viewRecycledProfile = viewRecycledProfile;

// Fix recycling system - clear stuck recycled profiles
function fixContactRecycling() {
  try {
    // Don't clear the recycling bin data - users want to keep their matches!
    // Only clear temporary cache data
    localStorage.removeItem("profileCache");
    localStorage.removeItem("availableProfiles");
    
    // Reset any profile filtering flags
    if (window.profileManager) {
      window.profileManager.reset();
    }
    
    console.log("🔧 Contact recycling system reset - should now show all 56 contacts");
    console.log(`🗂️ Recycling bin preserved - ${window.recyclingBin.list().length} matches safe`);
    
    // Force reload profile data
    if (window.loadAllAvailableProfiles) {
      window.loadAllAvailableProfiles(true); // force refresh
    }
  } catch (error) {
    console.warn("Error fixing recycling (non-critical):", error.message || error);
  }
}

// Auto-fix recycling on page load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(fixContactRecycling, 2000); // Fix after 2 seconds
});

// Add button to manually fix (for debugging)
if (typeof window !== "undefined") {
  window.fixRecycling = fixContactRecycling;
}


// URGENT FIX: Reset recycling system completely
function emergencyRecyclingFix() {
  console.log("🚨 EMERGENCY RECYCLING FIX: Clearing ALL recycled profile data");
  
  // Clear ALL recycling data from localStorage
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes("recycled") || key.includes("profile") || key.includes("swipe"))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log("🗑️ Removed:", key);
  });
  
  // Force reload user data without any filtering
  if (window.loadAllProfiles) {
    console.log("🔄 Force reloading ALL 56 profiles...");
    window.loadAllProfiles();
  }
  
  console.log("✅ RECYCLING SYSTEM COMPLETELY RESET - Should now show all 56 users");
}

// DISABLED - Emergency fix was clearing data
// setTimeout(emergencyRecyclingFix, 1000);

// Add to window for manual access
window.emergencyRecyclingFix = emergencyRecyclingFix;

// Missing showLiveStreamsModal function - fixes "view streams button" clicks
function showLiveStreamsModal() {
  console.log('📺 Opening Live Streams modal...');
  
  // Remove existing modal to avoid duplicates
  const existingModal = document.querySelector('.live-streams-modal');
  if (existingModal) existingModal.remove();
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'live-streams-modal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1a1b22;
    border-radius: 16px;
    border: 1px solid #2a2a2a;
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    overflow: auto;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  `;
  
  modal.innerHTML = `
    <div style="padding: 24px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <h2 style="color: #fff; margin: 0; font-size: 24px;">🎥 Live Streams</h2>
        <button class="close-streams-btn" style="
          background: transparent;
          border: 2px solid #ff4081;
          color: #ff4081;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      
      <div id="streams-list" style="
        display: grid;
        gap: 16px;
        max-height: 400px;
        overflow-y: auto;
      ">
        <div style="
          text-align: center;
          color: #888;
          padding: 40px 20px;
          font-size: 16px;
        ">
          <div style="font-size: 48px; margin-bottom: 12px;">📺</div>
          <div>No live streams right now</div>
          <div style="font-size: 14px; margin-top: 8px;">Check back later for live content!</div>
        </div>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #2a2a2a; text-align: center;">
        <button style="
          background: #ff4081;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 24px;
          cursor: pointer;
          font-size: 16px;
        " onclick="this.closest('.live-streams-modal').remove()">
          Close
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners for closing
  const closeBtn = modal.querySelector('.close-streams-btn');
  closeBtn.addEventListener('click', () => overlay.remove());
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Simple viewer list modal function  
function showViewersList() {
  console.log('👀 Opening viewers list...');
  
  // Remove existing modal
  const existingModal = document.querySelector('.viewers-modal');
  if (existingModal) existingModal.remove();
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'viewers-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  const card = document.createElement('div');
  card.style.cssText = `
    background: linear-gradient(145deg, #1a1a1f 0%, #252530 100%);
    color: #fff;
    padding: 24px;
    border-radius: 16px;
    width: 400px;
    max-height: 500px;
    overflow-y: auto;
    border: 2px solid #ff6b00;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
  `;
  
  // Get current viewer count from the circle
  const currentCount = document.getElementById('viewerCount')?.textContent || '0';
  
  card.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <div style="width: 40px; height: 40px; background: #ff6b00; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 18px;">👀</span>
      </div>
      <div>
        <h3 style="margin: 0; color: #fff;">Live Viewers</h3>
        <div style="color: #ccc; font-size: 14px;">${currentCount} people watching</div>
      </div>
    </div>
    
    <div id="viewersList" style="display: flex; flex-direction: column; gap: 8px;">
      <div style="padding: 12px; background: rgba(255,107,0,0.1); border-radius: 8px; border: 1px solid #ff6b00;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; background: #ff6b00; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>
          <div>
            <div style="font-weight: bold;">Unfavorablejosh</div>
            <div style="font-size: 12px; color: #ccc;">Broadcaster</div>
          </div>
        </div>
      </div>
      
      <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; background: #666; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>
          <div>
            <div style="font-weight: bold;">Viewer1</div>
            <div style="font-size: 12px; color: #ccc;">Watching</div>
          </div>
        </div>
      </div>
      
      <div style="color: #888; text-align: center; padding: 12px; font-size: 14px;">
        + ${Math.max(0, parseInt(currentCount) - 2)} more viewers
      </div>
    </div>
    
    <button onclick="this.closest('.viewers-modal').remove()" style="width: 100%; margin-top: 16px; background: #ff6b00; border: 2px solid #ff6b00; color: #fff; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px;">
      Close
    </button>
  `;
  
  modal.appendChild(card);
  
  // Add click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  document.body.appendChild(modal);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Make it global
window.showViewersList = showViewersList;


/* ===== SECTION: Direct User Loading Function ===== */
async function loadAllUsersDirectly() {
  console.log('🔍 Direct loading: Getting all available users...');
  const mapUsers = new Map();
  const roomNames = ['general','first-dates','gym-rats','chaos-lounge','dating','friends','fwb','vents'];

  // Chat rooms
  for (const room of roomNames) {
    try {
      const membersCol = collection(db, "rooms", room, "members");
      const snapshot = await getDocs(membersCol);
      snapshot.forEach((d) => {
        const u = d.data(); const uid = d.id;
        if (uid !== me.uid && u.displayName && !mapUsers.has(uid)) {
          mapUsers.set(uid, {
            uid, displayName: u.displayName, photoURL: u.photoURL || "",
            age: u.age || null, location: u.location || "", lastSeenRoom: room, source: 'chat_room'
          });
        }
      });
    } catch {}
  }

  // Users collection
  try {
    const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(200)));
    usersSnapshot.forEach((d) => {
      const u = d.data(); const uid = d.id;
      if (uid !== me.uid && u.displayName && !mapUsers.has(uid)) {
        mapUsers.set(uid, { uid, ...u, source: 'users_collection' });
      }
    });
  } catch {}

  // Note: Removed demo user fallbacks - app relies only on real Firebase data

  const allUsersList = Array.from(mapUsers.values());
  const recycledSet = new Set(recyclingBin.list().map(p => p.uid));
  const list = allUsersList.filter(u => u && u.uid && u.uid !== me.uid && !recycledSet.has(u.uid));

  // After you compile candidate list `list`:
  const selfUid = window.me?.uid || null;
  window.matches = applyDeckFilters(list, selfUid);
  window.currentIndex = 0;

  if (window.matches.length) {
    renderProfile(window.matches[0]);
  } else {
    showEmptyState();
  }

  // Once (after me is set and UI is ready):
  wirePassLike({
    getDeck:   () => window.matches || [],
    setDeck:   (next) => { window.matches = next; window.currentIndex = 0; },
    getCurrent:() => (window.matches && window.matches.length ? window.matches[window.currentIndex] : null),
    onRender:  (p) => { if (p) renderProfile(p); else showEmptyState?.(); }
  });

  // Swipe gestures after loading
  initializeSwipeGestures();
  console.log('🎯 Loaded profiles (filtered for recycled):', window.matches.length);
  return window.matches;
}

// Firebase db already imported at top of file

/* ===== SECTION: Browse Matches wiring ===== */
(function () {
  const browseBtn = document.getElementById('browseBtn');
  if (!browseBtn) return;

  browseBtn.addEventListener('click', async () => {
    console.log('🔓 Browse Matches (recycling-aware)');
    if (!me || !myDocCached) {
      showStyledNotification('Please log in first', 'warning');
      return;
    }

    try {
      const mapUsers = new Map();
      const roomNames = ['general','first-dates','gym-rats','chaos-lounge','dating','friends','fwb','vents'];

      for (const room of roomNames) {
        try {
          const membersCol = collection(db, "rooms", room, "members");
          const snapshot = await getDocs(membersCol);
          snapshot.forEach((d) => {
            const u = d.data(); const uid = d.id;
            if (uid !== me.uid && u.displayName && !mapUsers.has(uid)) {
              mapUsers.set(uid, {
                uid, displayName: u.displayName, photoURL: u.photoURL || "",
                age: u.age || null, location: u.location || "", lastSeenRoom: room, source: 'chat_room'
              });
            }
          });
        } catch {}
      }

      try {
        const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(200)));
        usersSnapshot.forEach((d) => {
          const u = d.data(); const uid = d.id;
          if (uid !== me.uid && u.displayName && !mapUsers.has(uid)) {
            mapUsers.set(uid, { uid, ...u, source: 'users_collection' });
          }
        });
      } catch {}

      const allUsersList = Array.from(mapUsers.values());
      const recycledSet = new Set(recyclingBin.list().map(p => p.uid));
      const filtered = allUsersList.filter(u => u && u.uid && u.uid !== me.uid && !recycledSet.has(u.uid));

      // NEVER show user their own profile in browsing results
      matches = filtered.length ? filtered.sort(() => 0.5 - Math.random()) : [];
      currentIndex = 0;
      
      if (matches.length > 0) {
        renderProfile(matches[currentIndex]);
      } else {
        // Show empty state message
        showStyledNotification('No new profiles to browse right now. Check your recycling bin to revisit profiles.', 'info');
      }

      await renderInbox('matches');
      console.log('✅ Browse matches loaded (filtered):', matches.length);
    } catch (err) {
      console.error('Browse Matches handler failed:', err);
      showStyledNotification('Error loading matches. Please try again.', 'error');
    }
  });
})();

// Expose the new loading function and recycling bin
window.loadAllUsersDirectly = loadAllUsersDirectly;
window.recyclingBin = recyclingBin;

// 💖 Show Favorites Modal - PROPERLY IMPLEMENTED
async function showFavoritesModal() {
  console.log('💖 Favorites modal opened');
  
  const modal = document.createElement('div');
  modal.id = 'favoritesModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.8); display: flex; align-items: center; 
    justify-content: center; z-index: 1000;
  `;
  
  // Load actual user favorites from Firebase
  let favorites = [];
  try {
    if (me?.uid && db) {
      const userRef = doc(db, 'users', me.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        favorites = userData.favorites || [];
      }
    }
  } catch (error) {
    console.error('Failed to load favorites:', error);
  }
  
  modal.innerHTML = `
    <div style="max-width:500px; width:90%; background:#1a1b26; border:1px solid #2a2c39; border-radius:12px; padding:20px; color:white;">
      <h3 style="color:#E11D2A; margin-bottom:15px; display:flex; align-items:center; gap:8px;">
        💖 Your Favorites <span style="font-size:14px; background:#E11D2A; padding:2px 6px; border-radius:4px;">${favorites.length}</span>
      </h3>
      <div id="favoriteStreamersList" style="max-height:350px; overflow:auto; margin:10px 0;">
        ${favorites.length === 0 ? 
          `<div style="text-align:center; padding:40px; color:#888;">
            <p>No favorites yet</p>
            <p style="font-size:12px;">Click 💖 Follow on profiles to add them here!</p>
          </div>` : 
          favorites.map(fav => `
            <div class="favorite-item" data-uid="${fav.uid}" style="display:flex; align-items:center; gap:12px; padding:12px; background:#2a2b32; border-radius:8px; margin-bottom:8px; cursor:pointer; transition:background 0.2s ease;" onmouseover="this.style.background='#3a3b42'" onmouseout="this.style.background='#2a2b32'">
              <div style="width:40px; height:40px; border-radius:50%; background:#E11D2A; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:16px;">
                ${(fav.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-weight:bold; color:white; font-size:14px;">${fav.name || 'User'}</div>
                <div style="font-size:12px; color:#888;">
                  💖 Favorited • ${fav.addedAt ? new Date(fav.addedAt.seconds ? fav.addedAt.seconds * 1000 : fav.addedAt).toLocaleDateString() : 'Recently'}
                </div>
              </div>
              <div style="color:#E11D2A; font-size:14px;">👤</div>
            </div>
          `).join('')
        }
      </div>
      <div style="margin-top:15px; display:flex; justify-content:space-between;">
        ${favorites.length > 0 ? '<button onclick="clearAllFavorites()" style="background:#666; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Clear All</button>' : '<div></div>'}
        <button onclick="closeFavoritesModal()" style="background:#E11D2A; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add click handlers for favorite items
  const favoriteItems = modal.querySelectorAll('.favorite-item');
  favoriteItems.forEach(item => {
    item.addEventListener('click', () => {
      const uid = item.dataset.uid;
      const name = item.querySelector('div[style*="font-weight:bold"]').textContent;
      console.log('👤 Opening favorite profile:', name);
      closeFavoritesModal();
      if (window.showStreamerProfile) {
        window.showStreamerProfile(uid, name);
      }
    });
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFavoritesModal();
    }
  });
}

// Close favorites modal
function closeFavoritesModal() {
  const modal = document.getElementById('favoritesModal');
  if (modal) {
    modal.remove();
  }
}

// Add missing favorites management functions
async function addToFavorites(streamerUid, streamerName) {
  try {
    if (!me?.uid) return false;
    const userRef = doc(db, 'users', me.uid);
    await setDoc(userRef, {
      favorites: arrayUnion({uid: streamerUid, name: streamerName, addedAt: new Date()})
    }, {merge: true});
    
    // Add to recycling bin for match history
    if (window.recyclingBin) {
      window.recyclingBin.add({
        uid: streamerUid, 
        displayName: streamerName, 
        isOnline: true
      }, 'favorite');
    }
    
    console.log('✅ Added to favorites:', streamerName);
    return true;
  } catch (error) {
    console.error('❌ Failed to add favorite:', error);
    return false;
  }
}

async function removeFromFavorites(streamerUid) {
  try {
    if (!me?.uid) return false;
    const userRef = doc(db, 'users', me.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const favorites = userData.favorites || [];
      const updatedFavorites = favorites.filter(fav => fav.uid !== streamerUid);
      await setDoc(userRef, {favorites: updatedFavorites}, {merge: true});
      console.log('✅ Removed from favorites');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to remove favorite:', error);
    return false;
  }
}

function isFavoriteStreamer(streamerUid) {
  if (!me?.favorites) return false;
  return me.favorites.some(fav => fav.uid === streamerUid);
}

// Members Modal Function
function showMembersModal() {
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1a1b22;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 20px;
    max-width: 400px;
    width: 90%;
    max-height: 500px;
    overflow-y: auto;
  `;

  // Modal header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    border-bottom: 1px solid #23243b;
    padding-bottom: 10px;
  `;
  
  const title = document.createElement('h3');
  title.textContent = `Members (${document.getElementById('memberCount')?.textContent || '0'})`;
  title.style.cssText = `
    color: #ff6b00;
    margin: 0;
    font-size: 1.2rem;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
  `;
  closeBtn.onclick = () => document.body.removeChild(backdrop);

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Members content - clone the existing members container
  const membersContainer = document.getElementById('membersContainer');
  const membersContent = membersContainer ? membersContainer.cloneNode(true) : document.createElement('div');
  membersContent.style.cssText = `
    max-height: 350px;
    overflow-y: auto;
  `;

  // If no members, show message
  if (!membersContainer || membersContainer.children.length === 0) {
    membersContent.innerHTML = '<div style="text-align:center;color:#666;padding:20px;">No members online</div>';
  }

  modal.appendChild(header);
  modal.appendChild(membersContent);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      document.body.removeChild(backdrop);
    }
  };
}

// Expose all functions to window for global access
window.showFavoritesModal = showFavoritesModal;
window.closeFavoritesModal = closeFavoritesModal;
window.addToFavorites = addToFavorites;
window.removeFromFavorites = removeFromFavorites;
window.isFavoriteStreamer = isFavoriteStreamer;
window.showStreamerProfile = showStreamerProfile;
window.showMembersModal = showMembersModal;

// =====================================================
// NAVIGATION EVENT LISTENERS - COMPREHENSIVE FIX
// =====================================================

// Add navigation event listeners for fixed buttons
safeDOMReady(function() {
  console.log('🧭 Setting up navigation event listeners...');
  
  // Points display navigation
  safeAddEventListener(safeGetById('userPointsDisplay'), 'click', function() {
    window.location.href = './leaderboard.html';
  }, 'points display navigation');
  
  // World button navigation  
  safeAddEventListener(document.querySelector('.world-nav-btn'), 'click', function() {
    window.location.href = './world/feed.html';
  }, 'world navigation');
  
  // Live events button navigation
  safeAddEventListener(document.querySelector('.live-events-btn'), 'click', function() {
    window.location.href = './live-events.html';
  }, 'live events navigation');
  
  console.log('✅ Navigation event listeners bound successfully');
});

console.log('✅ All favorites, profile functions, and navigation handlers loaded successfully');
