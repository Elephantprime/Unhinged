// public/js/daily-missions.js
// =====================================================
// Daily Missions System for User Engagement
// Integrates with PassportAPI and Leaderboard systems
// =====================================================

import {
  auth,
  db,
  waitForAuth,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  writeBatch
} from "./firebase.js";

import PassportAPI, { STAMP_DEFINITIONS } from './passport-api.js';

// =====================================================
// MISSION DEFINITIONS AND TEMPLATES
// =====================================================

const MISSION_CATEGORIES = {
  SOCIAL: 'social',
  EXPLORATION: 'exploration', 
  ENGAGEMENT: 'engagement',
  ACHIEVEMENT: 'achievement',
  PROFILE: 'profile'
};

const DIFFICULTY_LEVELS = {
  EASY: { name: 'Easy', points: 10, multiplier: 1 },
  MEDIUM: { name: 'Medium', points: 25, multiplier: 1.5 },
  HARD: { name: 'Hard', points: 50, multiplier: 2 }
};

// Mission templates for generation
const MISSION_TEMPLATES = {
  // Social Missions
  social_send_messages: {
    id: 'social_send_messages',
    category: MISSION_CATEGORIES.SOCIAL,
    name: 'Chat Master',
    description: 'Send {target} messages in chat rooms',
    emoji: '💬',
    targets: { easy: 3, medium: 7, hard: 15 },
    trackingKey: 'messages_sent',
    rewards: { stamps: ['first_chat'], points: null } // Points calculated by difficulty
  },
  
  social_meet_people: {
    id: 'social_meet_people',
    category: MISSION_CATEGORIES.SOCIAL,
    name: 'Social Butterfly',
    description: 'Meet {target} new people in the Lounge',
    emoji: '🦋',
    targets: { easy: 2, medium: 5, hard: 10 },
    trackingKey: 'people_met',
    rewards: { stamps: ['friend_maker'], points: null }
  },

  social_table_hopping: {
    id: 'social_table_hopping',
    category: MISSION_CATEGORIES.SOCIAL,
    name: 'Table Hopper',
    description: 'Join {target} different tables in the Lounge',
    emoji: '🏃‍♀️',
    targets: { easy: 2, medium: 4, hard: 8 },
    trackingKey: 'tables_joined',
    rewards: { stamps: ['table_hopper'], points: null }
  },

  // Exploration Missions
  exploration_visit_districts: {
    id: 'exploration_visit_districts',
    category: MISSION_CATEGORIES.EXPLORATION,
    name: 'World Explorer',
    description: 'Visit {target} different areas in Unhinged World',
    emoji: '🌍',
    targets: { easy: 2, medium: 4, hard: 6 },
    trackingKey: 'areas_visited',
    rewards: { stamps: ['world_traveler'], points: null }
  },

  exploration_arcade_games: {
    id: 'exploration_arcade_games',
    category: MISSION_CATEGORIES.EXPLORATION,
    name: 'Game Explorer',
    description: 'Play {target} different games in the Arcade',
    emoji: '🎮',
    targets: { easy: 1, medium: 3, hard: 5 },
    trackingKey: 'games_played',
    rewards: { stamps: ['arcade_gamer'], points: null }
  },

  exploration_events: {
    id: 'exploration_events',
    category: MISSION_CATEGORIES.EXPLORATION,
    name: 'Event Participant',
    description: 'Join {target} live events or stages',
    emoji: '🎤',
    targets: { easy: 1, medium: 2, hard: 4 },
    trackingKey: 'events_joined',
    rewards: { stamps: ['stage_performer'], points: null }
  },

  // Engagement Missions
  engagement_time_spent: {
    id: 'engagement_time_spent',
    category: MISSION_CATEGORIES.ENGAGEMENT,
    name: 'Community Member',
    description: 'Spend {target} minutes actively engaging',
    emoji: '⏰',
    targets: { easy: 15, medium: 45, hard: 90 },
    trackingKey: 'active_time',
    rewards: { stamps: ['party_animal'], points: null }
  },

  engagement_reactions: {
    id: 'engagement_reactions',
    category: MISSION_CATEGORIES.ENGAGEMENT,
    name: 'Reactor',
    description: 'React to {target} posts or messages',
    emoji: '👍',
    targets: { easy: 5, medium: 15, hard: 30 },
    trackingKey: 'reactions_given',
    rewards: { stamps: [], points: null }
  },

  // Achievement Missions
  achievement_complete_profile: {
    id: 'achievement_complete_profile',
    category: MISSION_CATEGORIES.ACHIEVEMENT,
    name: 'Profile Perfect',
    description: 'Complete your profile with bio and photo',
    emoji: '✨',
    targets: { easy: 1, medium: 1, hard: 1 },
    trackingKey: 'profile_completed',
    rewards: { stamps: [], points: null }
  },

  achievement_stamp_collector: {
    id: 'achievement_stamp_collector',
    category: MISSION_CATEGORIES.ACHIEVEMENT,
    name: 'Stamp Collector',
    description: 'Earn {target} new stamps today',
    emoji: '🏆',
    targets: { easy: 1, medium: 3, hard: 5 },
    trackingKey: 'stamps_earned',
    rewards: { stamps: [], points: null }
  }
};

