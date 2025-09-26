// public/js/firebase.js
// =====================================================
// Firebase bootstrap + helpers
// - ensureUserDoc() to guarantee users/{uid}
// - uploadUserPhoto(), setPrimaryPhoto()
// - saveProfileFields() (safe merge)
// - waitForAuth() promise wrapper
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  serverTimestamp, 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  onSnapshot, 
  addDoc, 
  increment, 
  arrayUnion, 
  arrayRemove, 
  getDocs,
  writeBatch,
  runTransaction 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ===== Config (live project) =====
const firebaseConfig = {
  apiKey: "AIzaSyDHqhU5fDxG-GW2hfUVrcHCCxBzPdHd5-M",
  authDomain: "unhinged-8c6da.firebaseapp.com",
  projectId: "unhinged-8c6da",
  storageBucket: "unhinged-8c6da.appspot.com", // fixed bucket
  messagingSenderId: "248472796860",
  appId: "1:248472796860:web:9d8d043e7fb051acf5dab9",
  measurementId: "G-6BC5YCV33Q",
};

// ===== Core singletons =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app, "gs://unhinged-8c6da.appspot.com"); // force correct bucket

// =====================================================
// Helpers
// =====================================================


// Resolve once with current user (or null)
function waitForAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || null);
    });
  });
}

// users/{uid} ref
function userRef(uid) {
  return doc(db, "users", uid);
}

