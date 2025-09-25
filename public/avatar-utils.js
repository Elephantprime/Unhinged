/**
 * Shared Avatar Persistence Utilities
 * Provides consistent avatar loading and saving across all sections
 */

// Avatar utility functions for consistent handling across sections
window.AvatarUtils = {
  /**
   * Save avatar selection with full persistence (Firebase + localStorage)
   * @param {string|File} avatarUrl - Avatar URL or File object
   * @param {string} uid - User ID (optional, will try to get from current auth)
   * @returns {Promise<string>} Final avatar URL
   */
  async saveAvatar(avatarUrl, uid = null) {
    console.log('🚫 AVATAR SYSTEM DISABLED - No avatars will be saved');
    return null;
  },

  /**
   * Load avatar with proper fallback priority and unique user identification
   * @param {string} uid - User ID (REQUIRED - never optional to prevent cross-contamination)
   * @returns {Promise<string>} Best available avatar URL
   */
  async loadAvatar(uid = null) {
    console.log('🚫 AVATAR SYSTEM DISABLED - No avatars will be loaded');
    return null;
    
    // Try to get from Firestore first (if authenticated)
    if (typeof getUserDoc === 'function') {
      try {
        const userDoc = await getUserDoc(userId);
        console.log('📄 User document loaded:', { uid: userDoc?.uid, photoURL: userDoc?.photoURL?.substring(0, 50), loungeAvatar: userDoc?.loungeAvatar?.substring(0, 50) });
        
        if (userDoc) {
          // WORLD AVATAR ONLY: loungeAvatar -> photoURL (no photos fallback to prevent contamination)
          savedAvatar = userDoc.loungeAvatar || userDoc.photoURL;
          
          // Check if we got a REAL photo URL (not undefined/null and not an SVG fallback)
          if (savedAvatar && 
              savedAvatar !== 'undefined' && 
              savedAvatar !== 'null' && 
              this.isRealPhotoUrl(savedAvatar)) {
            console.log('✅ Real avatar retrieved from Firestore:', savedAvatar.substring(0, 50) + '...');
            // Save REAL user-specific avatar to localStorage with UID (overwrite any SVG fallbacks)
            localStorage.setItem(`avatar_${userId}`, savedAvatar);
            return savedAvatar;
          } else {
            console.log('⚠️ Firestore avatar is not a real photo URL, checking alternatives');
          }
        }
      } catch (error) {
        console.warn('⚠️ Error loading avatar from Firestore:', error);
      }
    }
    
    // Try user-specific localStorage (but only if it's a REAL photo URL, not SVG fallback)
    const userSpecificAvatar = localStorage.getItem(`avatar_${userId}`);
    if (userSpecificAvatar && 
        userSpecificAvatar !== 'null' && 
        userSpecificAvatar !== 'undefined' &&
        this.isRealPhotoUrl(userSpecificAvatar)) {
      console.log('✅ Real photo avatar from localStorage:', userSpecificAvatar.substring(0, 50) + '...');
      return userSpecificAvatar;
    } else if (userSpecificAvatar && !this.isRealPhotoUrl(userSpecificAvatar)) {
      console.log('🗑️ Removing SVG fallback from localStorage for user:', userId.substring(0, 8));
      localStorage.removeItem(`avatar_${userId}`);
    }
    
    // Generate unique avatar for this user based on their UID
    const uniqueAvatar = this.generateUniqueAvatar(userId);
    console.log('🎨 Generated unique avatar for user:', userId.substring(0, 8));
    // Save the unique avatar for this user
    localStorage.setItem(`avatar_${userId}`, uniqueAvatar);
    return uniqueAvatar;
  },

  /**
   * Check if a URL is a real photo URL (not an SVG fallback)
   * @param {string} url - URL to check
   * @returns {boolean} True if it's a real photo URL
   */
  isRealPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check if it's an SVG data URL (fallback)
    if (url.startsWith('data:image/svg+xml')) return false;
    
    // Check for common real photo URL patterns
    const realPhotoPatterns = [
      /^https:\/\/firebasestorage\.googleapis\.com/,  // Firebase Storage
      /^https:\/\/.*\.(jpg|jpeg|png|gif|webp)(\?|$)/i,  // Image file URLs
      /^https:\/\/.*\.googleapis\.com.*\.(jpg|jpeg|png|gif|webp)/i,  // Google APIs images
      /^https:\/\/lh\d+\.googleusercontent\.com/,  // Google profile photos
      /^https:\/\/.*gravatar\.com/,  // Gravatar
      /^https:\/\/.*\/.*\.(jpg|jpeg|png|gif|webp)/i  // General image URLs
    ];
    
    return realPhotoPatterns.some(pattern => pattern.test(url));
  },

  /**
   * Generate a generic fallback avatar for when no user ID is available
   * @returns {string} Generic fallback avatar data URL
   */
  generateGenericFallback() {
    const fallbackAvatar = typeof window.PhotoUtils?.FALLBACKS?.avatar === 'string' 
      ? window.PhotoUtils.FALLBACKS.avatar
      : 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>');
    
    console.log('ℹ️ Using generic fallback avatar (no user ID available)');
    return fallbackAvatar;
  },

  /**
   * Generate a unique avatar for a user based on their UID
   * @param {string} uid - User ID
   * @returns {string} Unique avatar data URL
   */
  generateUniqueAvatar(uid) {
    // Create a simple hash from the UID to generate consistent colors
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      const char = uid.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate colors based on hash
    const hue = Math.abs(hash) % 360;
    const bgColor = `hsl(${hue}, 40%, 25%)`;
    const fgColor = `hsl(${hue}, 60%, 45%)`;
    
    // Create initials from UID
    const initials = uid.substring(0, 2).toUpperCase();
    
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
        <rect width='100%' height='100%' fill='${bgColor}'/>
        <circle cx='40' cy='30' r='16' fill='${fgColor}'/>
        <path d='M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z' fill='${fgColor}'/>
        <text x='40' y='70' text-anchor='middle' fill='white' font-family='Arial' font-size='12' font-weight='bold'>${initials}</text>
      </svg>
    `);
  },

  /**
   * Update avatar display elements with proper loading and fallbacks
   * @param {string} avatarUrl - Avatar URL to display
   * @param {string|HTMLElement} elementId - Element ID or element to update
   */
  updateDisplay(avatarUrl, elementId) {
    console.log('🚫 Avatar display DISABLED - no images will be shown');
    const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (element && element.tagName === 'IMG') {
      element.src = '';
      element.style.display = 'none';
      element.style.visibility = 'hidden';
    }
  },

  /**
   * Get user data with consistent avatar loading
   * @param {Object} userDoc - Firestore user document
   * @param {Object} authUser - Firebase auth user
   * @returns {Promise<Object>} User object with consistent avatar
   */
  async buildUserObject(userDoc, authUser) {
    if (!authUser) return null;
    
    console.log('🏗️ Building user object for:', authUser.uid);
    const savedAvatar = await this.loadAvatar(authUser.uid);
    const displayName = userDoc?.displayName || authUser.displayName || authUser.email?.split('@')[0] || `User${authUser.uid.substring(0, 8)}`;
    
    const userObject = {
      uid: authUser.uid,
      name: displayName,
      avatar: savedAvatar,
      mood: userDoc?.mood || 'available'
    };
    
    console.log('✅ User object built:', { uid: userObject.uid, name: userObject.name, avatar: userObject.avatar?.substring(0, 50) });
    return userObject;
  },

  /**
   * Clean up contaminated localStorage keys that may cause cross-contamination
   * Call this during app initialization to remove old non-scoped keys
   */
  cleanupContaminatedStorage() {
    const contamainatedKeys = [
      'avatar',           // Old non-scoped avatar key
      'photoURL',         // Old non-scoped photo key  
      'userAvatar',       // Old non-scoped user avatar key
      'currentAvatar',    // Old non-scoped current avatar key
      'profilePhoto',     // Old non-scoped profile photo key
      'selectedAvatar'    // Old non-scoped selected avatar key
    ];
    
    let cleanedCount = 0;
    contamainatedKeys.forEach(key => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleanedCount++;
        console.log(`🧹 Removed contaminated localStorage key: ${key}`);
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} contaminated localStorage keys`);
    } else {
      console.log('✅ No contaminated localStorage keys found');
    }
  }
};

// Automatically clean up contaminated storage on load
window.AvatarUtils.cleanupContaminatedStorage();

console.log('🎭 AvatarUtils loaded with shared persistence and contamination cleanup');