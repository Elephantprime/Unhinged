// public/js/live-stream.js - Updated: 2025-09-18 15:30:21 with comprehensive video debugging
import { auth, db } from "/js/firebase.js";
import {
  collection, doc, setDoc, getDoc, onSnapshot, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  safeSendSignal, serializeOffer, serializeAnswer, serializeIceCandidate, makeChannelRefs
} from "/js/signaling-debug.js";

/* ----- DOM helpers (optional) ----- */
const $ = (id) => document.getElementById(id);
const localVideo   = $("localVideo");     // <video id="localVideo" autoplay muted playsinline>
const remoteVideo  = $("remoteVideo");    // <video id="remoteVideo" autoplay playsinline>
const streamStatus = $("streamStatus");   // <div id="streamStatus"></div>
const setStatus = (t) => { if (streamStatus) streamStatus.textContent = t; console.log("[LIVE]", t); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ----- SIMPLE DIRECT VIDEO FIX ----- */
// Simple function to bypass all complex logic and get camera working
window.testCamera = async function() {
  console.log('🚨 TESTING CAMERA - Simple direct approach');
  
  try {
    // Get camera
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    console.log('✅ Got camera stream');
    
    // Get video element
    const video = document.getElementById('localVideo');
    if (!video) {
      console.error('❌ No video element found');
      return false;
    }
    
    // Assign stream and play
    video.srcObject = stream;
    video.play();
    
    // Make visible
    video.style.display = 'block';
    video.style.opacity = '1';
    video.style.visibility = 'visible';
    
    // Show container
    const liveBox = document.getElementById('live-box');
    if (liveBox) {
      liveBox.style.background = 'transparent';
      liveBox.style.opacity = '1';
    }
    
    console.log('✅ Camera should now be visible!');
    return true;
    
  } catch (error) {
    console.error('❌ Camera test failed:', error);
    return false;
  }
};

/* ----- COMPREHENSIVE VIDEO DEBUGGING FUNCTIONS ----- */

/**
 * CRITICAL: Robust Video Element Detection Function
 * This function performs comprehensive debugging and validation of the localVideo element
 */
function ensureVideoElement() {
  console.log('🔍 Starting video element detection...');
  
  // Try multiple ways to find the video element
  const localVideo = document.getElementById("localVideo");
  const videoByQuery = document.querySelector("#localVideo");
  const videosInLiveBox = document.querySelectorAll(".live-box video, #live-box video");
  
  console.log('🔍 Video element search results:', {
    byId: !!localVideo,
    byQuery: !!videoByQuery,
    videosInLiveBox: videosInLiveBox.length,
    localVideoElement: localVideo,
    domReady: document.readyState
  });
  
  if (!localVideo) {
    console.error('❌ CRITICAL: localVideo element not found!');
    console.error('❌ Available elements with video tag:', document.querySelectorAll('video'));
    console.error('❌ Available elements with localVideo id:', document.querySelectorAll('#localVideo'));
    console.error('❌ Live box containers:', document.querySelectorAll('.live-box, #live-box'));
    return null;
  }
  
  console.log('✅ Video element properties:', {
    id: localVideo.id,
    tagName: localVideo.tagName,
    parentElement: localVideo.parentElement?.className,
    parentId: localVideo.parentElement?.id,
    style: localVideo.style.cssText,
    autoplay: localVideo.autoplay,
    muted: localVideo.muted,
    playsinline: localVideo.playsInline,
    currentSrc: localVideo.currentSrc,
    srcObject: !!localVideo.srcObject,
    readyState: localVideo.readyState,
    videoWidth: localVideo.videoWidth,
    videoHeight: localVideo.videoHeight
  });
  
  return localVideo;
}

/**
 * CRITICAL: Container Visibility Check and Fix Function
 * Ensures the live-box container is properly visible and not interfering with video display
 */
function ensureContainerVisibility() {
  console.log('📦 Checking container visibility...');
  
  // Find the live-box container
  const liveBox = document.getElementById('live-box') || document.querySelector('.live-box');
  
  if (!liveBox) {
    console.error('❌ CRITICAL: live-box container not found!');
    return false;
  }
  
  const computedStyle = getComputedStyle(liveBox);
  
  console.log('📦 Live box container properties:', {
    id: liveBox.id,
    className: liveBox.className,
    display: computedStyle.display,
    visibility: computedStyle.visibility,
    opacity: computedStyle.opacity,
    zIndex: computedStyle.zIndex,
    background: computedStyle.background,
    backgroundColor: computedStyle.backgroundColor,
    position: computedStyle.position,
    width: computedStyle.width,
    height: computedStyle.height,
    overflow: computedStyle.overflow
  });
  
  // Force container visibility and transparency
  liveBox.style.background = 'transparent';
  liveBox.style.backgroundColor = 'transparent';
  liveBox.style.opacity = '1';
  liveBox.style.visibility = 'visible';
  liveBox.style.display = 'block';
  liveBox.style.zIndex = '1999';
  liveBox.style.position = 'relative';
  
  console.log('✅ Container visibility forced - background: transparent, opacity: 1, z-index: 1999');
  
  return true;
}

/**
 * CRITICAL: Enhanced Stream Assignment with Comprehensive Verification
 * Assigns the stream to video element with detailed debugging and verification
 */
async function assignStreamToVideo(videoElement, localStream) {
  console.log('🎥 Starting enhanced stream assignment...');
  
  if (!videoElement) {
    console.error('❌ CRITICAL: Video element is null, cannot assign stream');
    return false;
  }
  
  if (!localStream) {
    console.error('❌ CRITICAL: Local stream is null, cannot assign');
    return false;
  }
  
  // Log stream details before assignment
  console.log('🎥 Stream details before assignment:', {
    streamActive: localStream.active,
    streamId: localStream.id,
    videoTracks: localStream.getVideoTracks().length,
    audioTracks: localStream.getAudioTracks().length,
    videoTrackEnabled: localStream.getVideoTracks()[0]?.enabled,
    videoTrackReadyState: localStream.getVideoTracks()[0]?.readyState,
    videoTrackSettings: localStream.getVideoTracks()[0]?.getSettings()
  });
  
  try {
    // Assign stream to video element
    videoElement.srcObject = localStream;
    
    console.log('🎥 Stream assigned to video element');
    
    // Verify assignment
    console.log('🎥 Post-assignment verification:', {
      srcObject: !!videoElement.srcObject,
      srcObjectActive: videoElement.srcObject?.active,
      srcObjectId: videoElement.srcObject?.id,
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      readyState: videoElement.readyState
    });
    
    // Force video display properties
    videoElement.style.display = 'block';
    videoElement.style.opacity = '1';
    videoElement.style.visibility = 'visible';
    videoElement.style.zIndex = '2000';
    videoElement.style.position = 'relative';
    
    console.log('✅ Video display properties forced - display: block, opacity: 1, z-index: 2000');
    
    // Force video to play
    try {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Video playing successfully');
      }
    } catch (playError) {
      console.error('❌ Video play failed:', playError.message);
      console.error('❌ Play error details:', playError);
    }
    
    return true;
    
  } catch (assignError) {
    console.error('❌ Stream assignment failed:', assignError.message);
    console.error('❌ Assignment error details:', assignError);
    return false;
  }
}