// Read users/{uid} (null if missing)
async function getUserDoc(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

// Calculate hasPhotos flag based on actual photo data
function calculateHasPhotos(photoURL, photos) {
  // Check if photoURL is valid and not empty
  const hasValidPhotoURL = photoURL && 
                          photoURL.trim() && 
                          photoURL !== 'undefined' && 
                          photoURL !== 'null' &&
                          photoURL !== '';
  
  // Check if photos array has valid URLs
  const hasValidPhotos = Array.isArray(photos) && 
                        photos.length > 0 && 
                        photos.some(url => url && 
                                          url.trim() && 
                                          url !== 'undefined' && 
                                          url !== 'null' &&
                                          url !== '');
  
  return hasValidPhotoURL || hasValidPhotos;
}

// Fix hasPhotos flag for a user based on their actual photo data
async function fixUserHasPhotosFlag(uid) {
  if (!uid) {
    console.error('❌ fixUserHasPhotosFlag: No UID provided');
    return false;
  }
  
  try {
    const userDoc = await getUserDoc(uid);
    if (!userDoc) {
      console.warn('⚠️ User document not found for UID:', uid);
      return false;
    }
    
    const currentHasPhotos = userDoc.hasPhotos;
    const correctHasPhotos = calculateHasPhotos(userDoc.photoURL, userDoc.photos);
    
    // Only update if the flag is incorrect
    if (currentHasPhotos !== correctHasPhotos) {
      console.log(`🔧 Fixing hasPhotos flag for user ${uid}: ${currentHasPhotos} -> ${correctHasPhotos}`);
      console.log(`📷 User photo data: photoURL="${userDoc.photoURL}", photos=[${userDoc.photos?.length || 0} items]`);
      
      await setDoc(
        userRef(uid),
        { 
          hasPhotos: correctHasPhotos,
          updatedAt: serverTimestamp() 
        },
        { merge: true }
      );
      
      console.log('✅ hasPhotos flag fixed for user:', uid);
      return true;
    } else {
      console.log('✅ hasPhotos flag is already correct for user:', uid);
      return false;
    }
  } catch (error) {
    console.error('❌ Error fixing hasPhotos flag for user:', uid, error);
    return false;
  }
}

// Add a photo to user's photos array with hasPhotos synchronization
async function addUserPhoto(uid, photoUrl) {
  if (!uid || !photoUrl) {
    console.error('❌ addUserPhoto: Missing UID or photo URL');
    return false;
  }
  
  try {
    const userDoc = await getUserDoc(uid);
    if (!userDoc) {
      console.warn('⚠️ User document not found for UID:', uid);
      return false;
    }
    
    const photos = Array.isArray(userDoc.photos) ? [...userDoc.photos] : [];
    
    // Add photo if not already present
    if (!photos.includes(photoUrl)) {
      photos.push(photoUrl);
      
      // Calculate hasPhotos flag
      const hasPhotos = calculateHasPhotos(userDoc.photoURL, photos);
      
      await setDoc(
        userRef(uid),
        { 
          photos,
          hasPhotos,
          updatedAt: serverTimestamp() 
        },
        { merge: true }
      );
      
      console.log('✅ Photo added and hasPhotos flag updated for user:', uid);
      return true;
    } else {
      console.log('📷 Photo already exists in user\'s photos array');
      return false;
    }
  } catch (error) {
    console.error('❌ Error adding user photo:', error);
    return false;
  }
}

// Utility function for debugging photo rendering issues in matching
async function debugUserPhotoStatus(uid) {
  if (!uid) {
    console.error('❌ debugUserPhotoStatus: No UID provided');
    return null;
  }
  
  try {
    const userDoc = await getUserDoc(uid);
    if (!userDoc) {
      console.warn('⚠️ User document not found for UID:', uid);
      return null;
    }
    
    const photoURL = userDoc.photoURL;
    const photos = userDoc.photos;
    const hasPhotos = userDoc.hasPhotos;
    const calculatedHasPhotos = calculateHasPhotos(photoURL, photos);
    
    const status = {
      uid: uid,
      displayName: userDoc.displayName,
      photoURL: photoURL,
      photosArray: photos,
      photosCount: Array.isArray(photos) ? photos.length : 0,
      hasPhotos: hasPhotos,
      calculatedHasPhotos: calculatedHasPhotos,
      isConsistent: hasPhotos === calculatedHasPhotos,
      needsFix: hasPhotos !== calculatedHasPhotos,
      hasValidPhotos: calculatedHasPhotos
    };
    
    console.log('📊 User photo status debug:', status);
    return status;
  } catch (error) {
    console.error('❌ Error debugging user photo status:', error);
    return null;
  }
}

// =====================================================
// Global Photo Debug Utilities (for browser console access)
// =====================================================

// Make photo debugging functions globally accessible for easy debugging
window.PhotoDebug = {
  async checkUserPhotoStatus(uid) {
    return await debugUserPhotoStatus(uid);
  },
  
  async fixUserPhotoFlag(uid) {
    return await fixUserHasPhotosFlag(uid);
  },
  
  calculateHasPhotos(photoURL, photos) {
    return calculateHasPhotos(photoURL, photos);
  },
  
  async getCurrentUserPhotoStatus() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('❌ No authenticated user');
      return null;
    }
    return await debugUserPhotoStatus(currentUser.uid);
  },
  
  async fixCurrentUserPhotoFlag() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('❌ No authenticated user');
      return false;
    }
    return await fixUserHasPhotosFlag(currentUser.uid);
  }
};

console.log('🔧 Photo debugging utilities loaded. Use window.PhotoDebug in console for debugging.');
console.log('📊 Available commands: checkUserPhotoStatus(uid), fixUserPhotoFlag(uid), getCurrentUserPhotoStatus(), fixCurrentUserPhotoFlag()');

