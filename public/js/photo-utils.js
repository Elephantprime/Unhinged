/**
 * Photo Utils - DISABLED: All photo loading is temporarily disabled 
 * Photos are under construction and will be restored soon
 */

/**
 * CRITICAL: Kill all global avatar overlays that render above the main image
 */
function killGlobalAvatarOverlays() {
  // Remove global overlay elements
  const overlaySelectors = [
    '.user-avatar', '.avatar-overlay', '[data-avatar-overlay]', 
    '.generated-avatar', '.profile-avatar', '[class*="avatar"]'
  ];
  
  overlaySelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.closest('.card-frame')) { // Don't remove elements inside card frame
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.backgroundImage = 'none';
      }
    });
  });
  
  // Clear any elements with inline avatar background
  document.querySelectorAll('[style*="background"]').forEach(el => {
    const bgImg = getComputedStyle(el).backgroundImage;
    if (bgImg && bgImg.includes('firebase') && !el.closest('.card-frame')) {
      el.style.backgroundImage = 'none';
    }
  });
  
  console.log('💀 Killed global avatar overlays');
}

/**
 * Clear image cache immediately and synchronously
 * @param {HTMLImageElement} imgElement - Image element to clear
 */
function clearImageCacheImmediate(imgElement) {
  if (!imgElement) return;
  
  // Clear all existing handlers and attributes immediately
  imgElement.onerror = null;
  imgElement.onload = null;
  
  // Force complete cache invalidation by clearing src multiple ways
  imgElement.src = '';
  imgElement.removeAttribute('src');
  
  // Reset all cached data attributes
  imgElement.removeAttribute('data-cached-src');
  imgElement.removeAttribute('data-last-loaded');
  imgElement.removeAttribute('data-photo-initialized');
  
  // Clear any background image styles that might be cached
  if (imgElement.style.backgroundImage) {
    imgElement.style.backgroundImage = '';
  }
  
  console.log('🧹 Image cache cleared immediately');
}

/**
 * Clear image cache and reset element to prevent contamination (async version)
 * @param {HTMLImageElement} imgElement - Image element to clear
 */
function clearImageCache(imgElement) {
  if (!imgElement) return;
  
  // Force complete cache invalidation with immediate techniques
  const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  
  // Store current properties
  const currentAlt = imgElement.alt;
  const currentClass = imgElement.className;
  const currentStyle = imgElement.style.cssText;
  
  // Force cache clearing by setting to empty then placeholder
  imgElement.src = '';
  imgElement.removeAttribute('src');
  
  // Reset all cached data
  imgElement.removeAttribute('data-cached-src');
  imgElement.removeAttribute('data-last-loaded');
  imgElement.removeAttribute('data-photo-initialized');
  
  // Force browser to clear internal cache by modifying the element
  const originalDisplay = imgElement.style.display;
  imgElement.style.display = 'none';
  
  // Use requestAnimationFrame to ensure DOM update, then restore
  requestAnimationFrame(() => {
    imgElement.style.display = originalDisplay;
    imgElement.src = placeholder;
    
    // Restore properties
    imgElement.alt = currentAlt;
    imgElement.className = currentClass;
    if (currentStyle) imgElement.style.cssText = currentStyle;
  });
  
  console.log('🧹 Image cache cleared and reset for fresh loading');
}

/**
 * Add cache-busting parameters to image URLs
 * @param {string} url - Original image URL
 * @returns {string} URL with cache-busting parameters
 */