/**
 * CRITICAL: Add Comprehensive Video Event Handlers
 * Adds detailed event listeners to track video loading and playback status
 */
function addVideoEventHandlers(videoElement) {
  console.log('📹 Adding comprehensive video event handlers...');
  
  if (!videoElement) {
    console.error('❌ Cannot add event handlers - video element is null');
    return;
  }
  
  // Remove existing event listeners to prevent duplicates
  const events = ['loadstart', 'loadeddata', 'loadedmetadata', 'canplay', 'canplaythrough', 'playing', 'play', 'pause', 'ended', 'error', 'waiting', 'stalled'];
  
  events.forEach(eventType => {
    videoElement.removeEventListener(eventType, window[`videoHandler_${eventType}`]);
  });
  
  // Add new event handlers
  window.videoHandler_loadstart = () => {
    console.log('📹 Video event: loadstart - Video load started');
  };
  
  window.videoHandler_loadeddata = () => {
    console.log('📹 Video event: loadeddata - Video data loaded successfully');
    console.log('📹 Video dimensions:', {
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      duration: videoElement.duration
    });
  };
  
  window.videoHandler_loadedmetadata = () => {
    console.log('📹 Video event: loadedmetadata - Video metadata loaded');
  };
  
  window.videoHandler_canplay = () => {
    console.log('📹 Video event: canplay - Video can start playing');
  };
  
  window.videoHandler_canplaythrough = () => {
    console.log('📹 Video event: canplaythrough - Video can play through without buffering');
  };
  
  window.videoHandler_playing = () => {
    console.log('📹 Video event: playing - Video is now playing');
    console.log('📹 Current video state:', {
      paused: videoElement.paused,
      ended: videoElement.ended,
      currentTime: videoElement.currentTime,
      readyState: videoElement.readyState
    });
  };
  
  window.videoHandler_play = () => {
    console.log('📹 Video event: play - Play method called');
  };
  
  window.videoHandler_pause = () => {
    console.log('📹 Video event: pause - Video paused');
  };
  
  window.videoHandler_ended = () => {
    console.log('📹 Video event: ended - Video ended');
  };
  
  window.videoHandler_error = (e) => {
    console.error('❌ Video event: error - Video error occurred');
    console.error('❌ Video error details:', {
      error: videoElement.error,
      errorCode: videoElement.error?.code,
      errorMessage: videoElement.error?.message,
      networkState: videoElement.networkState,
      readyState: videoElement.readyState
    });
  };
  
  window.videoHandler_waiting = () => {
    console.log('📹 Video event: waiting - Video is waiting for data');
  };
  
  window.videoHandler_stalled = () => {
    console.log('📹 Video event: stalled - Video download stalled');
  };
  
  // Attach all event listeners
  videoElement.addEventListener('loadstart', window.videoHandler_loadstart);
  videoElement.addEventListener('loadeddata', window.videoHandler_loadeddata);
  videoElement.addEventListener('loadedmetadata', window.videoHandler_loadedmetadata);
  videoElement.addEventListener('canplay', window.videoHandler_canplay);
  videoElement.addEventListener('canplaythrough', window.videoHandler_canplaythrough);
  videoElement.addEventListener('playing', window.videoHandler_playing);
  videoElement.addEventListener('play', window.videoHandler_play);
  videoElement.addEventListener('pause', window.videoHandler_pause);
  videoElement.addEventListener('ended', window.videoHandler_ended);
  videoElement.addEventListener('error', window.videoHandler_error);
  videoElement.addEventListener('waiting', window.videoHandler_waiting);
  videoElement.addEventListener('stalled', window.videoHandler_stalled);
  
  console.log('✅ All video event handlers attached successfully');
}

/* ----- State ----- */
let pc = null;
let localStream = null;
let currentStreamId = null;
let isHost = false;

/* ----- TURN/STUN ----- */
const rtcConfiguration = {
  iceServers: [
    { urls:"stun:stun.l.google.com:19302" },
    { urls:"stun:stun1.l.google.com:19302" },
    { urls:"stun:stun2.l.google.com:19302" },
    { urls:"stun:stun3.l.google.com:19302" },
    { urls:"stun:stun4.l.google.com:19302" },
    { urls:"turn:openrelay.metered.ca:80",  username:"openrelayproject", credential:"openrelayproject" },
    { urls:"turn:openrelay.metered.ca:443", username:"openrelayproject", credential:"openrelayproject" },
  ],
  iceCandidatePoolSize: 10,
};