// Ensure users/{uid} exists
async function ensureUserDoc(user) {
  if (!user?.uid) return null;
  const uref = userRef(user.uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) {
    // Create a better default display name
    const defaultDisplayName = user.displayName || 
                              user.email?.split('@')[0] ||
                              `User${user.uid.substring(0, 8)}`;
    
    const photos = user.photoURL ? [user.photoURL] : [];
    const photoURL = user.photoURL || "";
    
    const seed = {
      uid: user.uid,
      email: user.email || "",
      displayName: defaultDisplayName,
      username: "",
      gender: "",
      hobbies: "",
      interests: "",
      photoURL: photoURL,
      photos: photos,
      hasPhotos: calculateHasPhotos(photoURL, photos), // CRITICAL FIX: Add hasPhotos synchronization
      bio: "",
      age: null,
      location: "",
      badges: [],
      flags: [],
      mood: "available", // Add default mood field
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // NOTE: Admin fields (membership, isAdmin, isModerator, adminSince) are NOT set
    // by client code - they must be managed server-side to maintain security
    await setDoc(uref, seed);
    return seed;
  }
  return snap.data();
}

// Convert HEIC files to JPEG format using heic2any library
async function convertHEICToJPEG(file) {
  try {
    // Load heic2any library dynamically from CDN if not already loaded
    if (typeof window.heic2any === 'undefined') {
      console.log('📦 Loading heic2any library from CDN...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load heic2any library'));
      });
      console.log('✅ heic2any library loaded successfully');
    }
    
    console.log('🔄 Converting HEIC to JPEG using heic2any...');
    
    // Convert HEIC to JPEG using heic2any
    const convertedBlob = await window.heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9
    });
    
    // Create new file with proper metadata
    const newFileName = file.name.replace(/\.heic$/i, '.jpg');
    const convertedFile = new File([convertedBlob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
    
    console.log('✅ HEIC conversion successful:', convertedFile.name, convertedFile.type);
    return convertedFile;
    
  } catch (error) {
    console.error('❌ HEIC conversion failed:', error);
    throw new Error(`Failed to convert HEIC to JPEG: ${error.message}`);
  }
}

// Compress image for mobile uploads
async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      const aspectRatio = width / height;
      
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          resolve(file); // Return original if compression fails
        }
      }, file.type, quality);
    };
    
    img.onerror = () => resolve(file); // Return original if image loading fails
    img.src = URL.createObjectURL(file);
  });
}

// Process file: convert HEIC and compress if needed
async function processImageFile(file) {
  let processedFile = file;
  
  // Convert HEIC to JPEG if needed
  if (file.name.toLowerCase().includes('.heic') || file.type.toLowerCase().includes('heic')) {
    console.log('📱 Converting HEIC to JPEG:', file.name);
    try {
      processedFile = await convertHEICToJPEG(file);
      console.log('✅ HEIC conversion successful');
    } catch (error) {
      console.warn('⚠️ HEIC conversion failed, trying upload as-is:', error.message);
    }
  }
  
  // Compress large images (especially for mobile)
  if (processedFile.size > 2 * 1024 * 1024) { // If larger than 2MB
    console.log('🗜️ Compressing large image:', processedFile.size, 'bytes');
    try {
      processedFile = await compressImage(processedFile);
      console.log('✅ Image compressed to:', processedFile.size, 'bytes');
    } catch (error) {
      console.warn('⚠️ Image compression failed:', error.message);
    }
  }
  
  return processedFile;
}