function addCacheBusting(url) {
  if (!url || typeof url !== 'string') return url;
  
  // Don't add cache-busting to data URLs or already cache-busted URLs
  if (url.startsWith('data:') || url.includes('_cb=') || url.includes('?t=')) {
    return url;
  }
  
  // Generate cache-busting parameter
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const cacheBuster = `_cb=${timestamp}_${random}`;
  
  // Add cache-busting parameter
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${cacheBuster}`;
}

// Make addCacheBusting globally accessible
window.addCacheBusting = addCacheBusting;

// Reliable local fallback avatars using data URIs
const PHOTO_FALLBACKS = {
  // Default profile placeholder (dark theme)
  profile: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1200'>
      <rect width='100%' height='100%' fill='#0b0b0f'/>
      <circle cx='400' cy='420' r='160' fill='#20222b'/>
      <rect x='210' y='650' width='380' height='260' rx='28' fill='#20222b'/>
      <text x='400' y='1080' text-anchor='middle' fill='#666' font-family='Arial' font-size='48'>Profile Photo</text>
    </svg>
  `),
  
  // Square avatar for chat/lists (80x80)
  avatar: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
      <rect width='100%' height='100%' fill='#1a1b22'/>
      <circle cx='40' cy='30' r='16' fill='#2a2a2a'/>
      <path d='M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z' fill='#2a2a2a'/>
    </svg>
  `),
  
  // Small thumbnail (50x50)
  thumbnail: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'>
      <rect width='100%' height='100%' fill='#1a1b22'/>
      <circle cx='25' cy='20' r='10' fill='#2a2a2a'/>
      <path d='M 10 40 Q 10 32 15 30 Q 20 25 25 25 Q 30 25 35 30 Q 40 32 40 40 L 40 50 L 10 50 Z' fill='#2a2a2a'/>
    </svg>
  `),
  
  // Error state (red-tinted)
  error: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
      <rect width='100%' height='100%' fill='#2a1a1a'/>
      <circle cx='40' cy='40' r='24' fill='none' stroke='#E11D2A' stroke-width='2'/>
      <path d='M 28 28 L 52 52 M 52 28 L 28 52' stroke='#E11D2A' stroke-width='2'/>
      <text x='40' y='68' text-anchor='middle' fill='#E11D2A' font-family='Arial' font-size='10'>Failed to load</text>
    </svg>
  `)
};

/**
 * Simple image loading function (replaces complex cache-busting and overlay logic)
 * @param {HTMLImageElement} imgElement - The image element to set
 * @param {string|null} photoUrl - The photo URL to load
 * @param {Function} onLoad - Optional callback when image loads successfully
 * @param {Function} onError - Optional callback when image fails to load
 */
function loadSimpleImage(imgElement, photoUrl, onLoad = null, onError = null) {
  if (!imgElement) {
    console.error('❌ loadSimpleImage: No image element provided');
    return;
  }

  // Only load legitimate profile photos
  if (!photoUrl || !isLegitimateProfilePhoto(photoUrl)) {
    console.log('🚫 Invalid or non-legitimate photo URL, hiding image');
    imgElement.style.display = 'none';
    return;
  }

  console.log('📷 Loading legitimate photo:', photoUrl.substring(0, 60) + '...');

  // Simple error handler
  imgElement.onerror = function() {
    console.log(`⚠️ Image failed to load: ${photoUrl.substring(0, 50)}..., hiding image`);
    this.style.display = 'none';
    if (onError) onError(this);
  };

  // Simple success handler
  imgElement.onload = function() {
    console.log(`✅ Image loaded successfully: ${this.src.substring(0, 50)}...`);
    this.style.display = 'block';
    this.style.visibility = 'visible';
    if (onLoad) onLoad(this);
  };

  // Simple direct loading without complex cache-busting
  imgElement.src = photoUrl;
}

/**
 * Legacy function for backwards compatibility - now uses simple logic
 * @param {HTMLImageElement} imgElement - The image element to set
 * @param {string|null} photoUrl - The primary photo URL to load
 * @param {string} fallbackType - Type of fallback (ignored in simple version)
 * @param {Function} onLoad - Optional callback when image loads successfully
 * @param {Function} onError - Optional callback when image fails to load
 */
function loadImageWithFallback(imgElement, photoUrl, fallbackType = 'avatar', onLoad = null, onError = null) {
  // Use the simple image loading function
  loadSimpleImage(imgElement, photoUrl, onLoad, onError);
}

/**
 * Get the best photo URL from user data with fallback priority
 * @param {Object} userData - User data object
 * @param {string} fallbackType - Type of fallback to use
 * @returns {string} Best available photo URL or fallback
 */
function getBestPhotoUrl(userData, fallbackType = 'avatar') {
  if (!userData) return null;
  
  // Collect all potential photo URLs
  const allCandidates = [
    userData.photoURL,
    ...(Array.isArray(userData.photos) ? userData.photos : []),
    userData.loungeAvatar,
    userData.avatar
  ].filter(url => url && url.trim() && url !== 'undefined' && url !== 'null');
  
  // UPDATED FIX: HEIC files are now converted to JPEG during upload, so all URLs should be displayable
  // Still prioritize non-HEIC URLs just in case, but don't exclude HEIC entirely
  const nonHeicCandidates = allCandidates.filter(url => !url.toLowerCase().includes('.heic'));
  const heicCandidates = allCandidates.filter(url => url.toLowerCase().includes('.heic'));
  
  // Return first non-HEIC photo, then HEIC (since they may now be converted to JPEG)
  const candidates = [...nonHeicCandidates, ...heicCandidates];
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Check if a URL is a real photo URL (not a generated SVG)
 * @param {string} url - URL to check
 * @returns {boolean} True if it's a real photo URL
 */
function isRealPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Exclude SVG data URLs (generated avatars)
  if (url.startsWith('data:image/svg+xml')) return false;
  
  // Accept real photo URLs
  return url.startsWith('http') || url.includes('firebasestorage.googleapis.com');
}

/**
 * Check if URL is a legitimate user profile photo (allowlist approach)
 * @param {string} url - URL to check
 * @returns {boolean} True if it's a legitimate profile photo
 */
function isLegitimateProfilePhoto(url) {
  if (!url || typeof url !== 'string') return false;
  
  // FIRST: Block only EXACT World Hub avatar patterns (more precise filtering)
  const isExactWorldHubAvatar = (
    // Block exact lounge avatar patterns (World Hub generated avatars)
    (url.includes('loungeAvatar') && url.includes('cc86c20e-1b30-4b42-9f72-666702753d35')) ||
    // Block exact avatar patterns with specific endings
    (url.includes('cc86c20e-1b30-4b42-9f72-666702753d35-1_all_16848') && url.includes('.png')) ||
    (url.includes('cc86c20e-1b30-4b42-9f72-666702753d35-1_all_16904') && url.includes('.png')) ||
    (url.includes('cc86c20e-1b30-4b42-9f72-666702753d35-1_all_16902') && url.includes('.png'))
  );
  
  if (isExactWorldHubAvatar) {
    console.log('🚫 Blocking exact World Hub avatar pattern in URL:', url.substring(0, 80) + '...');
    return false;
  }
  
  // THEN: Allow specific trusted hosts for profile photos (including user uploads with similar names)
  return (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com') ||
    url.includes('imgur.com') ||
    url.includes('cloudinary.com') ||
    url.includes('gravatar.com') ||
    url.startsWith('data:image/')
  );
}

/**
 * Check if URL is a World Hub avatar (to be blocked from profiles)
 * @param {string} url - URL to check  
 * @returns {boolean} True if it should be blocked
 */
function isWorldHubAvatar(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Simple approach: block if NOT a legitimate profile photo
  return !isLegitimateProfilePhoto(url);
}

/**
 * Get primary photo URL from user data (simple allowlist approach)
 * @param {Object} userData - User data object
 * @returns {string|null} Primary photo URL or null if none found
 */
function getPrimaryPhoto(userData) {
  if (!userData) return null;
  
  // Check primaryPhotoUrl first, then standard photo fields
  const candidates = [
    userData.primaryPhotoUrl,
    userData.photoURL,
    Array.isArray(userData.photos) && userData.photos.length > 0 ? userData.photos[0] : null
  ].filter(url => {
    return url && 
           url.trim() && 
           url !== 'undefined' && 
           url !== 'null' &&
           isLegitimateProfilePhoto(url); // Only allow legitimate profile photos
  });
  
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Get profile photo URL (PROFILE CONTEXTS ONLY - uses allowlist filtering)
 * @param {Object} userData - User data object
 * @returns {string|null} Profile photo URL or null
 */
function getProfilePhotoUrl(userData) {
  // Use the same logic as getPrimaryPhoto for consistency
  return getPrimaryPhoto(userData);
}

/**
 * Load profile photo (simplified version using new simple loading logic)
 * @param {HTMLImageElement} imgElement - Image element to update
 * @param {Object} userData - User data object
 * @param {Function} onLoad - Optional load callback
 * @param {Function} onError - Optional error callback
 */
function loadProfilePhoto(imgElement, userData, onLoad = null, onError = null) {
  if (!imgElement || !userData) return;
  
  // Set user-specific data attribute for debugging
  if (userData.uid) {
    imgElement.dataset.userId = userData.uid;
  }
  
  // Get primary photo URL using the new simple function
  const photoUrl = getPrimaryPhoto(userData);
  
  if (!photoUrl) {
    console.log('📷 No legitimate profile photo found, hiding image');
    imgElement.style.display = 'none';
    return;
  }
  
  // Use the simple image loading function
  loadSimpleImage(imgElement, photoUrl, onLoad, onError);
}

/**
 * Validate if a URL appears to be a valid image URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL appears valid
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Check for data URLs (always valid)
  if (url.startsWith('data:image/')) return true;
  
  // Check for common image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i;
  if (imageExtensions.test(url)) return true;
  
  // Check for Firebase Storage URLs
  if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')) return true;
  
  // Check for other common image hosting
  if (url.includes('imgur.com') || url.includes('cloudinary.com') || url.includes('gravatar.com')) return true;
  
  return false;
}

/**
 * Initialize photo loading for all images in a container
 * @param {HTMLElement} container - Container to search for images
 * @param {string} fallbackType - Default fallback type
 */
function initializePhotosInContainer(container, fallbackType = 'avatar') {
  if (!container) return;
  
  const images = container.querySelectorAll('img');
  images.forEach(img => {
    if (!img.hasAttribute('data-photo-initialized')) {
      const currentSrc = img.src;
      if (currentSrc && currentSrc !== window.location.href) {
        loadImageWithFallback(img, currentSrc, fallbackType);
      }
      img.setAttribute('data-photo-initialized', 'true');
    }
  });
}

/**
 * Create a properly configured image element
 * @param {string} photoUrl - Photo URL to load
 * @param {string} altText - Alt text for the image
 * @param {string} fallbackType - Fallback type to use
 * @param {string} className - CSS class to apply
 * @returns {HTMLImageElement} Configured image element
 */
function createPhotoElement(photoUrl, altText = '', fallbackType = 'avatar', className = '') {
  const img = document.createElement('img');
  img.alt = altText;
  if (className) img.className = className;
  
  loadImageWithFallback(img, photoUrl, fallbackType);
  return img;
}

/**
 * Force complete image reload with cache clearing
 * @param {HTMLImageElement} imgElement - Image element to reload
 * @param {string} photoUrl - Photo URL to reload
 * @param {string} fallbackType - Fallback type to use
 * @param {Function} onLoad - Optional load callback
 * @param {Function} onError - Optional error callback
 */
function forceImageReload(imgElement, photoUrl, fallbackType = 'avatar', onLoad = null, onError = null) {
  if (!imgElement) {
    console.error('❌ forceImageReload: No image element provided');
    return;
  }
  
  console.log('🔄 Force reloading image with cache clearing:', photoUrl?.substring(0, 50) + '...');
  
  // Clear cache first, then load with cache-busting
  clearImageCache(imgElement);
  
  // NO FALLBACKS - only load real photos
  setTimeout(() => {
    if (photoUrl && photoUrl.trim() && photoUrl !== 'undefined' && photoUrl !== 'null') {
      const cacheBustedUrl = addCacheBusting(photoUrl);
      imgElement.onerror = function() {
        console.log(`⚠️ Image failed to load: ${photoUrl}, hiding image (no fallback)`);
        this.style.display = 'none';
        if (onError) onError(this);
      };
      imgElement.onload = function() {
        console.log(`✅ Image loaded successfully: ${this.src.substring(0, 50)}...`);
        if (onLoad) onLoad(this);
      };
      
      // CRITICAL FIX: Clear background-image AND pseudo-elements to prevent avatar contamination
      imgElement.style.backgroundImage = '';
      const parent = imgElement.parentElement;
      if (parent && parent.style) parent.style.backgroundImage = '';
      const frame = imgElement.closest?.('.card-frame');
      if (frame && frame.style) frame.style.backgroundImage = '';
      
      // Kill pseudo-element backgrounds and clear avatar CSS variables
      if (frame) frame.classList.add('no-avatar-bg');
      const root = document.documentElement;
      ['--avatar-url','--user-avatar','--bg-avatar','--profile-avatar','--lounge-avatar'].forEach(v => root.style.removeProperty(v));
      
      imgElement.src = cacheBustedUrl;
    } else {
      console.log('📷 No photo URL provided, hiding image');
      imgElement.style.display = 'none';
    }
  }, 50);
}

// Export all utilities with simplified approach
window.PhotoUtils = {
  getPrimaryPhoto,         // Simple function to get primaryPhotoUrl or first valid photo
  loadSimpleImage,         // Simple image loading without complex cache-busting
  loadImageWithFallback,   // Legacy function (now uses simple logic)
  getBestPhotoUrl,
  getProfilePhotoUrl,      // Profile photo URL with allowlist filtering
  loadProfilePhoto,        // Profile-only photo loading (simplified)
  isRealPhotoUrl,          // Check if URL is real photo (not generated)
  isLegitimateProfilePhoto, // Check if URL is from allowlist of legitimate sources
  isWorldHubAvatar,        // Check if URL should be blocked (uses allowlist internally)
  isValidImageUrl,
  clearImageCache,         // Clear image cache to prevent contamination (async)
  clearImageCacheImmediate, // Clear image cache immediately (sync)
  addCacheBusting,         // Add cache-busting parameters to URLs
  forceImageReload,        // Force complete image reload with cache clearing
  killGlobalAvatarOverlays // Kill global avatar overlays that render above main image
};

console.log('📷 PhotoUtils loaded with NO fallbacks');