function createPC() {
  if (pc) { try { pc.close(); } catch {} }
  pc = new RTCPeerConnection(rtcConfiguration);

  pc.ontrack = (evt) => {
    if (remoteVideo && evt.streams && evt.streams[0]) remoteVideo.srcObject = evt.streams[0];
  };

  pc.onconnectionstatechange = () => setStatus(`Connection: ${pc.connectionState}`);

  pc.onicecandidate = async (ev) => {
    if (!ev.candidate || !currentStreamId || !auth.currentUser) return;
    const flat = serializeIceCandidate(ev.candidate);
    if (!flat) return;
    const { candRef } = makeChannelRefs(db, currentStreamId);
    await safeSendSignal(candRef, { from: auth.currentUser.uid, role: (isHost ? "host" : "viewer"), ...flat }, "ice");
  };

  return pc;
}

/* ================= HOST ================= */

// Simple state management to prevent race conditions  
let streamStartState = 'idle'; // 'idle', 'validating-password', 'setting-up-video', 'active'

// CRITICAL: Aggressive backdrop cleanup function
function forceCleanupAllBackdrops() {
  console.log('🧹 Starting aggressive backdrop cleanup...');
  
  // Remove ALL modal backdrops
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    console.log('🗑️ Removing modal backdrop:', el);
    el.remove();
  });
  
  // Remove ANY elements with high z-index that could be covering video
  document.querySelectorAll('*').forEach(el => {
    const computedStyle = window.getComputedStyle(el);
    const zIndex = parseInt(computedStyle.zIndex);
    
    // ENHANCED: Remove ALL high z-index overlays (removed upper limit)
    if (zIndex > 100 && 
        !el.id.includes('localVideo') && 
        !el.id.includes('remoteVideo') &&
        !el.classList.contains('live-box') &&
        !el.id.includes('live-box') &&
        el.tagName !== 'HEADER' &&
        !el.closest('header')) {
      
      // Check if element has backdrop-like properties OR covers significant viewport area
      const rect = el.getBoundingClientRect();
      const coversSignificantArea = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;
      
      if ((computedStyle.position === 'fixed' || computedStyle.position === 'absolute') && 
          (computedStyle.background.includes('rgba') || computedStyle.backdropFilter || coversSignificantArea)) {
        console.log('🗑️ Removing high z-index overlay:', el, 'z-index:', zIndex, 'covers area:', coversSignificantArea);
        el.remove();
      }
    }
  });
  
  // Reset body styles that might interfere
  document.body.style.backdropFilter = '';
  document.body.style.overflow = 'auto';
  
  // Force video elements to MAXIMUM z-index layer
  if (localVideo) {
    localVideo.style.zIndex = '99999';
    localVideo.style.position = 'relative';
  }
  if (remoteVideo) {
    remoteVideo.style.zIndex = '99999';
    remoteVideo.style.position = 'relative';
  }
  
  console.log('✅ Aggressive backdrop cleanup completed');
}

