// Wire Clean Matching Buttons - User's Implementation
// This script wires the ❌❤️♻️ buttons to use the clean matching functions

import { auth } from './firebase.js';
import { likeUser, dislikeUser, recycleAll } from './clean-matching.js';

// Get current profile function (this might need to be adapted based on how profiles are stored)
function getCurrentProfile() {
  // Try to get current profile from the DOM or global variables
  if (window.currentProfile) {
    return window.currentProfile;
  }
  
  // Fallback: try to get from main photo element
  const mainPhoto = document.getElementById('candidate-photo');
  if (mainPhoto && mainPhoto.userData) {
    return mainPhoto.userData;
  }
  
  // Another fallback: construct from DOM elements
  const nameEl = document.getElementById('name');
  const handleEl = document.getElementById('handle');
  if (nameEl && nameEl.textContent) {
    return {
      displayName: nameEl.textContent,
      uid: handleEl ? handleEl.textContent.replace('(', '').replace(')', '') : null
    };
  }
  
  return null;
}

// Wire up the clean matching buttons
export function wireCleanMatchingButtons() {
  console.log('🔧 Wiring clean matching buttons...');
  
  // ❌ X button → calls window.passAction (single source of truth)
  const passBtn = document.getElementById('pass-btn');
  if (passBtn) {
    passBtn.addEventListener('click', async function() {
      console.log('❌ X/Dislike button clicked - calling window.passAction');
      if (typeof window.passAction === 'function') {
        await window.passAction();
      } else {
        console.error('❌ window.passAction not available');
      }
    });
    console.log('✅ Pass/X button wired');
  }

  // ❤️ Heart button → calls window.likeAction (single source of truth)
  const likeBtn = document.getElementById('like-btn');
  if (likeBtn) {
    likeBtn.addEventListener('click', async function() {
      console.log('❤️ Heart/Like button clicked - calling window.likeAction');
      if (typeof window.likeAction === 'function') {
        await window.likeAction();
      } else {
        console.error('❌ window.likeAction not available');
      }
    });
    console.log('✅ Like/Heart button wired');
  }

  // ♻️ Recycle button → calls window.recycleAction (single source of truth)
  const recycleBtn = document.getElementById('recycle-btn');
  if (recycleBtn) {
    recycleBtn.addEventListener('click', async function() {
      console.log('♻️ Recycle button clicked - calling window.recycleAction');
      if (typeof window.recycleAction === 'function') {
        await window.recycleAction();
      } else {
        console.error('❌ window.recycleAction not available');
      }
    });
    console.log('✅ Recycle button wired');
  }
  
  console.log('🔧 Clean matching buttons wired successfully');
}

// Auto-wire when auth is ready
document.addEventListener('DOMContentLoaded', function() {
  if (auth.currentUser) {
    wireCleanMatchingButtons();
  } else {
    // Wait for auth
    auth.onAuthStateChanged((user) => {
      if (user) {
        wireCleanMatchingButtons();
      }
    });
  }
});
