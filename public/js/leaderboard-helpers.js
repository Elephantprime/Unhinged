// public/js/leaderboard-helpers.js
// =====================================================
// Comprehensive Leaderboard System
// Integrates arcade points + passport stamps for unified rankings
// =====================================================

import { 
  db, 
  doc, 
  getDoc, 
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  onSnapshot
} from './firebase.js';

import { getArcadePoints, BADGE_DEFINITIONS } from './arcade-helpers.js';
import { STAMP_DEFINITIONS } from './passport-api.js';

// =====================================================
// LEADERBOARD CATEGORIES & WEIGHTS
// =====================================================

// Weights for different score components (totals to 100)
const SCORE_WEIGHTS = {
  ARCADE_POINTS: 0.4,        // 40% - Gaming achievements
  PASSPORT_POINTS: 0.35,     // 35% - Social/location stamps  
  SOCIAL_ENGAGEMENT: 0.15,   // 15% - Social interactions
  RECENT_ACTIVITY: 0.10      // 10% - Recent activity bonus
};

// Leaderboard categories
const LEADERBOARD_CATEGORIES = {
  OVERALL: 'overall',
  GAMING: 'gaming', 
  SOCIAL: 'social',
  EXPLORER: 'explorer',
  ACHIEVEMENTS: 'achievements'
};

// Time periods for rankings
const TIME_PERIODS = {
  ALL_TIME: 'all_time',
  MONTHLY: 'monthly', 
  WEEKLY: 'weekly',
  DAILY: 'daily'
};

// =====================================================
// COMPREHENSIVE USER SCORE CALCULATION
// =====================================================

/**
 * Calculate comprehensive user score combining all systems
 * @param {string} uid - User ID
 * @param {string} timePeriod - Time period for calculation
 * @returns {Object} Complete user score breakdown
 */
export async function calculateUserScore(uid, timePeriod = TIME_PERIODS.ALL_TIME) {
  try {
    // Get all user data in parallel
    const [
      arcadeData,
      passportData,
      stampsData,
      travelsData,
      encountersData,
      userProfile
    ] = await Promise.all([
      getArcadePoints(uid),
      getPassportData(uid),
      getPassportStamps(uid, timePeriod),
      getPassportTravels(uid, timePeriod),
      getPassportEncounters(uid, timePeriod),
      getUserProfile(uid)
    ]);

    // Calculate component scores
    const arcadeScore = arcadeData?.totalPoints || 0;
    const passportScore = calculatePassportScore(stampsData);
    const socialScore = calculateSocialScore(encountersData, travelsData);
    const recentActivityScore = calculateRecentActivityScore(stampsData, travelsData, timePeriod);

    // Calculate weighted total
    const totalScore = Math.round(
      (arcadeScore * SCORE_WEIGHTS.ARCADE_POINTS) +
      (passportScore * SCORE_WEIGHTS.PASSPORT_POINTS) +
      (socialScore * SCORE_WEIGHTS.SOCIAL_ENGAGEMENT) +
      (recentActivityScore * SCORE_WEIGHTS.RECENT_ACTIVITY)
    );

    return {
      uid,
      totalScore,
      breakdown: {
        arcade: arcadeScore,
        passport: passportScore,
        social: socialScore,
        recentActivity: recentActivityScore
      },
      profile: {
        displayName: userProfile?.displayName || 'Unknown User',
        photoURL: userProfile?.photoURL || null,
        joinDate: userProfile?.createdAt || null
      },
      achievements: {
        totalStamps: stampsData.length,
        totalTravels: travelsData.length,
        totalEncounters: encountersData.length,
        gamesPlayed: arcadeData?.gamesPlayed || 0,
        badges: userProfile?.badges || []
      },
      categoryScores: {
        gaming: arcadeScore + getStampPointsByCategory(stampsData, 'achievement'),
        social: socialScore + getStampPointsByCategory(stampsData, 'social'),
        explorer: getStampPointsByCategory(stampsData, 'location') + travelsData.length * 2,
        achievements: stampsData.length * 5 + (userProfile?.badges?.length || 0) * 10
      },
      lastActive: getLastActiveTime(stampsData, travelsData, encountersData)
    };
  } catch (error) {
    console.error('❌ Error calculating user score:', error);
    return null;
  }
}

/**
 * Get comprehensive leaderboard for specific category and time period
 * @param {string} category - Leaderboard category
 * @param {string} timePeriod - Time period
 * @param {number} limitCount - Number of results to return
 * @returns {Array} Ranked user list
 */