// Custom Error Modal Function that matches app design
function showCustomErrorModal(title, message, instructions) {
  return new Promise((resolve) => {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop active';
    backdrop.style.cssText = `
      display: flex;
      position: fixed;
      inset: 0;
      background: rgba(22, 4, 18, 0.75);
      z-index: 1000000;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(5px);
      pointer-events: auto;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'custom-error-modal';
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a0a1d 0%, #2d1b2e 100%);
      border: 2px solid #E11D2A;
      border-radius: 20px;
      padding: 30px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(225, 29, 42, 0.3);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
    `;
    
    // Title
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    titleEl.style.cssText = `
      margin: 0 0 20px 0;
      color: #E11D2A;
      font-size: 24px;
      font-weight: 600;
    `;
    
    // Message
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      margin: 0 0 20px 0;
      color: #fff;
      font-size: 16px;
      line-height: 1.5;
    `;
    
    // Instructions list
    const instructionsList = document.createElement('ul');
    instructionsList.style.cssText = `
      text-align: left;
      margin: 0 0 30px 0;
      padding: 0;
      list-style: none;
      color: #fff;
    `;
    
    instructions.forEach((instruction) => {
      const li = document.createElement('li');
      li.textContent = instruction;
      li.style.cssText = `
        margin: 10px 0;
        padding-left: 20px;
        position: relative;
        font-size: 14px;
        line-height: 1.4;
      `;
      li.style.setProperty('::before', 'content: "•"; color: #E11D2A; position: absolute; left: 0;');
      instructionsList.appendChild(li);
    });
    
    // OK button
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Got It';
    okBtn.style.cssText = `
      background: linear-gradient(135deg, #E11D2A 0%, #FF6B6B 100%);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px 30px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(225, 29, 42, 0.3);
    `;
    
    // Button hover effect
    okBtn.addEventListener('mouseenter', () => {
      okBtn.style.transform = 'translateY(-2px)';
      okBtn.style.boxShadow = '0 6px 20px rgba(225, 29, 42, 0.4)';
    });
    
    okBtn.addEventListener('mouseleave', () => {
      okBtn.style.transform = 'translateY(0)';
      okBtn.style.boxShadow = '0 4px 15px rgba(225, 29, 42, 0.3)';
    });
    
    // Cleanup function
    function cleanup() {
      document.documentElement.classList.remove('modal-open');
      if (backdrop && backdrop.parentNode) {
        backdrop.style.opacity = '0';
        setTimeout(() => {
          if (backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
        }, 300);
      }
      document.body.style.overflow = 'auto';
    }
    
    // Event listeners
    okBtn.addEventListener('click', () => {
      cleanup();
      resolve();
    });
    
    // ESC key to close
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', escapeHandler);
        resolve();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Click outside to close
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
        resolve();
      }
    });
    
    // Assemble modal
    modal.appendChild(titleEl);
    modal.appendChild(messageEl);
    modal.appendChild(instructionsList);
    modal.appendChild(okBtn);
    backdrop.appendChild(modal);
    
    // Add modal-open class and add to DOM
    document.documentElement.classList.add('modal-open');
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    
    // Focus the OK button
    setTimeout(() => okBtn.focus(), 100);
  });
}

// FIXED: Custom Password Modal Function with z-index fix
function showPasswordModal() {
  return new Promise((resolve, reject) => {
    // FIXED: Use CSS class approach to manage video z-indexes
    document.documentElement.classList.add('modal-open');
    console.log('🎯 Added modal-open class to enable modal interaction');
    
    // Create modal backdrop with MAXIMUM z-index
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop active';
    backdrop.style.cssText = `
      display: flex !important;
      position: fixed !important;
      inset: 0 !important;
      background: rgba(22, 4, 18, 0.75) !important;
      z-index: 2147483647 !important;
      align-items: center !important;
      justify-content: center !important;
      backdrop-filter: blur(5px) !important;
      pointer-events: auto !important;
      cursor: default !important;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      background: linear-gradient(120deg, #1a1b22 90%, #0a0a13 100%);
      border-radius: 20px;
      box-shadow: 0 8px 32px #E11D2A44, 0 0 0 2.5px #E11D2A;
      padding: 36px 34px 28px 34px;
      max-width: 400px;
      width: 90vw;
      color: #fff;
      position: relative;
      text-align: center;
      font-family: 'Montserrat', 'Arial Black', Arial, sans-serif;
    `;
    
    // Create modal content
    modal.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 24px; font-weight: 900; color: #E11D2A; margin-bottom: 12px; text-shadow: 0 2px 12px #ff6b0090;">
          🔐 Go Live
        </div>
        <div style="color: #fafbfc; font-size: 16px; opacity: 0.9;">
          Enter password to start live streaming
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <input type="password" id="passwordModalInput" placeholder="Enter password" 
               style="
                 width: 100%;
                 padding: 14px 16px;
                 border: 2px solid #ff6b00;
                 border-radius: 12px;
                 background: rgba(255, 255, 255, 0.1);
                 color: #fff;
                 font-size: 16px;
                 font-family: inherit;
                 outline: none;
                 box-sizing: border-box;
                 transition: border-color 0.3s, box-shadow 0.3s;
               ">
      </div>
      
      <div id="passwordError" style="
        color: #ff4444;
        font-size: 14px;
        margin-bottom: 16px;
        min-height: 20px;
        font-weight: 600;
      "></div>
      
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="passwordModalCancel" style="
          font-family: 'Montserrat', 'Arial Black', Arial, sans-serif;
          font-weight: 700;
          font-size: 15px;
          border: none;
          border-radius: 10px;
          padding: 12px 24px;
          color: #fff;
          background: linear-gradient(100deg, #666 30%, #999 100%);
          cursor: pointer;
          transition: all 0.2s;
        ">Cancel</button>
        
        <button id="passwordModalSubmit" style="
          font-family: 'Montserrat', 'Arial Black', Arial, sans-serif;
          font-weight: 700;
          font-size: 15px;
          border: none;
          border-radius: 10px;
          padding: 12px 24px;
          color: #fff;
          background: linear-gradient(95deg, #e11d2a 40%, #ff6b00 100%);
          box-shadow: 0 4px 16px -2px #e11d2a55;
          cursor: pointer;
          transition: all 0.2s;
        ">🚀 Go Live</button>
      </div>
    `;
    
    // Add modal to DOM
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    // Get elements
    const input = document.getElementById('passwordModalInput');
    const errorDiv = document.getElementById('passwordError');
    const cancelBtn = document.getElementById('passwordModalCancel');
    const submitBtn = document.getElementById('passwordModalSubmit');
    
    // Focus input
    setTimeout(() => input.focus(), 100);
    
    // Validation function
    let attempts = 0;
    const maxAttempts = 3;
    
    function validatePassword() {
      const password = input.value.trim();
      
      if (!password) {
        errorDiv.textContent = '❌ Password cannot be empty';
        input.style.borderColor = '#ff4444';
        return false;
      }
      
      if (password !== 'unhinged2024') {
        attempts++;
        if (attempts >= maxAttempts) {
          errorDiv.textContent = `❌ Maximum attempts exceeded (${attempts}/${maxAttempts})`;
          setTimeout(() => {
            cleanup();
            resolve(null);
          }, 2000);
          return false;
        } else {
          errorDiv.textContent = `❌ Incorrect password (${attempts}/${maxAttempts})`;
          input.style.borderColor = '#ff4444';
          input.value = '';
          input.focus();
          return false;
        }
      }
      
      return true;
    }
    
    // FIXED: Enhanced cleanup with video restoration
    function cleanup() {
      try {
        // Remove modal backdrop
        if (backdrop && backdrop.parentNode) {
          backdrop.style.opacity = '0';
          backdrop.style.pointerEvents = 'none';
          backdrop.parentNode.removeChild(backdrop);
        }
        
        // FIXED: Remove modal-open class and cleanup backdrops
        document.documentElement.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.style.overflow = 'auto';
        
        console.log('🎯 Removed modal-open class and cleaned up backdrops');
        console.log('✅ Modal cleanup completed - faded screen should be gone');
      } catch (error) {
        console.error('❌ Error during modal cleanup:', error);
      }
    }
    
    // FIXED: Event listeners with timeout fallback
    let resolved = false;
    
    // Add timeout to prevent infinite hang
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log('⏰ Modal timeout - auto-canceling');
        resolve(null);
      }
    }, 30000); // 30 second timeout
    
    cancelBtn.addEventListener('click', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        console.log('❌ User canceled password entry');
        resolve(null);
      }
    });
    
    submitBtn.addEventListener('click', () => {
      if (!resolved && validatePassword()) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        console.log('✅ Password validated successfully');
        resolve(input.value.trim());
      }
    });
    
    // Enter key support
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !resolved) {
        if (validatePassword()) {
          resolved = true;
          clearTimeout(timeoutId);
          cleanup();
          console.log('✅ Password validated via Enter key');
          resolve(input.value.trim());
        }
      }
    });
    
    // Escape key to cancel
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape' && !resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        document.removeEventListener('keydown', escapeHandler);
        console.log('❌ User canceled with Escape key');
        resolve(null);
      }
    });
    
    // Input focus styling
    input.addEventListener('focus', () => {
      input.style.borderColor = '#E11D2A';
      input.style.boxShadow = '0 0 0 3px rgba(225, 29, 42, 0.2)';
    });
    
    input.addEventListener('blur', () => {
      if (!errorDiv.textContent) {
        input.style.borderColor = '#ff6b00';
        input.style.boxShadow = 'none';
      }
    });
    
    // Clear error on input
    input.addEventListener('input', () => {
      if (errorDiv.textContent) {
        errorDiv.textContent = '';
        input.style.borderColor = '#ff6b00';
      }
    });
    
    // Button hover effects
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.background = 'linear-gradient(98deg, #ff6b00 35%, #e11d2a 100%)';
      submitBtn.style.transform = 'translateY(-1px) scale(1.02)';
    });
    
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.background = 'linear-gradient(95deg, #e11d2a 40%, #ff6b00 100%)';
      submitBtn.style.transform = 'none';
    });
    
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = 'linear-gradient(100deg, #999 30%, #666 100%)';
      cancelBtn.style.transform = 'translateY(-1px)';
    });
    
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'linear-gradient(100deg, #666 30%, #999 100%)';
      cancelBtn.style.transform = 'none';
    });
    
    // Click outside to cancel
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
        resolve(null);
      }
    });
  });
}

