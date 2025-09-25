// Profile completion and access control utilities
// Production-ready lightweight implementation

/**
 * Check if a profile is complete enough to use the matching system
 * @param {Object} user - User object from Firebase
 * @returns {boolean} - True if profile is complete
 */
export function isProfileComplete(user) {
    if (!user) return false;
    
    // Basic requirements for a complete profile
    const hasDisplayName = user.displayName && user.displayName.trim().length > 0;
    const hasAge = user.age && user.age > 0;
    
    console.log('📋 Profile completion check:', {
        uid: user.uid?.substring(0, 8),
        hasDisplayName,
        hasAge,
        complete: hasDisplayName && hasAge
    });
    
    return hasDisplayName && hasAge;
}

/**
 * Initialize profile completion gate
 * @param {Object} user - Current user object
 * @param {Function} onComplete - Callback when profile setup is complete
 * @param {Function} onIncomplete - Callback when profile needs completion
 */
export function initProfileGate(user, onComplete, onIncomplete) {
    console.log('🚪 Initializing profile gate for user:', user?.uid?.substring(0, 8));
    
    if (isProfileComplete(user)) {
        console.log('✅ Profile complete - allowing access');
        if (onComplete) onComplete();
    } else {
        console.log('⚠️ Profile incomplete - redirecting to setup');
        if (onIncomplete) {
            onIncomplete();
        } else {
            // Default action: redirect to profile setup
            window.location.href = '/profile-clean.html?setup=true';
        }
    }
}

/**
 * Show profile completion status
 * @param {Object} user - User object
 * @returns {Object} - Status object with completion details
 */
export function getProfileCompletionStatus(user) {
    if (!user) return { complete: false, missing: ['user'], percentage: 0 };
    
    const checks = {
        displayName: user.displayName && user.displayName.trim().length > 0,
        age: user.age && user.age > 0,
        photos: user.photos && user.photos.length > 0
    };
    
    const completed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    const percentage = Math.round((completed / total) * 100);
    const missing = Object.keys(checks).filter(key => !checks[key]);
    
    return {
        complete: completed === total,
        percentage,
        missing,
        checks
    };
}

console.log('✅ Profile lock utilities loaded');