export async function getComprehensiveLeaderboard(category = LEADERBOARD_CATEGORIES.OVERALL, timePeriod = TIME_PERIODS.ALL_TIME, limitCount = 50) {
  try {
    console.log(`🏆 Loading ${category} leaderboard for ${timePeriod}...`);

    // Get all users with arcade points (active users)
    const arcadeQuery = query(
      collection(db, 'arcade_points'),
      orderBy('totalPoints', 'desc'),
      limit(limitCount * 2) // Get more to filter properly
    );
    
    const arcadeSnapshot = await getDocs(arcadeQuery);
    const userScores = [];

    // Calculate scores for each user
    for (const doc of arcadeSnapshot.docs) {
      const userData = doc.data();
      const userScore = await calculateUserScore(userData.uid, timePeriod);
      
      if (userScore) {
        userScores.push(userScore);
      }
    }

    // Sort by appropriate score based on category
    const sortKey = category === LEADERBOARD_CATEGORIES.OVERALL ? 'totalScore' : `categoryScores.${category}`;
    
    userScores.sort((a, b) => {
      const scoreA = getNestedValue(a, sortKey) || 0;
      const scoreB = getNestedValue(b, sortKey) || 0;
      return scoreB - scoreA;
    });

    // Add rankings and limit results
    return userScores.slice(0, limitCount).map((user, index) => ({
      ...user,
      rank: index + 1
    }));

  } catch (error) {
    console.error('❌ Error getting comprehensive leaderboard:', error);
    return [];
  }
}

/**
 * Get user's rank in specific leaderboard
 * @param {string} uid - User ID
 * @param {string} category - Leaderboard category
 * @param {string} timePeriod - Time period
 * @returns {Object} User rank info
 */
export async function getUserRank(uid, category = LEADERBOARD_CATEGORIES.OVERALL, timePeriod = TIME_PERIODS.ALL_TIME) {
  try {
    const leaderboard = await getComprehensiveLeaderboard(category, timePeriod, 100);
    const userIndex = leaderboard.findIndex(user => user.uid === uid);
    
    if (userIndex >= 0) {
      return {
        rank: userIndex + 1,
        user: leaderboard[userIndex],
        totalPlayers: leaderboard.length
      };
    }
    
    return { rank: null, user: null, totalPlayers: leaderboard.length };
  } catch (error) {
    console.error('❌ Error getting user rank:', error);
    return { rank: null, user: null, totalPlayers: 0 };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get passport data for user
 */
async function getPassportData(uid) {
  try {
    const passportDoc = await getDoc(doc(db, 'user_passports', uid));
    return passportDoc.exists() ? passportDoc.data() : {};
  } catch (error) {
    console.error('❌ Error getting passport data:', error);
    return {};
  }
}

/**
 * Get passport stamps for user within time period
 */
async function getPassportStamps(uid, timePeriod) {
  try {
    let stampsQuery = query(
      collection(db, 'passport_stamps'),
      where('userId', '==', uid)
    );

    // Add time filter if not all-time
    if (timePeriod !== TIME_PERIODS.ALL_TIME) {
      const timeFilter = getTimeFilter(timePeriod);
      stampsQuery = query(stampsQuery, where('timestamp', '>=', timeFilter));
    }

    const stampsSnapshot = await getDocs(stampsQuery);
    return stampsSnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('❌ Error getting passport stamps:', error);
    return [];
  }
}

/**
 * Get passport travels for user within time period
 */
async function getPassportTravels(uid, timePeriod) {
  try {
    let travelsQuery = query(
      collection(db, 'passport_travels'),
      where('userId', '==', uid)
    );

    if (timePeriod !== TIME_PERIODS.ALL_TIME) {
      const timeFilter = getTimeFilter(timePeriod);
      travelsQuery = query(travelsQuery, where('timestamp', '>=', timeFilter));
    }

    const travelsSnapshot = await getDocs(travelsQuery);
    return travelsSnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('❌ Error getting passport travels:', error);
    return [];
  }
}

/**
 * Get passport encounters for user within time period
 */
async function getPassportEncounters(uid, timePeriod) {
  try {
    let encountersQuery = query(
      collection(db, 'passport_encounters'),
      where('userId', '==', uid)
    );

    if (timePeriod !== TIME_PERIODS.ALL_TIME) {
      const timeFilter = getTimeFilter(timePeriod);
      encountersQuery = query(encountersQuery, where('timestamp', '>=', timeFilter));
    }

    const encountersSnapshot = await getDocs(encountersQuery);
    return encountersSnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('❌ Error getting passport encounters:', error);
    return [];
  }
}

/**
 * Get user profile data
 */
async function getUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? userDoc.data() : {};
  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    return {};
  }
}

/**
 * Calculate passport score from stamps
 */