export async function startLiveStream() {
  console.log('🔍 CHECKPOINT 1: startLiveStream function entry');
  
  if (!auth.currentUser) { 
    console.log('🔍 CHECKPOINT 1A: No authenticated user, exiting');
    if (window.toast) {
      window.toast.error("🔐 Log in first to start streaming");
    } else {
      console.error("Log in first to start streaming");
    }
    return; 
  }
  
  console.log('🔍 CHECKPOINT 1B: User authenticated, proceeding');
  console.log('🔍 Current stream state:', streamStartState);
  
  // CRITICAL: Enhanced duplicate call prevention with state management
  // Simple duplicate call prevention without deadlocks
  if (streamStartState !== 'idle') {
    console.log('🔍 CHECKPOINT 1C: Stream start already in progress, ignoring duplicate call. Current state:', streamStartState);
    return;
  }
  
  console.log('🔍 CHECKPOINT 1F: State is idle, proceeding to password validation');
  
  // Set state for duplicate prevention
  streamStartState = 'validating-password';
  
  try {
    console.log('🔍 CHECKPOINT 2: Entered try block, starting password validation');
    
    // PASSWORD PROTECTION FOR GOING LIVE - WITH FIXED Z-INDEX MANAGEMENT
    console.log('🔐 Showing custom password modal...');
    const password = await showPasswordModal();
    
    console.log('🔍 CHECKPOINT 2A: Password modal returned, checking result');
    
    // User cancelled or modal returned null
    if (password === null) {
      console.log('🔍 CHECKPOINT 2B: Password was null, user cancelled, exiting cleanly');
      console.log('✅ User cancelled password entry - exiting cleanly');
      streamStartState = 'idle'; // Reset state on cancel
      return;
    }
    
    console.log('✅ Password accepted - proceeding to camera setup');
    
    console.log('🔍 CHECKPOINT 2C: Password validation successful, proceeding to stream setup');
    
    // CRITICAL: Transition to video setup state - this prevents duplicate calls during video setup
    streamStartState = 'setting-up-video';
    console.log('🔍 State changed to: setting-up-video');
    
    // CRITICAL: Immediate cleanup of any faded overlays
    console.log('🧹 Removing any faded screen overlays immediately...');
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.style.overflow = 'auto';
    const overlays = document.querySelectorAll('[style*="backdrop-filter"]');
    overlays.forEach(el => el.remove());
    console.log('✅ All faded overlays cleared - screen should be normal now');
    
    forceCleanupAllBackdrops();
    
    console.log('🔍 CHECKPOINT 3: Setting host status and requesting camera');
    
    isHost = true;
    setStatus("Requesting camera/mic…");
    console.log('📹 Requesting camera access...');
    
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      console.log('🔍 CHECKPOINT 3A: Camera access granted successfully');
      console.log('✅ Camera access granted, setting up video...');
    } catch (cameraError) {
      console.error('🔍 CHECKPOINT 3B: Camera access failed:', cameraError);
      throw cameraError;
    }
    
    // CRITICAL: Another cleanup after camera access
    setTimeout(() => {
      console.log('🧹 Post-camera cleanup...');
      forceCleanupAllBackdrops();
    }, 200);
    
    console.log('🔍 CHECKPOINT 4: About to start comprehensive video element detection and assignment');
    
    // CRITICAL: Enhanced video element detection and stream assignment
    console.log('🔍 Starting comprehensive video element detection and assignment...');
    
    try {
      console.log('🔍 CHECKPOINT 4A: Calling ensureVideoElement()');
      
      // Step 1: Ensure video element exists with robust detection
      const videoElement = ensureVideoElement();
      if (!videoElement) {
        console.error('🔍 CHECKPOINT 4B: Video element not found, throwing error');
        console.error('❌ CRITICAL: Cannot proceed - video element not found!');
        throw new Error('Video element not found - cannot start stream');
      }
      
      console.log('🔍 CHECKPOINT 4C: Video element found successfully, proceeding to container visibility');
      
      // Step 2: Ensure container visibility and fix any blocking issues
      const containerOk = ensureContainerVisibility();
      if (!containerOk) {
        console.log('🔍 CHECKPOINT 4D: Container visibility issues detected but continuing');
        console.warn('⚠️ Container visibility issues detected but continuing...');
      } else {
        console.log('🔍 CHECKPOINT 4E: Container visibility OK');
      }
      
      console.log('🔍 CHECKPOINT 4F: Adding video event handlers');
      
      // Step 3: Add comprehensive video event handlers for debugging
      addVideoEventHandlers(videoElement);
      
      console.log('🔍 CHECKPOINT 4G: About to assign stream to video element');
      
      // Step 4: Enhanced stream assignment with verification
      const assignmentSuccess = await assignStreamToVideo(videoElement, localStream);
      if (!assignmentSuccess) {
        console.error('🔍 CHECKPOINT 4H: Stream assignment failed, throwing error');
        console.error('❌ CRITICAL: Stream assignment failed!');
        throw new Error('Failed to assign stream to video element');
      }
      
      console.log('🔍 CHECKPOINT 4I: Stream assignment successful');
      console.log('✅ Local video stream assigned and visibility forced');
      
    } catch (videoSetupError) {
      console.error('🔍 CHECKPOINT 4J: Video setup failed with error:', videoSetupError);
      console.error('❌ CRITICAL: Video setup failed:', videoSetupError.message);
      throw videoSetupError;
    }
    
    console.log('🔍 CHECKPOINT 5: Video setup complete, waiting for video to load');
    
    // Step 5: Wait for video to start playing with comprehensive monitoring
    await new Promise((resolve) => {
      let resolved = false;
      
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          console.log('🔍 CHECKPOINT 5A: Video data loaded successfully');
          console.log('📹 Video data loaded successfully');
          resolve();
        }
      };
      
      // Listen for multiple events that indicate video is ready
      const videoElement = ensureVideoElement(); // Get element again for safety
      if (videoElement) {
        videoElement.addEventListener('loadeddata', resolveOnce, { once: true });
        videoElement.addEventListener('canplay', resolveOnce, { once: true });
        videoElement.addEventListener('playing', resolveOnce, { once: true });
      }
      
      // Timeout fallback with diagnostic info
      setTimeout(() => {
        if (!resolved) {
          console.log('🔍 CHECKPOINT 5B: Video loading timeout reached');
          console.warn('⚠️ Video loading timeout reached, checking current state...');
          if (videoElement) {
            console.log('📹 Current video state:', {
              readyState: videoElement.readyState,
              paused: videoElement.paused,
              srcObject: !!videoElement.srcObject,
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight
            });
          }
          resolveOnce();
        }
      }, 2000); // Increased timeout for better reliability
    });
    
    console.log('🔍 CHECKPOINT 6: Video loading complete, setting up stream metadata');

    currentStreamId = `${auth.currentUser.uid}-${Date.now()}`;
    console.log('🔍 CHECKPOINT 6A: Generated stream ID:', currentStreamId);
    
    // Get user display name (safe check to prevent ReferenceError)
    const userDoc = (typeof getUserDoc === 'function') ? await getUserDoc(auth.currentUser.uid) : null;
    const streamerName = userDoc?.displayName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || "Unknown Streamer";
    console.log('🔍 CHECKPOINT 6B: Resolved streamer name:', streamerName);

    // Create live stream record
    console.log('🔍 CHECKPOINT 7: Creating live stream record in Firestore');
    await setDoc(doc(db, "liveStreams", currentStreamId), {
      id: currentStreamId,
      streamerUid: auth.currentUser.uid,
      streamerName: streamerName,
      live: true,
      createdAt: serverTimestamp()
    }, { merge:true });
    console.log('🔍 CHECKPOINT 7A: Live stream record created successfully');
    
    // Update the live streamer display at the top
    console.log('🔍 CHECKPOINT 7B: Updating current streamer display');
    if (typeof updateCurrentStreamerDisplay === 'function') {
      updateCurrentStreamerDisplay(streamerName, auth.currentUser.uid);
    } else {
      console.warn('🔍 CHECKPOINT 7C: updateCurrentStreamerDisplay function not available');
    }

    // Signaling root
    console.log('🔍 CHECKPOINT 8: Creating signaling record');
    await setDoc(doc(db, "liveStreamSignals", currentStreamId), {
      from: auth.currentUser.uid,
      live: true,
      createdAt: serverTimestamp()
    }, { merge:true });
    console.log('🔍 CHECKPOINT 8A: Signaling record created successfully');

    console.log('🔍 CHECKPOINT 9: Setting up WebRTC connection');
    createPC();
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    console.log('🔍 CHECKPOINT 9A: Local tracks added to peer connection');

    const offer = await pc.createOffer({ offerToReceiveAudio:true, offerToReceiveVideo:true });
    await pc.setLocalDescription(offer);
    console.log('🔍 CHECKPOINT 9B: Local description set, sending offer');
    
    await safeSendSignal(doc(db, "liveStreamSignals", currentStreamId), {
      from: auth.currentUser.uid,
      offer: serializeOffer(offer)
    }, "offer");
    console.log('🔍 CHECKPOINT 9C: Offer sent successfully');

    const { answersRef, candRef } = makeChannelRefs(db, currentStreamId);

    // Viewer answers
    onSnapshot(answersRef, async (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const a = ch.doc.data()?.answer;
        if (!a?.type) continue;
        try { await pc.setRemoteDescription(new RTCSessionDescription(a)); }
        catch (e) { console.warn("Host setRemoteDescription(answer) skipped:", e?.message); }
      }
    });

    // Viewer ICE
    onSnapshot(candRef, async (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const c = ch.doc.data();
        if (c.role === "viewer") {
          try {
            await pc.addIceCandidate({
              candidate: c.candidate,
              sdpMid: c.sdpMid ?? null,
              sdpMLineIndex: (typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : null),
            });
          } catch (e) { console.warn("Host addIceCandidate(viewer) failed:", e?.message); }
        }
      }
    });

    console.log('🔍 CHECKPOINT 10: Setting up stream listeners');
    
    setStatus(`🔴 LIVE: ${streamerName}`);
    console.log('🔍 CHECKPOINT 10A: Status set to LIVE');
    
    // CRITICAL: Final cleanup and video display verification
    setTimeout(() => {
      console.log('🔍 CHECKPOINT 11: Final cleanup and verification (500ms delay)');
      console.log('🧹 Final comprehensive cleanup...');
      forceCleanupAllBackdrops();
      
      // Ensure video container is properly visible
      const liveBox = document.getElementById('live-box') || document.querySelector('.live-box');
      if (liveBox) {
        liveBox.style.background = 'transparent';
        liveBox.style.opacity = '1';
        liveBox.style.zIndex = '1999';
        liveBox.style.position = 'relative';
        console.log('🔍 CHECKPOINT 11A: Live box container styling applied');
      } else {
        console.warn('🔍 CHECKPOINT 11B: Live box container not found during final cleanup');
      }
      
      // Final video visibility check with maximum priority
      if (localVideo && localVideo.srcObject) {
        localVideo.style.display = 'block';
        localVideo.style.opacity = '1';
        localVideo.style.zIndex = '2000';
        localVideo.style.position = 'relative';
        console.log('🔍 CHECKPOINT 11C: Final video visibility check completed with z-index 2000');
        console.log('✅ Final video visibility check completed with z-index 2000');
      } else {
        console.warn('🔍 CHECKPOINT 11D: localVideo or srcObject not available during final check');
      }
      
      console.log('🔍 CHECKPOINT 11E: All final setup complete');
      console.log('✅ Stream started successfully! Video should now be fully visible with highest z-index.');
    }, 500);
    
    // Additional cleanup waves to catch any delayed modal artifacts
    setTimeout(() => {
      console.log('🔍 CHECKPOINT 12: Secondary cleanup wave (1000ms delay)');
      console.log('🧹 Secondary cleanup wave...');
      forceCleanupAllBackdrops();
    }, 1000);
    
    setTimeout(() => {
      console.log('🔍 CHECKPOINT 13: Tertiary cleanup wave (2000ms delay)');
      console.log('🧹 Tertiary cleanup wave...');
      forceCleanupAllBackdrops();
    }, 2000);
    
    // Show that this user is now live
    if (typeof window.showLiveNotification === 'function') {
      console.log('🔍 CHECKPOINT 14: Showing live notification');
      window.showLiveNotification(`${streamerName} is now live!`);
    } else {
      console.log('🔍 CHECKPOINT 14A: showLiveNotification function not available');
    }
    
    console.log('🔍 CHECKPOINT 15: startLiveStream function completed successfully');
    
    // CRITICAL: Set final active state when everything completes successfully
    streamStartState = 'active';
    console.log('🔍 Stream setup completed - State changed to: active');
    
  } catch (err) {
    console.error("🔍 CHECKPOINT ERROR: startLiveStream failed:", err);
    console.error("🔍 CHECKPOINT ERROR: Error details:", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name
    });
    console.error("startLiveStream failed:", err);
    
    // CRITICAL: Show custom error modal that matches app design
    if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
      showCustomErrorModal(
        "🚫 Camera Access Denied",
        "To enable live streaming, you need to allow camera access:",
        [
          "1. Look for the camera icon in your browser's address bar",
          "2. Click it and select 'Allow' for camera permissions", 
          "3. Refresh the page and try again"
        ]
      );
    } else {
      showCustomErrorModal(
        "❌ Live Streaming Failed",
        `${err?.message || 'Unknown error occurred'}`,
        ["Please check your camera and microphone connections and try again."]
      );
    }
    
    // Also update the status
    setStatus(`❌ Error: ${err?.message || 'Camera access denied'}`);
    
    // Reset state on error
    streamStartState = 'idle';
    
  } finally {
    // Always reset state to prevent deadlocks
    if (streamStartState !== 'active') {
      streamStartState = 'idle';
    }
    console.log('🔍 CHECKPOINT FINALLY: Final stream state:', streamStartState);
  }
}