// Upload a photo to Storage and return its URL with user-specific path
async function uploadUserPhoto(uid, file, onProgress = null) {
  console.log('🚀 Starting photo upload for:', file.name, 'Size:', file.size, 'bytes');
  
  try {
    // Process the file (HEIC conversion, compression) with timeout
    const processedFile = await processImageFile(file);
    
    // Determine correct content type - CRITICAL FIX for mobile uploads
    const isHeic = /\.heic$/i.test(processedFile.name) || processedFile.type === 'image/heic' || processedFile.type === 'image/heif';
    let contentType = processedFile.type;
    
    // Fix content-type for mobile uploads that often come as application/octet-stream
    if (!contentType || contentType === 'application/octet-stream') {
      if (isHeic) {
        contentType = 'image/heic';
      } else if (processedFile.name.toLowerCase().includes('.jpg') || processedFile.name.toLowerCase().includes('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (processedFile.name.toLowerCase().includes('.png')) {
        contentType = 'image/png';
      } else if (processedFile.name.toLowerCase().includes('.webp')) {
        contentType = 'image/webp';
      } else {
        contentType = 'image/jpeg'; // Default fallback
      }
    }
    
    // Create proper filename extension
    const extension = contentType.includes('heic') ? 'heic' : 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2);
    const fileName = `${timestamp}-${randomId}.${extension}`;
    
    // Use guaranteed-allowed path: images/{uid}/profile/filename.ext
    const path = `images/${uid}/profile/${fileName}`;
    console.log('📤 Uploading to path:', path, 'Content-Type:', contentType);
    
    const ref = sRef(storage, path);
    
    // Set explicit metadata to avoid Firebase Storage rule rejections
    const metadata = {
      contentType: contentType,
      cacheControl: 'public,max-age=3600'
    };
    
    // Upload with robust error handling and timeout
    if (onProgress) {
      console.log('📊 Starting upload with progress monitoring...');
      const uploadTask = uploadBytesResumable(ref, processedFile, metadata);
      
      // Monitor upload progress with timeout protection
      const downloadURL = await new Promise((resolve, reject) => {
        let lastProgress = Date.now();
        const timeoutInterval = setInterval(() => {
          // Timeout if no progress for 30 seconds
          if (Date.now() - lastProgress > 30000) {
            uploadTask.cancel();
            clearInterval(timeoutInterval);
            reject(new Error('Upload timeout - no progress for 30 seconds'));
          }
        }, 5000);
        
        uploadTask.on('state_changed', 
          (snapshot) => {
            lastProgress = Date.now();
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
            console.log('📊 Upload progress:', Math.round(progress) + '%');
          },
          (error) => {
            clearInterval(timeoutInterval);
            console.error('❌ Upload error:', error);
            reject(error);
          },
          async () => {
            clearInterval(timeoutInterval);
            console.log('✅ Upload completed successfully');
            try {
              const downloadURL = await getDownloadURL(ref);
              resolve(downloadURL);
            } catch (error) {
              reject(new Error('Failed to get download URL: ' + error.message));
            }
          }
        );
      });
      
      console.log('✅ Upload complete, URL:', downloadURL.slice(0, 50) + '...');
      return downloadURL;
      
    } else {
      // Fallback to regular upload without progress
      console.log('📤 Starting simple upload...');
      await uploadBytes(ref, processedFile, metadata);
      const downloadURL = await getDownloadURL(ref);
      console.log('✅ Upload complete, URL:', downloadURL.slice(0, 50) + '...');
      return downloadURL;
    }
    
  } catch (error) {
    console.error('❌ Photo upload failed:', error);
    throw new Error(`Photo upload failed: ${error.message}`);
  }
}

// Make a photo the primary (Auth + Firestore)
async function setPrimaryPhoto(uid, photoUrl, currentDoc, currentUser) {
  try {
    if (currentUser) await updateProfile(currentUser, { photoURL: photoUrl });
  } catch (_) {
    /* non-fatal */
  }

  const photos = Array.isArray(currentDoc?.photos) ? [...currentDoc.photos] : [];
  const idx = photos.indexOf(photoUrl);
  if (idx > 0) {
    photos.splice(idx, 1);
    photos.unshift(photoUrl);
  } else if (idx < 0) {
    photos.unshift(photoUrl);
  }

  // CRITICAL FIX: Calculate and update hasPhotos flag based on actual photo data
  const hasPhotos = calculateHasPhotos(photoUrl, photos);

  await setDoc(
    userRef(uid),
    { 
      photoURL: photoUrl, 
      photos, 
      hasPhotos, // CRITICAL FIX: Synchronize hasPhotos flag
      updatedAt: serverTimestamp() 
    },
    { merge: true }
  );

  console.log('✅ Updated user photos and hasPhotos flag:', { photoURL: photoUrl?.substring(0, 50) + '...', photosCount: photos.length, hasPhotos });

  return { photoURL: photoUrl, photos, hasPhotos };
}