function calculatePassportScore(stamps) {
  return stamps.reduce((total, stamp) => {
    const stampDef = STAMP_DEFINITIONS[stamp.stampId];
    return total + (stampDef?.points || 0);
  }, 0);
}

/**
 * Calculate social engagement score
 */
function calculateSocialScore(encounters, travels) {
  const encounterScore = encounters.length * 3; // 3 points per encounter
  const travelScore = travels.length * 2; // 2 points per travel/location visit
  return encounterScore + travelScore;
}

/**
 * Calculate recent activity bonus
 */
function calculateRecentActivityScore(stamps, travels, timePeriod) {
  if (timePeriod === TIME_PERIODS.ALL_TIME) return 0;
  
  const recentStamps = stamps.filter(stamp => isRecentActivity(stamp.timestamp, timePeriod));
  const recentTravels = travels.filter(travel => isRecentActivity(travel.timestamp, timePeriod));
  
  return (recentStamps.length * 5) + (recentTravels.length * 3);
}

/**
 * Get stamp points by category
 */
function getStampPointsByCategory(stamps, category) {
  return stamps.reduce((total, stamp) => {
    const stampDef = STAMP_DEFINITIONS[stamp.stampId];
    if (stampDef?.category === category) {
      return total + (stampDef.points || 0);
    }
    return total;
  }, 0);
}

/**
 * Get last active time from all activities
 */
function getLastActiveTime(stamps, travels, encounters) {
  const allTimestamps = [
    ...stamps.map(s => s.timestamp),
    ...travels.map(t => t.timestamp),
    ...encounters.map(e => e.timestamp)
  ].filter(Boolean);

  if (allTimestamps.length === 0) return null;
  
  return new Date(Math.max(...allTimestamps.map(t => 
    t.toDate ? t.toDate().getTime() : new Date(t).getTime()
  )));
}

/**
 * Get time filter for time period
 */
function getTimeFilter(timePeriod) {
  const now = new Date();
  
  switch (timePeriod) {
    case TIME_PERIODS.DAILY:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case TIME_PERIODS.WEEKLY:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case TIME_PERIODS.MONTHLY:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0); // All time
  }
}

/**
 * Check if activity is recent based on time period
 */
function isRecentActivity(timestamp, timePeriod) {
  if (!timestamp) return false;
  
  const activityTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const timeFilter = getTimeFilter(timePeriod);
  
  return activityTime >= timeFilter;
}

/**
 * Get nested object value by dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// =====================================================
// REAL-TIME LEADERBOARD UPDATES
// =====================================================

/**
 * Setup real-time leaderboard listener
 * @param {Function} callback - Called when leaderboard updates
 * @param {string} category - Leaderboard category to watch
 * @param {number} limitCount - Number of top users to track
 * @returns {Function} Unsubscribe function
 */
export function setupLeaderboardListener(callback, category = LEADERBOARD_CATEGORIES.OVERALL, limitCount = 20) {
  console.log(`🔄 Setting up real-time leaderboard listener for ${category}...`);
  
  // Watch arcade points for real-time updates
  const unsubscribe = onSnapshot(
    query(collection(db, 'arcade_points'), orderBy('totalPoints', 'desc'), limit(limitCount)),
    async () => {
      // Recalculate leaderboard when arcade points change
      const updatedLeaderboard = await getComprehensiveLeaderboard(category, TIME_PERIODS.ALL_TIME, limitCount);
      callback(updatedLeaderboard);
    },
    (error) => {
      console.error('❌ Error in leaderboard listener:', error);
    }
  );

  return unsubscribe;
}

/**
 * Get leaderboard statistics
 */
export async function getLeaderboardStats() {
  try {
    // Get total active users (users with arcade points)
    const arcadeSnapshot = await getDocs(collection(db, 'arcade_points'));
    const totalUsers = arcadeSnapshot.size;

    // Get total stamps awarded
    const stampsSnapshot = await getDocs(collection(db, 'passport_stamps'));
    const totalStamps = stampsSnapshot.size;

    // Get total travels
    const travelsSnapshot = await getDocs(collection(db, 'passport_travels'));
    const totalTravels = travelsSnapshot.size;

    return {
      totalUsers,
      totalStamps,
      totalTravels,
      totalActivities: totalStamps + totalTravels
    };
  } catch (error) {
    console.error('❌ Error getting leaderboard stats:', error);
    return { totalUsers: 0, totalStamps: 0, totalTravels: 0, totalActivities: 0 };
  }
}

// Export constants for use in UI
export { LEADERBOARD_CATEGORIES, TIME_PERIODS, SCORE_WEIGHTS };