export async function stopLiveStream() {
  try {
    if (pc) pc.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (currentStreamId) {
      try { await updateDoc(doc(db, "liveStreams", currentStreamId), { live:false }); } catch {}
      try { await updateDoc(doc(db, "liveStreamSignals", currentStreamId), { live:false }); } catch {}
    }
    
    // Hide the current streamer display
    hideCurrentStreamerDisplay();
    
  } finally {
    pc = null; localStream = null; setStatus("Stopped");
    isHost = false;
    currentStreamId = null;
    
    // CRITICAL: Reset stream state when stopping
    streamStartState = 'idle';
    console.log('🔍 Stream stopped - State reset to: idle');
  }
}

/* ================= VIEWER ================= */
export async function joinLiveStream(streamId) {
  if (!auth.currentUser) { 
    if (window.toast) {
      window.toast.error("🔐 Log in first to join streams");
    } else {
      console.error("Log in first to join streams");
    }
    return; 
  }
  try {
    isHost = false;
    currentStreamId = streamId;

    // Ensure host offer exists (simple race guard)
    let sig = (await getDoc(doc(db, "liveStreamSignals", streamId))).data();
    if (!sig?.offer) {
      setStatus("Waiting for host offer…");
      for (let i = 0; i < 10 && !sig?.offer; i++) {
        await sleep(400);
        sig = (await getDoc(doc(db, "liveStreamSignals", streamId))).data();
      }
      if (!sig?.offer) throw new Error("No offer found yet.");
    }

    createPC();
    await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));

    // Answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await safeSendSignal(collection(doc(db, "liveStreamSignals", streamId), "answers"), {
      from: auth.currentUser.uid,
      answer: serializeAnswer(answer)
    }, "answer");

    // Host ICE
    const { candRef } = makeChannelRefs(db, streamId);
    onSnapshot(candRef, async (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const c = ch.doc.data();
        if (c.role === "host") {
          try {
            await pc.addIceCandidate({
              candidate: c.candidate,
              sdpMid: c.sdpMid ?? null,
              sdpMLineIndex: (typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : null),
            });
          } catch (e) { console.warn("Viewer addIceCandidate(host) failed:", e?.message); }
        }
      }
    });

    setStatus(`Viewing: ${streamId}`);
  } catch (err) {
    console.error("joinLiveStream failed:", err);
    setStatus(`Error: ${err?.message || err}`);
  }
}

