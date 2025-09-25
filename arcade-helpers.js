// public/js/arcade-helpers.js
// =====================================================
// Arcade System Helpers
// - Points management and tracking
// - Badge system and achievements
// - Game session tracking
// - Meme contest functionality
// - Real-time leaderboards
// =====================================================

import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from './firebase.js';

// Import additional Firestore functions
import { 
  updateDoc,
  deleteDoc,
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
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =====================================================
// POINTS SYSTEM
// =====================================================

// Point values for different activities
const POINT_VALUES = {
  PLAY_GAME: 5,
  WIN_GAME: 10,
  DAILY_BONUS: 25,
  FIRST_GAME: 50,
  WEEKLY_STREAK: 100,
  MEME_SUBMISSION: 15,
  MEME_VOTE_RECEIVED: 5,
  TRIVIA_CORRECT: 8,
  CASINO_WIN: 20,
  TRUTH_DARE_COMPLETE: 7
};

// Badge definitions
const BADGE_DEFINITIONS = {
  'first-game': {
    id: 'first-game',
    name: 'First Steps',
    description: 'Played your first arcade game',
    icon: '🎮',
    requirement: 'play_any_game',
    points: 50
  },
  'truth-teller': {
    id: 'truth-teller',
    name: 'Truth Teller',
    description: 'Completed 10 Truth or Dare games',
    icon: '🎯',
    requirement: 'truth_dare_10',
    points: 100
  },
  'high-roller': {
    id: 'high-roller',
    name: 'High Roller',
    description: 'Won big in the casino',
    icon: '🎰',
    requirement: 'casino_big_win',
    points: 150
  },
  'meme-master': {
    id: 'meme-master',
    name: 'Meme Master',
    description: 'Submitted 5 popular memes',
    icon: '😂',
    requirement: 'meme_popular_5',
    points: 200
  },
  'trivia-genius': {
    id: 'trivia-genius',
    name: 'Trivia Genius',
    description: 'Answered 25 trivia questions correctly',
    icon: '🧠',
    requirement: 'trivia_correct_25',
    points: 175
  },
  'daily-grinder': {
    id: 'daily-grinder',
    name: 'Daily Grinder',
    description: 'Played games for 7 days straight',
    icon: '🔥',
    requirement: 'daily_streak_7',
    points: 250
  },
  'social-butterfly': {
    id: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'Voted on 50 memes',
    icon: '🦋',
    requirement: 'meme_votes_50',
    points: 125
  },
  'arcade-legend': {
    id: 'arcade-legend',
    name: 'Arcade Legend',
    description: 'Reached 1000 total points',
    icon: '👑',
    requirement: 'points_1000',
    points: 500
  }
};

// Get user's arcade points document
async function getArcadePoints(uid) {
  try {
    const pointsRef = doc(db, 'arcade_points', uid);
    const pointsSnap = await getDoc(pointsRef);
    
    if (pointsSnap.exists()) {
      return pointsSnap.data();
    } else {
      // Initialize new points document
      const initialData = {
        uid,
        totalPoints: 0,
        dailyPoints: 0,
        lastActivity: serverTimestamp(),
        gamesPlayed: 0,
        gamesWon: 0,
        streakDays: 0,
        lastLoginDate: null,
        achievements: {},
        createdAt: serverTimestamp()
      };
      await setDoc(pointsRef, initialData);
      return initialData;
    }
  } catch (error) {
    console.error('❌ Error getting arcade points:', error);
    return null;
  }
}

// Award points to user
async function awardPoints(uid, pointType, gameType = null, additionalData = {}) {
  try {
    const points = POINT_VALUES[pointType] || 0;
    if (points === 0) return;

    const pointsRef = doc(db, 'arcade_points', uid);
    const userPointsData = await getArcadePoints(uid);
    
    if (!userPointsData) return;

    // Update points
    await updateDoc(pointsRef, {
      totalPoints: increment(points),
      dailyPoints: increment(points),
      lastActivity: serverTimestamp(),
      [`achievements.${pointType}_count`]: increment(1)
    });

    // Record game session
    if (gameType) {
      await recordGameSession(uid, gameType, points, additionalData);
    }

    // Check for badge unlocks
    await checkBadgeUnlocks(uid, pointType, userPointsData);

    // Update leaderboards
    await updateLeaderboards(uid, points, gameType);

    console.log(`✅ Awarded ${points} points for ${pointType}`);
    return points;
  } catch (error) {
    console.error('❌ Error awarding points:', error);
    return 0;
  }
}

// Record a game session
async function recordGameSession(uid, gameType, pointsEarned, sessionData = {}) {
  try {
    const gameSession = {
      uid,
      gameType,
      pointsEarned,
      timestamp: serverTimestamp(),
      ...sessionData
    };

    await addDoc(collection(db, 'arcade_games'), gameSession);
    
    // Update daily missions progress for games played
    if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
      await window.DailyMissionsAPI.updateProgress('games_played', 1, {
        gameType,
        pointsEarned,
        sessionData
      });
    }
  } catch (error) {
    console.error('❌ Error recording game session:', error);
  }
}