// Upsert editable profile fields (safe merge) - only save defined values
async function saveProfileFields(uid, fields) {
  const safe = {
    updatedAt: serverTimestamp(),
  };
  
  // Only add fields that have actual values - never write nulls
  if (fields.displayName && fields.displayName.trim()) safe.displayName = fields.displayName.trim();
  if (fields.username && fields.username.trim()) safe.username = fields.username.trim();
  if (fields.gender && fields.gender.trim()) safe.gender = fields.gender.trim();
  if (fields.hobbies && fields.hobbies.trim()) safe.hobbies = fields.hobbies.trim();
  if (fields.interests && fields.interests.trim()) safe.interests = fields.interests.trim();
  if (fields.bio && fields.bio.trim()) safe.bio = fields.bio.trim();
  if (fields.location && fields.location.trim()) safe.location = fields.location.trim();
  if (typeof fields.age === "number" && fields.age > 0) safe.age = fields.age;
  
  await setDoc(userRef(uid), safe, { merge: true });
  
  // Update daily missions progress for profile completion
  if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
    // Check if profile is getting more complete
    const completionFields = ['displayName', 'bio', 'age', 'location', 'interests'];
    const completedFields = completionFields.filter(field => safe[field] && safe[field] !== null && safe[field] !== '').length;
    
    if (completedFields >= 3) { // If user has completed at least 3 major profile fields
      await window.DailyMissionsAPI.updateProgress('profile_completed', 1, {
        completedFields,
        updatedFields: Object.keys(safe).filter(key => safe[key] !== null)
      });
    }
  }
  
  return true;
}

// =====================================================
// Profile Deletion Functions
// =====================================================

// Delete user profile and account completely
async function deleteUserProfile() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user to delete');
  }

  try {
    console.log('🗑️ Starting profile deletion for user:', user.uid);
    
    // Step 1: Delete user document from Firestore
    console.log('🗑️ Deleting user document from Firestore...');
    await deleteDoc(userRef(user.uid));
    
    // Step 2: Delete user account from Firebase Auth
    console.log('🗑️ Deleting user account from Firebase Auth...');
    await user.delete();
    
    console.log('✅ Profile deletion completed successfully');
    
    // Step 3: Redirect to goodbye page or home
    window.location.href = '/signup.html?deleted=true';
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting profile:', error);
    
    // Handle specific error cases
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('For security, please log out and log back in before deleting your account.');
    }
    
    throw new Error(`Failed to delete profile: ${error.message}`);
  }
}

// Confirm and delete user profile with custom modal (NO BROWSER ALERTS)
async function confirmDeleteProfile() {
  const user = auth.currentUser;
  if (!user) {
    showCustomModal('❌ Error', 'No user logged in', 'error');
    return false;
  }

  try {
    // Step 1: Show deletion confirmation modal
    const confirmed = await showDeleteConfirmationModal();
    if (!confirmed) {
      console.log('🚫 Profile deletion cancelled by user');
      return false;
    }

    // Step 2: Proceed with deletion
    console.log('🗑️ User confirmed - proceeding with profile deletion');
    await deleteUserProfile();
    return true;
    
  } catch (error) {
    console.error('❌ Profile deletion error:', error);
    showCustomModal('❌ Deletion Failed', error.message, 'error');
    return false;
  }
}

// Custom deletion confirmation modal (matches app design)
function showDeleteConfirmationModal() {
  return new Promise((resolve) => {
    // Create modal HTML
    const modalHTML = `
      <div id="deleteConfirmModal" class="custom-modal-overlay">
        <div class="custom-modal-content deletion-modal">
          <div class="modal-header">
            <h2>⚠️ Delete Account</h2>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p><strong>🚨 PERMANENTLY DELETE YOUR ACCOUNT?</strong></p>
            <div class="deletion-warning">
              <p>This will:</p>
              <ul>
                <li>• Delete your profile and all data</li>
                <li>• Remove all your photos</li>
                <li>• Remove all your messages</li>
                <li>• <strong>CANNOT BE UNDONE</strong></li>
              </ul>
            </div>
            <div class="confirmation-input">
              <label>Type <strong>"DELETE"</strong> to confirm:</label>
              <input type="text" id="deleteConfirmInput" placeholder="Type DELETE here" autocomplete="off">
              <div id="deleteInputError" class="error-text"></div>
            </div>
          </div>
          <div class="modal-actions">
            <button id="cancelDeleteBtn" class="btn-secondary">Cancel</button>
            <button id="confirmDeleteBtn" class="btn-danger" disabled>Delete Account</button>
          </div>
        </div>
      </div>
    `;

    // Add to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('deleteConfirmModal');
    const input = document.getElementById('deleteConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const closeBtn = modal.querySelector('.modal-close');
    const errorDiv = document.getElementById('deleteInputError');

    // Enable/disable confirm button based on input
    input.addEventListener('input', () => {
      const isValid = input.value.trim() === 'DELETE';
      confirmBtn.disabled = !isValid;
      errorDiv.textContent = '';
    });

    // Handle confirm
    confirmBtn.addEventListener('click', () => {
      if (input.value.trim() !== 'DELETE') {
        errorDiv.textContent = 'Please type "DELETE" exactly as shown';
        return;
      }
      
      // Final confirmation step
      showFinalDeletionWarning().then((finalConfirm) => {
        modal.remove();
        resolve(finalConfirm);
      });
    });

    // Handle cancel/close
    const cancelFn = () => {
      modal.remove();
      resolve(false);
    };
    cancelBtn.addEventListener('click', cancelFn);
    closeBtn.addEventListener('click', cancelFn);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cancelFn();
    });

    // Focus input
    setTimeout(() => input.focus(), 100);
  });
}