// Daily mission rewards beyond base points
const DAILY_COMPLETION_REWARDS = {
  ALL_EASY_COMPLETED: { points: 20, stamps: ['daily_warrior'] },
  ALL_MEDIUM_COMPLETED: { points: 50, stamps: ['daily_champion'] },
  ALL_HARD_COMPLETED: { points: 100, stamps: ['daily_legend'] },
  ALL_COMPLETED: { points: 200, stamps: ['daily_completionist'] }
};

// =====================================================
// DAILY MISSIONS CORE CLASS
// =====================================================

class DailyMissions {
  constructor() {
    this.currentUser = null;
    this.todaysMissions = [];
    this.userProgress = {};
    this.isInitialized = false;
    this.todayKey = this.getTodayKey();
  }

  // Initialize the daily missions system
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.currentUser = await waitForAuth();
      if (this.currentUser) {
        await this.loadTodaysMissions();
        await this.loadUserProgress();
        this.isInitialized = true;
        console.log('✅ Daily Missions initialized for:', this.currentUser.displayName);
      }
    } catch (error) {
      console.error('❌ Error initializing Daily Missions:', error);
    }
  }

  // Get today's key for mission dating
  getTodayKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Generate today's missions
  async generateTodaysMissions() {
    console.log('🎯 Generating daily missions for', this.todayKey);
    
    const missions = [];
    const templateKeys = Object.keys(MISSION_TEMPLATES);
    
    // Select 6 diverse missions across categories
    const selectedMissions = this.selectDiverseMissions(templateKeys, 6);
    
    selectedMissions.forEach((templateKey, index) => {
      const template = MISSION_TEMPLATES[templateKey];
      const difficulty = this.assignDifficulty(index);
      const mission = this.createMissionFromTemplate(template, difficulty);
      missions.push(mission);
    });

    // Save to Firestore
    const dailyMissionsRef = doc(db, 'daily_missions', this.todayKey);
    await setDoc(dailyMissionsRef, {
      date: this.todayKey,
      missions: missions,
      createdAt: serverTimestamp()
    });

    this.todaysMissions = missions;
    console.log('✅ Generated', missions.length, 'missions for today');
    return missions;
  }

  // Select diverse missions across categories
  selectDiverseMissions(templateKeys, count) {
    const categories = Object.values(MISSION_CATEGORIES);
    const selected = [];
    const usedCategories = new Set();
    
    // First pass: One from each category
    categories.forEach(category => {
      const categoryTemplates = templateKeys.filter(key => 
        MISSION_TEMPLATES[key].category === category
      );
      if (categoryTemplates.length > 0) {
        const randomTemplate = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
        selected.push(randomTemplate);
        usedCategories.add(category);
      }
    });

    // Second pass: Fill remaining slots randomly
    while (selected.length < count && templateKeys.length > 0) {
      const remainingTemplates = templateKeys.filter(key => !selected.includes(key));
      if (remainingTemplates.length === 0) break;
      
      const randomTemplate = remainingTemplates[Math.floor(Math.random() * remainingTemplates.length)];
      selected.push(randomTemplate);
    }

    return selected.slice(0, count);
  }

  // Assign difficulty levels with progression
  assignDifficulty(index) {
    // Distribute difficulties: 3 easy, 2 medium, 1 hard
    if (index < 3) return 'easy';
    if (index < 5) return 'medium';
    return 'hard';
  }

  // Create mission object from template
  createMissionFromTemplate(template, difficulty) {
    const target = template.targets[difficulty];
    const basePoints = DIFFICULTY_LEVELS[difficulty.toUpperCase()].points;
    
    return {
      id: `${template.id}_${difficulty}_${this.todayKey}`,
      templateId: template.id,
      category: template.category,
      difficulty: difficulty,
      name: template.name,
      description: template.description.replace('{target}', target),
      emoji: template.emoji,
      target: target,
      trackingKey: template.trackingKey,
      points: basePoints,
      rewards: {
        stamps: template.rewards.stamps || [],
        points: basePoints
      },
      date: this.todayKey,
      createdAt: new Date().toISOString()
    };
  }

  // Load today's missions
  async loadTodaysMissions() {
    try {
      const dailyMissionsRef = doc(db, 'daily_missions', this.todayKey);
      const dailyMissionsDoc = await getDoc(dailyMissionsRef);
      
      if (dailyMissionsDoc.exists()) {
        this.todaysMissions = dailyMissionsDoc.data().missions;
        console.log('✅ Loaded', this.todaysMissions.length, 'missions for today');
      } else {
        // Generate new missions for today
        await this.generateTodaysMissions();
      }
    } catch (error) {
      console.error('❌ Error loading today\'s missions:', error);
      this.todaysMissions = [];
    }
  }

  // Load user's progress
  async loadUserProgress() {
    if (!this.currentUser?.uid) return;
    
    try {
      const progressRef = doc(db, 'user_mission_progress', `${this.currentUser.uid}_${this.todayKey}`);
      const progressDoc = await getDoc(progressRef);
      
      if (progressDoc.exists()) {
        this.userProgress = progressDoc.data().progress || {};
      } else {
        // Initialize progress for today
        this.userProgress = {};
        await this.initializeUserProgress();
      }
    } catch (error) {
      console.error('❌ Error loading user progress:', error);
      this.userProgress = {};
    }
  }

  // Initialize user progress for today
  async initializeUserProgress() {
    if (!this.currentUser?.uid) return;
    
    const initialProgress = {};
    this.todaysMissions.forEach(mission => {
      initialProgress[mission.id] = {
        current: 0,
        target: mission.target,
        completed: false,
        completedAt: null
      };
    });

    this.userProgress = initialProgress;
    
    try {
      const progressRef = doc(db, 'user_mission_progress', `${this.currentUser.uid}_${this.todayKey}`);
      await setDoc(progressRef, {
        userId: this.currentUser.uid,
        date: this.todayKey,
        progress: initialProgress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error initializing user progress:', error);
    }
  }

  // Update mission progress
  async updateMissionProgress(trackingKey, increment = 1, metadata = {}) {
    await this.initialize();
    
    if (!this.currentUser?.uid) return;

    let updated = false;
    
    // Update progress for missions that track this key
    this.todaysMissions.forEach(mission => {
      if (mission.trackingKey === trackingKey && !this.userProgress[mission.id]?.completed) {
        const progress = this.userProgress[mission.id] || { current: 0, target: mission.target, completed: false };
        progress.current = Math.min(progress.current + increment, mission.target);
        
        // Check if mission completed
        if (progress.current >= mission.target && !progress.completed) {
          progress.completed = true;
          progress.completedAt = new Date().toISOString();
          this.completeMission(mission, metadata);
        }
        
        this.userProgress[mission.id] = progress;
        updated = true;
      }
    });

    if (updated) {
      await this.saveUserProgress();
      this.checkDailyCompletion();
    }
  }

  // Complete a mission and award rewards
  async completeMission(mission, metadata = {}) {
    console.log('🎉 Mission completed:', mission.name);
    
    try {
      // Award points through PassportAPI (integrates with leaderboard)
      if (mission.rewards.stamps.length > 0) {
        for (const stampId of mission.rewards.stamps) {
          await PassportAPI.awardStamp(stampId, 'daily_missions', 'mission_completion', null);
        }
      }

      // Record mission completion activity
      await PassportAPI.recordTravel('daily_missions', 'mission_completed', {
        missionId: mission.id,
        missionName: mission.name,
        points: mission.points,
        difficulty: mission.difficulty,
        ...metadata
      });

      // Show completion notification
      this.showMissionCompletedNotification(mission);

    } catch (error) {
      console.error('❌ Error completing mission:', error);
    }
  }

  // Check if all daily missions completed
  checkDailyCompletion() {
    const totalMissions = this.todaysMissions.length;
    const completedMissions = Object.values(this.userProgress).filter(p => p.completed).length;
    
    if (completedMissions === totalMissions) {
      this.awardDailyCompletionRewards();
    }
  }

  // Award daily completion rewards
  async awardDailyCompletionRewards() {
    console.log('🏆 All daily missions completed!');
    
    try {
      // Count missions by difficulty
      const difficultyCount = { easy: 0, medium: 0, hard: 0 };
      this.todaysMissions.forEach(mission => {
        difficultyCount[mission.difficulty]++;
      });

      // Award completion bonuses
      let totalBonus = 0;
      const completionStamps = [];

      if (difficultyCount.easy === 3) {
        totalBonus += DAILY_COMPLETION_REWARDS.ALL_EASY_COMPLETED.points;
        completionStamps.push(...DAILY_COMPLETION_REWARDS.ALL_EASY_COMPLETED.stamps);
      }

      if (difficultyCount.medium >= 2) {
        totalBonus += DAILY_COMPLETION_REWARDS.ALL_MEDIUM_COMPLETED.points;
        completionStamps.push(...DAILY_COMPLETION_REWARDS.ALL_MEDIUM_COMPLETED.stamps);
      }

      if (difficultyCount.hard >= 1) {
        totalBonus += DAILY_COMPLETION_REWARDS.ALL_HARD_COMPLETED.points;
        completionStamps.push(...DAILY_COMPLETION_REWARDS.ALL_HARD_COMPLETED.stamps);
      }

      // All missions completed bonus
      totalBonus += DAILY_COMPLETION_REWARDS.ALL_COMPLETED.points;
      completionStamps.push(...DAILY_COMPLETION_REWARDS.ALL_COMPLETED.stamps);

      // Award unique stamps
      const uniqueStamps = [...new Set(completionStamps)];
      for (const stampId of uniqueStamps) {
        if (STAMP_DEFINITIONS[stampId]) {
          await PassportAPI.awardStamp(stampId, 'daily_missions', 'daily_completion_bonus', null);
        }
      }

      // Show daily completion notification
      this.showDailyCompletedNotification(totalBonus, uniqueStamps.length);

    } catch (error) {
      console.error('❌ Error awarding daily completion rewards:', error);
    }
  }

  // Save user progress to Firestore
  async saveUserProgress() {
    if (!this.currentUser?.uid) return;
    
    try {
      const progressRef = doc(db, 'user_mission_progress', `${this.currentUser.uid}_${this.todayKey}`);
      await updateDoc(progressRef, {
        progress: this.userProgress,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error saving user progress:', error);
    }
  }

  // Get missions with progress for display
  getMissionsWithProgress() {
    return this.todaysMissions.map(mission => ({
      ...mission,
      progress: this.userProgress[mission.id] || { current: 0, target: mission.target, completed: false }
    }));
  }

  // Show mission completion notification
  showMissionCompletedNotification(mission) {
    const notification = document.createElement('div');
    notification.className = 'mission-completed-toast';
    notification.innerHTML = `
      <div class="mission-completion-notification">
        <span class="mission-emoji">${mission.emoji}</span>
        <div class="mission-info">
          <div class="mission-name">Mission Complete!</div>
          <div class="mission-title">${mission.name}</div>
          <div class="mission-points">+${mission.points} points earned</div>
        </div>
      </div>
    `;
    
    this.styleNotification(notification, '#4CAF50');
    this.showNotification(notification);
  }

  // Show daily completion notification  
  showDailyCompletedNotification(bonusPoints, stampsEarned) {
    const notification = document.createElement('div');
    notification.className = 'daily-completed-toast';
    notification.innerHTML = `
      <div class="daily-completion-notification">
        <span class="daily-emoji">🏆</span>
        <div class="daily-info">
          <div class="daily-title">All Missions Complete!</div>
          <div class="daily-bonus">+${bonusPoints} bonus points</div>
          <div class="daily-stamps">${stampsEarned} new stamps earned</div>
        </div>
      </div>
    `;
    
    this.styleNotification(notification, '#FFD700');
    this.showNotification(notification, 5000);
  }

  // Style notification
  styleNotification(notification, accentColor) {
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, ${accentColor}20, ${accentColor}40);
      border: 2px solid ${accentColor};
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideInRight 0.4s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      max-width: 320px;
    `;
  }

  // Show notification with auto-remove
  showNotification(notification, duration = 4000) {
    // Add animation styles if not present
    if (!document.getElementById('mission-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'mission-notification-styles';
      styles.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .mission-completion-notification, .daily-completion-notification {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .mission-emoji, .daily-emoji { font-size: 24px; }
        .mission-info, .daily-info { flex: 1; }
        .mission-name, .daily-title { font-weight: 700; font-size: 16px; margin-bottom: 4px; }
        .mission-title { font-size: 14px; margin-bottom: 4px; }
        .mission-points, .daily-bonus, .daily-stamps { font-size: 12px; opacity: 0.9; }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Remove after duration
    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.4s ease-out reverse';
      setTimeout(() => notification.remove(), 400);
    }, duration);
  }

  // Get user's mission statistics
  async getUserMissionStats() {
    if (!this.currentUser?.uid) return null;

    try {
      // Get all user mission progress records
      const progressQuery = query(
        collection(db, 'user_mission_progress'),
        where('userId', '==', this.currentUser.uid)
      );
      
      const progressSnapshot = await getDocs(progressQuery);
      
      let totalMissionsCompleted = 0;
      let totalMissionsAssigned = 0;
      let streakCount = 0;
      let longestStreak = 0;
      let currentStreak = 0;
      const completionHistory = {};

      progressSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const progress = data.progress || {};
        const date = data.date;
        
        let dayMissionsCompleted = 0;
        let dayMissionsTotal = 0;
        
        Object.values(progress).forEach(missionProgress => {
          dayMissionsTotal++;
          if (missionProgress.completed) {
            dayMissionsCompleted++;
            totalMissionsCompleted++;
          }
        });
        
        totalMissionsAssigned += dayMissionsTotal;
        completionHistory[date] = {
          completed: dayMissionsCompleted,
          total: dayMissionsTotal,
          allCompleted: dayMissionsCompleted === dayMissionsTotal && dayMissionsTotal > 0
        };
      });

      // Calculate streaks
      const sortedDates = Object.keys(completionHistory).sort();
      let streakActive = true;
      
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        const date = sortedDates[i];
        const dayData = completionHistory[date];
        
        if (dayData.allCompleted) {
          if (streakActive) currentStreak++;
          streakCount++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          streakActive = false;
        }
      }

      return {
        totalMissionsCompleted,
        totalMissionsAssigned,
        completionRate: totalMissionsAssigned > 0 ? Math.round((totalMissionsCompleted / totalMissionsAssigned) * 100) : 0,
        currentStreak,
        longestStreak,
        daysParticipated: Object.keys(completionHistory).length
      };
    } catch (error) {
      console.error('❌ Error getting user mission stats:', error);
      return null;
    }
  }
}

// =====================================================
// GLOBAL API
// =====================================================

// Create global instance
const dailyMissions = new DailyMissions();

// API methods for integration with other systems
const DailyMissionsAPI = {
  // Initialize the system
  initialize: () => dailyMissions.initialize(),
  
  // Update mission progress (called from other systems)
  updateProgress: (trackingKey, increment, metadata) => 
    dailyMissions.updateMissionProgress(trackingKey, increment, metadata),
  
  // Get today's missions with progress
  getTodaysMissions: () => dailyMissions.getMissionsWithProgress(),
  
  // Get user statistics
  getUserStats: () => dailyMissions.getUserMissionStats(),
  
  // Check if system is initialized
  isInitialized: () => dailyMissions.isInitialized,
  
  // Get today's completion status
  getTodayCompletion: () => {
    const missions = dailyMissions.getMissionsWithProgress();
    const completed = missions.filter(m => m.progress.completed).length;
    return {
      completed,
      total: missions.length,
      percentage: missions.length > 0 ? Math.round((completed / missions.length) * 100) : 0
    };
  }
};

// Auto-initialize and expose globally
(async () => {
  window.DailyMissionsAPI = DailyMissionsAPI;
  console.log('🎯 Daily Missions API available globally');
})();

export default DailyMissionsAPI;
export { MISSION_CATEGORIES, DIFFICULTY_LEVELS, MISSION_TEMPLATES };