// =====================================================
// BADGE SYSTEM
// =====================================================

// Check and unlock badges based on user activity
async function checkBadgeUnlocks(uid, activityType, userPointsData) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    const currentBadges = userData.badges || [];

    const newBadges = [];

    // Check each badge requirement
    for (const badge of Object.values(BADGE_DEFINITIONS)) {
      if (currentBadges.includes(badge.id)) continue; // Already unlocked

      let shouldUnlock = false;

      switch (badge.requirement) {
        case 'play_any_game':
          shouldUnlock = userPointsData.gamesPlayed >= 1;
          break;
        case 'truth_dare_10':
          shouldUnlock = (userPointsData.achievements?.truth_dare_count || 0) >= 10;
          break;
        case 'casino_big_win':
          shouldUnlock = (userPointsData.achievements?.casino_big_win_count || 0) >= 1;
          break;
        case 'meme_popular_5':
          shouldUnlock = (userPointsData.achievements?.popular_meme_count || 0) >= 5;
          break;
        case 'trivia_correct_25':
          shouldUnlock = (userPointsData.achievements?.trivia_correct_count || 0) >= 25;
          break;
        case 'daily_streak_7':
          shouldUnlock = userPointsData.streakDays >= 7;
          break;
        case 'meme_votes_50':
          shouldUnlock = (userPointsData.achievements?.meme_votes_count || 0) >= 50;
          break;
        case 'points_1000':
          shouldUnlock = userPointsData.totalPoints >= 1000;
          break;
      }

      if (shouldUnlock) {
        newBadges.push(badge);
      }
    }

    // Unlock new badges
    if (newBadges.length > 0) {
      const badgeIds = newBadges.map(b => b.id);
      await updateDoc(userRef, {
        badges: arrayUnion(...badgeIds),
        updatedAt: serverTimestamp()
      });

      // Award bonus points for badge unlocks
      for (const badge of newBadges) {
        await awardPoints(uid, 'badge_unlock', null, { badgeId: badge.id });
      }

      // Trigger badge unlock event
      window.dispatchEvent(new CustomEvent('badgeUnlocked', { 
        detail: { badges: newBadges } 
      }));
    }

    return newBadges;
  } catch (error) {
    console.error('❌ Error checking badge unlocks:', error);
    return [];
  }
}

// Get user's badges with full details
async function getUserBadges(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    const badgeIds = userData.badges || [];

    return badgeIds.map(id => BADGE_DEFINITIONS[id]).filter(Boolean);
  } catch (error) {
    console.error('❌ Error getting user badges:', error);
    return [];
  }
}

// =====================================================
// LEADERBOARDS
// =====================================================

// Update leaderboards after point changes
async function updateLeaderboards(uid, pointsEarned, gameType) {
  try {
    // Update overall leaderboard
    const overallRef = doc(db, 'arcade_leaderboards', 'overall');
    const overallSnap = await getDoc(overallRef);
    
    if (!overallSnap.exists()) {
      await setDoc(overallRef, {
        topPlayers: [],
        lastUpdated: serverTimestamp()
      });
    }

    // Update game-specific leaderboard if provided
    if (gameType) {
      const gameRef = doc(db, 'arcade_leaderboards', gameType);
      const gameSnap = await getDoc(gameRef);
      
      if (!gameSnap.exists()) {
        await setDoc(gameRef, {
          topPlayers: [],
          lastUpdated: serverTimestamp()
        });
      }
    }

    // Trigger leaderboard refresh (will be handled by real-time listeners)
    window.dispatchEvent(new CustomEvent('leaderboardUpdate', { 
      detail: { gameType: gameType || 'overall' }
    }));
  } catch (error) {
    console.error('❌ Error updating leaderboards:', error);
  }
}