// Final deletion warning modal
function showFinalDeletionWarning() {
  return new Promise((resolve) => {
    const modalHTML = `
      <div id="finalDeleteWarning" class="custom-modal-overlay">
        <div class="custom-modal-content warning-modal">
          <div class="modal-header">
            <h2>🚨 FINAL WARNING</h2>
          </div>
          <div class="modal-body">
            <p><strong>This will PERMANENTLY delete your account and ALL data.</strong></p>
            <p>Are you absolutely sure?</p>
          </div>
          <div class="modal-actions">
            <button id="finalCancelBtn" class="btn-secondary">No, Cancel</button>
            <button id="finalConfirmBtn" class="btn-danger">Yes, Delete Forever</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('finalDeleteWarning');
    const confirmBtn = document.getElementById('finalConfirmBtn');
    const cancelBtn = document.getElementById('finalCancelBtn');

    confirmBtn.addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
  });
}

// Generic custom modal for messages (matches app design)
function showCustomModal(title, message, type = 'info') {
  const modalHTML = `
    <div id="customMessageModal" class="custom-modal-overlay">
      <div class="custom-modal-content message-modal ${type}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-actions">
          <button id="modalOkBtn" class="btn-primary">OK</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modal = document.getElementById('customMessageModal');
  const okBtn = document.getElementById('modalOkBtn');
  const closeBtn = modal.querySelector('.modal-close');

  const closeFn = () => modal.remove();
  okBtn.addEventListener('click', closeFn);
  closeBtn.addEventListener('click', closeFn);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFn();
  });
}

// =====================================================
// Admin Functions
// =====================================================