// Functions to update the live streamer display
function updateCurrentStreamerDisplay(streamerName, streamerUid) {
  const display = document.getElementById('currentStreamerDisplay');
  const nameElement = document.getElementById('currentStreamerName');
  
  if (display && nameElement) {
    nameElement.textContent = streamerName;
    display.style.display = 'block';
    
    // Store globally for profile viewing
    window.currentStreamerUid = streamerUid;
    window.currentStreamerName = streamerName;
    
    console.log('✅ Updated current streamer display:', streamerName);
  }
}

function hideCurrentStreamerDisplay() {
  const display = document.getElementById('currentStreamerDisplay');
  if (display) {
    display.style.display = 'none';
    window.currentStreamerUid = null;
    window.currentStreamerName = null;
    console.log('✅ Hidden current streamer display');
  }
}

// Check for active live streams on page load
export async function checkForActiveLiveStreams() {
  try {
    if (typeof collection === 'undefined' || typeof query === 'undefined') {
      console.warn('Firebase not available for live stream check');
      return;
    }
    
    const liveStreamsRef = collection(db, 'liveStreams');
    const liveQuery = query(liveStreamsRef, where('live', '==', true));
    
    onSnapshot(liveQuery, (snapshot) => {
      console.log('📡 Live streams check:', snapshot.size, 'active streams');
      
      if (snapshot.size > 0) {
        const activeLiveStream = snapshot.docs[0].data();
        updateCurrentStreamerDisplay(activeLiveStream.streamerName, activeLiveStream.streamerUid);
      } else {
        hideCurrentStreamerDisplay();
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking for live streams:', error);
  }
}

// Export all functions for global access
window.startLiveStream = startLiveStream;
window.stopLiveStream = stopLiveStream;
window.joinLiveStream = joinLiveStream;
window.checkForActiveLiveStreams = checkForActiveLiveStreams;

// Export additional streaming functions that might be called by HTML elements
window.startStream = startLiveStream;
window.stopStream = stopLiveStream;
window.joinStream = joinLiveStream;

// CRITICAL: Ensure single button binding to prevent double calls
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startStream');
  if (startBtn) {
    // Remove any existing onclick to prevent double binding
    startBtn.onclick = null;
    
    // Add single event listener
    startBtn.addEventListener('click', () => {
      console.log('🔴 Start stream button clicked - calling startLiveStream');
      startLiveStream();
    });
    
    console.log('✅ Single start stream button handler bound');
  }
});

// Export stream control functions
window.toggleAudio = function() {
  console.log('🔊 Toggle audio clicked');
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      console.log(`🔊 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
      return audioTrack.enabled;
    }
  }
  console.log('⚠️ No audio track available');
  return false;
};

window.toggleVideo = function() {
  console.log('📹 Toggle video clicked');
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      return videoTrack.enabled;
    }
  }
  console.log('⚠️ No video track available');
  return false;
};

window.shareScreen = async function() {
  console.log('🖥️ Share screen clicked');
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    if (pc && screenStream.getVideoTracks().length > 0) {
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
        console.log('✅ Screen sharing started');
      }
    }
  } catch (error) {
    console.error('❌ Screen sharing failed:', error);
  }
};

window.endCall = function() {
  console.log('📞 End call clicked');
  stopLiveStream();
};

window.sendLiveStreamMessage = function(message) {
  console.log('💬 Sending live stream message:', message);
  // This function handles live stream chat messages
  // For now, just log the message - can be extended to send to Firebase
  if (typeof window.showLiveNotification === 'function') {
    window.showLiveNotification('Message sent: ' + message);
  } else {
    console.log('📢 Live stream message:', message);
  }
  return true;
};

// CRITICAL FIX: Export badge functions globally so they can be called from anywhere
window.updateCurrentStreamerDisplay = updateCurrentStreamerDisplay;
window.hideCurrentStreamerDisplay = hideCurrentStreamerDisplay;

console.log('🎥 live-stream.js loaded with password protection and global exports');