// Get leaderboard data
async function getLeaderboard(category = 'overall', limitCount = 10) {
  try {
    // Get all users' arcade points
    const pointsQuery = query(
      collection(db, 'arcade_points'),
      orderBy('totalPoints', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(pointsQuery);
    const leaderboard = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      // Get user info
      const userSnap = await getDoc(doc(db, 'users', data.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      leaderboard.push({
        uid: data.uid,
        name: userData.displayName || 'Anonymous',
        avatar: userData.photoURL || 'https://i.pravatar.cc/50',
        totalPoints: data.totalPoints || 0,
        gamesPlayed: data.gamesPlayed || 0
      });
    }

    return leaderboard;
  } catch (error) {
    console.error('❌ Error getting leaderboard:', error);
    return [];
  }
}

// =====================================================
// MEME CONTEST
// =====================================================

// Submit a meme to contest
async function submitMeme(uid, imageFile, caption) {
  try {
    // Upload image to storage (would need to implement)
    const imageUrl = await uploadMemeImage(uid, imageFile);
    
    const memeData = {
      submitterUid: uid,
      submitterName: '', // Will be filled from user data
      imageUrl,
      caption: caption || '',
      votes: [],
      totalVotes: 0,
      contestWeek: getCurrentContestWeek(),
      timestamp: serverTimestamp(),
      approved: false // Requires moderation
    };

    // Get submitter name
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      memeData.submitterName = userSnap.data().displayName || 'Anonymous';
    }

    const memeRef = await addDoc(collection(db, 'meme_contests'), memeData);
    
    // Award points for submission
    await awardPoints(uid, 'MEME_SUBMISSION', 'meme-contest');

    return memeRef.id;
  } catch (error) {
    console.error('❌ Error submitting meme:', error);
    return null;
  }
}

// Vote on a meme
async function voteMeme(memeId, voterUid) {
  try {
    const memeRef = doc(db, 'meme_contests', memeId);
    const memeSnap = await getDoc(memeRef);
    
    if (!memeSnap.exists()) return false;
    
    const memeData = memeSnap.data();
    const currentVotes = memeData.votes || [];
    
    // Check if user already voted
    if (currentVotes.includes(voterUid)) {
      // Remove vote
      await updateDoc(memeRef, {
        votes: arrayRemove(voterUid),
        totalVotes: increment(-1)
      });
    } else {
      // Add vote
      await updateDoc(memeRef, {
        votes: arrayUnion(voterUid),
        totalVotes: increment(1)
      });
      
      // Award points to meme creator
      await awardPoints(memeData.submitterUid, 'MEME_VOTE_RECEIVED', 'meme-contest');
    }

    return true;
  } catch (error) {
    console.error('❌ Error voting on meme:', error);
    return false;
  }
}

// Get current contest memes
async function getContestMemes(contestWeek = null) {
  try {
    const currentWeek = contestWeek || getCurrentContestWeek();
    const memesQuery = query(
      collection(db, 'meme_contests'),
      where('contestWeek', '==', currentWeek),
      where('approved', '==', true),
      orderBy('totalVotes', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(memesQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Error getting contest memes:', error);
    return [];
  }
}

// Helper to get current contest week
function getCurrentContestWeek() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber}`;
}

// Placeholder for meme image upload (would need proper implementation)
async function uploadMemeImage(uid, imageFile) {
  // This would upload to Firebase Storage and return URL
  // For now, return a placeholder
  return URL.createObjectURL(imageFile);
}

// =====================================================
// DAILY STREAKS & BONUSES
// =====================================================

// Check and update daily streak
async function checkDailyStreak(uid) {
  try {
    const pointsData = await getArcadePoints(uid);
    if (!pointsData) return;

    const today = new Date().toDateString();
    const lastLogin = pointsData.lastLoginDate ? new Date(pointsData.lastLoginDate.toDate()).toDateString() : null;

    if (lastLogin !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let newStreakDays = 1;

      if (lastLogin === yesterday) {
        // Continue streak
        newStreakDays = (pointsData.streakDays || 0) + 1;
      }

      // Update streak and award daily bonus
      const pointsRef = doc(db, 'arcade_points', uid);
      await updateDoc(pointsRef, {
        streakDays: newStreakDays,
        lastLoginDate: serverTimestamp(),
        dailyPoints: 0 // Reset daily points
      });

      // Award daily bonus
      await awardPoints(uid, 'DAILY_BONUS', 'daily-streak');

      return newStreakDays;
    }

    return pointsData.streakDays || 0;
  } catch (error) {
    console.error('❌ Error checking daily streak:', error);
    return 0;
  }
}

// =====================================================
// EXPORTS
// =====================================================
export {
  // Points
  getArcadePoints,
  awardPoints,
  recordGameSession,
  
  // Badges
  checkBadgeUnlocks,
  getUserBadges,
  BADGE_DEFINITIONS,
  
  // Leaderboards
  updateLeaderboards,
  getLeaderboard,
  
  // Memes
  submitMeme,
  voteMeme,
  getContestMemes,
  getCurrentContestWeek,
  
  // Daily streaks
  checkDailyStreak,
  
  // Constants
  POINT_VALUES
};