// SECURITY: Check if current user is admin (you are the only admin)
async function isCurrentUserAdmin() {
  const user = auth.currentUser;
  if (!user) {
    console.log('🔐 Admin check: No authenticated user');
    return false;
  }
  
  try {
    // SECURITY: First check if user document has admin flag
    const userDoc = await getUserDoc(user.uid);
    if (userDoc && userDoc.isAdmin === true) {
      console.log('🔐 Admin check: SUCCESS - User has admin flag');
      return true;
    }
    
    // FALLBACK: Check if this is the known admin UID (you)
    // This ensures you maintain admin access even if the flag isn't set
    const KNOWN_ADMIN_UID = '3rOEe2tzu6cahiDBgmck7WIZ2nS2';
    if (user.uid === KNOWN_ADMIN_UID) {
      console.log('🔐 Admin check: SUCCESS - Known admin UID');
      
      // Set the admin flag in the user document for future use
      if (userDoc) {
        try {
          await setDoc(userRef(user.uid), { 
            isAdmin: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
          console.log('🔐 Admin flag set for future use');
        } catch (error) {
          console.log('🔐 Could not set admin flag:', error.message);
        }
      }
      
      return true;
    }
    
    console.log('🔐 Admin check: User is not admin');
    return false;
  } catch (error) {
    console.error('🔐 Admin check error:', error);
    return false;
  }
}

// Clear all messages from a specific district chat
async function clearDistrictChat(district) {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    // Clear regular district messages
    const messagesRef = collection(db, `districts_chats`, district, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    // Delete messages individually to work with security rules
    const messageDeletePromises = messagesSnapshot.docs.map(async (doc) => {
      return deleteDoc(doc.ref);
    });

    // Clear district confessions
    const confessionsRef = collection(db, `districts_confessions`, district, 'confessions');
    const confessionsSnapshot = await getDocs(confessionsRef);
    
    // Delete confessions individually to work with security rules
    const confessionDeletePromises = confessionsSnapshot.docs.map(async (doc) => {
      return deleteDoc(doc.ref);
    });

    // Execute all deletions in parallel
    await Promise.all([...messageDeletePromises, ...confessionDeletePromises]);
    console.log(`✅ District ${district} chat cleared successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing district ${district} chat:`, error);
    throw error;
  }
}

// Clear all messages from world feed
async function clearWorldFeed() {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    // Get all world feed posts
    const postsRef = collection(db, 'world_feed');
    const postsSnapshot = await getDocs(postsRef);
    
    const allDeletePromises = [];
    
    // Delete each post and its comments
    for (const postDoc of postsSnapshot.docs) {
      // Delete comments first
      const commentsRef = collection(postDoc.ref, 'comments');
      const commentsSnapshot = await getDocs(commentsRef);
      commentsSnapshot.docs.forEach(commentDoc => {
        allDeletePromises.push(deleteDoc(commentDoc.ref));
      });
      
      // Delete reactions
      const reactionsRef = collection(postDoc.ref, 'reactions');
      const reactionsSnapshot = await getDocs(reactionsRef);
      reactionsSnapshot.docs.forEach(reactionDoc => {
        allDeletePromises.push(deleteDoc(reactionDoc.ref));
      });
      
      // Delete the post itself
      allDeletePromises.push(deleteDoc(postDoc.ref));
    }

    // Execute all deletions in parallel
    await Promise.all(allDeletePromises);
    console.log('✅ World feed cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing world feed:', error);
    throw error;
  }
}

// Clear all messages from lounge chat
async function clearLoungeChat() {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    // Clear global lounge messages
    const loungeMessagesRef = collection(db, 'lounge_messages');
    const loungeSnapshot = await getDocs(loungeMessagesRef);
    
    // Delete messages individually to work with security rules
    const deletePromises = loungeSnapshot.docs.map(async (doc) => {
      return deleteDoc(doc.ref);
    });

    await Promise.all(deletePromises);
    console.log('✅ Lounge chat cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing lounge chat:', error);
    throw error;
  }
}

