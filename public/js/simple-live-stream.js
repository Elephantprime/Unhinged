// Simple, working live stream functionality
let localStream = null;
let isStreaming = false;

// Simple password validation
async function validatePassword() {
  return new Promise((resolve) => {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="background: #1a1d29; padding: 30px; border-radius: 12px; text-align: center;">
        <h3 style="color: white; margin-bottom: 20px;">Enter Go Live Password</h3>
        <input type="password" id="livePassword" style="padding: 10px; margin-bottom: 20px; border-radius: 6px; border: 1px solid #ccc;">
        <br>
        <button id="confirmLive" style="padding: 10px 20px; background: #e11d2a; color: white; border: none; border-radius: 6px; margin-right: 10px;">Go Live</button>
        <button id="cancelLive" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 6px;">Cancel</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const passwordInput = modal.querySelector('#livePassword');
    const confirmBtn = modal.querySelector('#confirmLive');
    const cancelBtn = modal.querySelector('#cancelLive');
    
    confirmBtn.onclick = () => {
      if (passwordInput.value === 'unhinged2024') {
        document.body.removeChild(modal);
        resolve(true);
      } else {
        alert('Incorrect password');
      }
    };
    
    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
    
    passwordInput.focus();
    passwordInput.onkeyup = (e) => {
      if (e.key === 'Enter') confirmBtn.click();
    };
  });
}

// Simple camera setup
async function setupCamera() {
  try {
    console.log('📹 Getting camera access...');
    
    // Get camera stream
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 1280, height: 720 }, 
      audio: true 
    });
    
    console.log('✅ Camera stream obtained');
    
    // Get video element
    const video = document.getElementById('localVideo');
    if (!video) {
      throw new Error('Video element not found');
    }
    
    // Set up video
    video.srcObject = localStream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    
    // Force visibility
    video.style.display = 'block';
    video.style.opacity = '1';
    video.style.visibility = 'visible';
    
    // Play video
    await video.play();
    
    // Make container visible
    const liveBox = document.getElementById('live-box');
    if (liveBox) {
      liveBox.style.background = 'transparent';
      liveBox.style.opacity = '1';
      liveBox.style.visibility = 'visible';
      liveBox.style.display = 'flex';
    }
    
    console.log('✅ Camera setup complete!');
    return true;
    
  } catch (error) {
    console.error('❌ Camera setup failed:', error);
    alert('Camera access failed: ' + error.message);
    return false;
  }
}

// Main start function
window.startLiveStreamSimple = async function() {
  console.log('🚀 Starting live stream...');
  
  if (isStreaming) {
    console.log('Already streaming');
    return;
  }
  
  try {
    // Validate password
    const passwordOk = await validatePassword();
    if (!passwordOk) {
      console.log('Password validation cancelled');
      return;
    }
    
    // Setup camera
    const cameraOk = await setupCamera();
    if (!cameraOk) {
      return;
    }
    
    isStreaming = true;
    console.log('🎉 Live streaming started successfully!');
    
    // Show success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #4ade80; color: black;
      padding: 15px 25px; border-radius: 8px; z-index: 10000; font-weight: bold;
    `;
    notification.innerHTML = '✅ 🔴 Live streaming started!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 3000);
    
  } catch (error) {
    console.error('❌ Live stream failed:', error);
    alert('Live streaming failed: ' + error.message);
  }
};

// Stop function
window.stopLiveStreamSimple = function() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  const video = document.getElementById('localVideo');
  if (video) {
    video.srcObject = null;
  }
  
  isStreaming = false;
  console.log('🛑 Live streaming stopped');
};

// Redirect old function calls to the new working function
window.startLiveStreamWithPassword = window.startLiveStreamSimple;
window.startLiveStream = window.startLiveStreamSimple;
window.stopLiveStream = window.stopLiveStreamSimple;

console.log('📺 Simple live stream loaded and connected to UI buttons.');