// Clear chat for a specific live event
async function clearEventChat(eventId) {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    const chatRef = collection(db, 'stages_events', eventId, 'chat');
    const chatSnapshot = await getDocs(chatRef);
    
    const batch = writeBatch(db);
    chatSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Event ${eventId} chat cleared successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing event ${eventId} chat:`, error);
    throw error;
  }
}

// Clear all room chats
async function clearRoomChat(roomId) {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    // Delete messages individually to work with security rules
    const deletePromises = messagesSnapshot.docs.map(async (doc) => {
      return deleteDoc(doc.ref);
    });

    await Promise.all(deletePromises);
    console.log(`✅ Room ${roomId} chat cleared successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing room ${roomId} chat:`, error);
    throw error;
  }
}

// Clear individual table chat in lounge
async function clearTableChat(tableId) {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    const messagesRef = collection(db, 'table_chats', tableId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    // Delete messages individually to work with security rules
    const deletePromises = messagesSnapshot.docs.map(async (doc) => {
      return deleteDoc(doc.ref);
    });

    await Promise.all(deletePromises);
    console.log(`✅ Table ${tableId} chat cleared successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing table ${tableId} chat:`, error);
    throw error;
  }
}

// Clear all live stream chats
async function clearLiveStreamChat() {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    // Clear live stream messages from all potential live stream collections
    const liveStreamCollections = ['live_stream_chat', 'streaming_messages', 'live_chats'];
    const deletePromises = [];

    for (const collectionName of liveStreamCollections) {
      try {
        const streamMessagesRef = collection(db, collectionName);
        const streamSnapshot = await getDocs(streamMessagesRef);
        
        streamSnapshot.docs.forEach(doc => {
          deletePromises.push(deleteDoc(doc.ref));
        });
      } catch (error) {
        // Collection might not exist, continue with others
        console.log(`Collection ${collectionName} might not exist, skipping...`);
      }
    }

    await Promise.all(deletePromises);
    console.log('✅ Live stream chats cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing live stream chats:', error);
    throw error;
  }
}

// Clear all stages chat (all events)
async function clearAllStagesChat() {
  if (!await isCurrentUserAdmin()) {
    throw new Error('Unauthorized: Admin access required');
  }

  try {
    // Get all stage events
    const eventsRef = collection(db, 'stages_events');
    const eventsSnapshot = await getDocs(eventsRef);
    
    const deletePromises = [];
    
    // Clear chat for each event
    for (const eventDoc of eventsSnapshot.docs) {
      const chatRef = collection(eventDoc.ref, 'chat');
      const chatSnapshot = await getDocs(chatRef);
      
      chatSnapshot.docs.forEach(chatDoc => {
        deletePromises.push(deleteDoc(chatDoc.ref));
      });
      
      // Also clear reactions for each event
      const reactionsRef = collection(eventDoc.ref, 'reactions');
      const reactionsSnapshot = await getDocs(reactionsRef);
      
      reactionsSnapshot.docs.forEach(reactionDoc => {
        deletePromises.push(deleteDoc(reactionDoc.ref));
      });
    }

    await Promise.all(deletePromises);
    console.log('✅ All stages chat cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing all stages chat:', error);
    throw error;
  }
}

// Get all available districts for clearing
async function getAvailableDistricts() {
  return ['dating', 'memes', 'confessions', 'debates', 'toxic'];
}

// Function to temporarily clear profile completion for testing
async function clearProfileCompletion(uid) {
  try {
    await setDoc(
      userRef(uid),
      { 
        location: null,  // Clear location to make profile incomplete
        updatedAt: serverTimestamp() 
      },
      { merge: true }
    );
    console.log('🔧 Profile completion cleared for testing - location removed');
    return true;
  } catch (error) {
    console.error('❌ Error clearing profile completion:', error);
    return false;
  }
}

// Global function for testing profile gate (available in console)
window.testProfileGate = async function() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }
    
    console.log('🔧 Clearing profile completion for testing...');
    await clearProfileCompletion(user.uid);
    console.log('✅ Profile cleared! Refresh the page to test the profile gate flow.');
    console.log('💡 Your location has been removed, so you\'ll need to complete your profile again.');
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// =====================================================
// Exports
// =====================================================
export {
  // Core
  app,
  auth,
  db,
  storage,
  // Firebase primitives
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  addDoc,
  increment,
  arrayUnion,
  arrayRemove,
  getDocs,
  writeBatch,
  runTransaction,
  sRef,
  uploadBytes,
  getDownloadURL,
  onAuthStateChanged,
  updateProfile,
  signOut,
  // App helpers
  waitForAuth,
  userRef,
  getUserDoc,
  ensureUserDoc,
  uploadUserPhoto,
  setPrimaryPhoto,
  saveProfileFields,
  // Photo utilities
  calculateHasPhotos,
  fixUserHasPhotosFlag,
  addUserPhoto,
  debugUserPhotoStatus,
  // Profile deletion functions
  deleteUserProfile,
  confirmDeleteProfile,
  // Admin functions
  isCurrentUserAdmin,
  clearDistrictChat,
  clearWorldFeed,
  clearLoungeChat,
  clearEventChat,
  clearRoomChat,
  clearTableChat,
  clearLiveStreamChat,
  clearAllStagesChat,
  getAvailableDistricts,
  clearProfileCompletion,
};
