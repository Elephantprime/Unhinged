// Enhanced Arcade JavaScript with full Firebase integration
import { 
  getArcadePoints, 
  awardPoints, 
  getUserBadges, 
  getLeaderboard, 
  checkDailyStreak,
  submitMeme,
  voteMeme,
  getContestMemes,
  BADGE_DEFINITIONS,
  POINT_VALUES
} from '../js/arcade-helpers.js';

import { auth, getUserDoc } from '../js/firebase.js';
import '../js/passport-api.js'; // Load PassportAPI globally
import '../js/toast-notifications.js'; // Load toast notifications

// Import points display utility
import { addPointsToNavigation } from '../js/points-display.js';

let currentUser = null;
let currentGame = null;
let userPoints = null;
let userBadges = [];
let leaderboardUnsubscribe = null;
let currentTriviaQuestion = null;

// Enhanced game data with more content
const games = {
  'truth-dare': {
    title: 'Truth or Dare',
    questions: [
      "What's the most embarrassing thing on your phone?",
      "Who was your worst date and why?",
      "What's your biggest red flag in dating?",
      "If you could ghost anyone from your past, who would it be?",
      "What's the wildest place you've ever hooked up?",
      "What's your most toxic dating habit?",
      "Who in this room would you swipe right on?",
      "What's your biggest turn-off on a first date?",
      "Have you ever stalked an ex on social media recently?",
      "What's the worst pickup line you've ever used or received?",
      "What's your body count and are you honest about it?",
      "Who's the hottest person you've ever matched with?",
      "What's your most controversial dating opinion?",
      "Have you ever lied about your age on dating apps?",
      "What's the craziest thing you've done to get someone's attention?"
    ],
    dares: [
      "Send a flirty message to your last match",
      "Do your best impression of your ex",
      "Post a thirst trap (but make it chaotic)",
      "Rate everyone in this chat from 1-10",
      "Call your ex and hang up immediately",
      "Show your most recent dating app conversation",
      "Let someone else write your dating bio for 5 minutes",
      "Swipe on dating apps for 2 minutes with your eyes closed",
      "Text your crush something flirty right now",
      "Do a 30-second interpretive dance about your love life",
      "Show your most embarrassing photo",
      "Sing a love song to your phone",
      "Do your worst pickup line on camera",
      "Share your most unhinged dating story",
      "Act out your ideal first date scenario"
    ]
  },
  'would-rather': {
    title: 'Would You Rather',
    scenarios: [
      "Would you rather have your dating history made public or never be able to date again?",
      "Would you rather only be able to communicate through memes or only through voice notes?",
      "Would you rather date someone with your ex's personality or your ex's looks?",
      "Would you rather have amazing chemistry but terrible conversation or great conversation but no spark?",
      "Would you rather find true love but be broke forever or be rich but never find love?",
      "Would you rather your partner be 20 years older or 20 years younger?",
      "Would you rather have mind-reading powers in relationships or be able to forget any bad relationship?",
      "Would you rather only date people who are terrible at texting or people who text too much?",
      "Would you rather have your dream job but be single forever or have your soulmate but never work?",
      "Would you rather be able to see red flags immediately or never see them at all?",
      "Would you rather date someone who's always late or someone who's always early?",
      "Would you rather have your search history exposed or your DMs exposed?",
      "Would you rather only be able to date people shorter than you or taller than you?",
      "Would you rather have perfect looks but terrible personality or amazing personality but average looks?",
      "Would you rather know when you'll meet your soulmate or how your current relationship will end?"
    ]
  },
  'trivia': {
    title: 'Dating & Pop Culture Trivia',
    questions: [
      { q: "What year was Tinder launched?", a: "2012", options: ["2010", "2012", "2014", "2015"] },
      { q: "What does 'ghosting' mean in dating?", a: "Suddenly stopping all communication", options: ["Suddenly stopping all communication", "Dating multiple people", "Lying about your age", "Using old photos"] },
      { q: "Which dating app is known for women messaging first?", a: "Bumble", options: ["Tinder", "Bumble", "Hinge", "OkCupid"] },
      { q: "What's the most popular day for online dating?", a: "Sunday", options: ["Friday", "Saturday", "Sunday", "Monday"] },
      { q: "What percentage of relationships start online?", a: "40%", options: ["20%", "30%", "40%", "50%"] },
      { q: "What's considered the ideal first date length?", a: "1-2 hours", options: ["30 minutes", "1-2 hours", "4+ hours", "All day"] },
      { q: "Which generation uses dating apps the most?", a: "Gen Z", options: ["Millennials", "Gen Z", "Gen X", "Boomers"] },
      { q: "What's the #1 dating app deal-breaker?", a: "Poor grammar", options: ["Poor photos", "Poor grammar", "No bio", "Too many selfies"] },
      { q: "What does 'breadcrumbing' mean?", a: "Sending minimal texts to keep someone interested", options: ["Sending minimal texts to keep someone interested", "Eating on dates", "Posting food pics", "Being indecisive"] },
      { q: "What's 'cuffing season'?", a: "Fall/winter when people seek relationships", options: ["Spring dating rush", "Summer flings", "Fall/winter when people seek relationships", "Holiday breakups"] }
    ]
  }
};

// Casino game state
let casinoChips = 100;
let casinoStreak = 0;

// Initialize Enhanced Arcade
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎮 Enhanced Arcade initializing...');
  
  // Initialize points display
  addPointsToNavigation('.world-nav .nav-right', { position: 'prepend', size: 'medium' });
  
  setupGameButtons();
  setupLeaderboards();
  setupBadgeUnlockListener();
  
  // Check for user authentication
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(user => {
      if (user) {
        loadUserProfile(user);
      } else {
        setupDemoUser();
      }
    });
  } else {
    setupDemoUser();
  }
});

// Load user profile with arcade data
async function loadUserProfile(user) {
  try {
    const userDoc = await getUserDoc(user.uid);
    const userData = userDoc || {};
    
    // Use AvatarUtils for consistent avatar loading
    if (window.AvatarUtils) {
      currentUser = await window.AvatarUtils.buildUserObject(userData, user);
    } else {
      currentUser = {
        uid: user.uid,
        name: userData.displayName || userData.name || 'Anonymous',
        avatar: userData.photoURL || window.AvatarUtils?.generateUniqueAvatar?.(user.uid) || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#1a1b22"/><circle cx="40" cy="30" r="16" fill="#2a2a2a"/><path d="M 15 65 Q 15 50 25 45 Q 32.5 40 40 40 Q 47.5 40 55 45 Q 65 50 65 65 L 65 80 L 15 80 Z" fill="#2a2a2a"/></svg>')
      };
    }
    
    // Load arcade-specific data
    await loadArcadeData();
    
    // Check daily streak
    await checkDailyStreak(user.uid);
    
    // Track arcade visit for passport
    if (typeof window.PassportAPI !== 'undefined') {
      window.PassportAPI.recordTravel('arcade', 'Entered arcade');
      window.PassportAPI.checkLocationStamps('arcade');
    }
    
    console.log('✅ Enhanced Arcade loaded for:', currentUser.name);
  } catch (error) {
    console.error('❌ Error loading user profile:', error);
    setupDemoUser();
  }
}

// Load arcade data (points, badges, leaderboards)
async function loadArcadeData() {
  if (!currentUser?.uid) return;
  
  try {
    // Load user points
    userPoints = await getArcadePoints(currentUser.uid);
    
    // Load user badges
    userBadges = await getUserBadges(currentUser.uid);
    
    // Update UI with points and badges
    updatePointsDisplay();
    updateBadgesDisplay();
    
    // Load real leaderboards
    loadRealLeaderboard('overall');
    
  } catch (error) {
    console.error('❌ Error loading arcade data:', error);
  }
}

// Update points display in UI
function updatePointsDisplay() {
  if (!userPoints) return;
  
  // Add points display to header if not exists
  let pointsDisplay = document.getElementById('points-display');
  if (!pointsDisplay) {
    const header = document.querySelector('.arcade-header');
    if (header) {
      pointsDisplay = document.createElement('div');
      pointsDisplay.id = 'points-display';
      pointsDisplay.style.cssText = `
        background: linear-gradient(45deg, #ffd700, #ff8c00);
        color: #000;
        padding: 10px 20px;
        border-radius: 25px;
        margin: 10px auto;
        font-weight: bold;
        display: inline-block;
      `;
      header.appendChild(pointsDisplay);
    }
  }
  
  if (pointsDisplay) {
    pointsDisplay.innerHTML = `
      <span data-testid="points-counter">💰 ${userPoints.totalPoints || 0} Points</span>
      <span style="margin-left: 15px;" data-testid="streak-display">🔥 ${userPoints.streakDays || 0} Day Streak</span>
    `;
  }
}

// Update badges display
function updateBadgesDisplay() {
  if (!userBadges.length) return;
  
  let badgesDisplay = document.getElementById('badges-display');
  if (!badgesDisplay) {
    const header = document.querySelector('.arcade-header');
    if (header) {
      badgesDisplay = document.createElement('div');
      badgesDisplay.id = 'badges-display';
      badgesDisplay.style.cssText = `
        margin: 10px auto;
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      `;
      header.appendChild(badgesDisplay);
    }
  }
  
  if (badgesDisplay) {
    badgesDisplay.innerHTML = userBadges.map(badge => `
      <span style="background: rgba(255,255,255,0.1); padding: 5px 10px; border-radius: 15px; font-size: 14px;" title="${badge.description}" data-testid="badge-${badge.id}">
        ${badge.icon} ${badge.name}
      </span>
    `).join('');
  }
}

// Setup badge unlock listener
function setupBadgeUnlockListener() {
  window.addEventListener('badgeUnlocked', (event) => {
    const { badges } = event.detail;
    showBadgeUnlockAnimation(badges);
  });
}

// Show badge unlock animation
function showBadgeUnlockAnimation(badges) {
  badges.forEach((badge, index) => {
    setTimeout(() => {
      // Create achievement popup
      const popup = document.createElement('div');
      popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #ffd700, #ff8c00);
        color: #000;
        padding: 20px;
        border-radius: 15px;
        z-index: 10000;
        animation: badgeUnlock 3s ease-in-out;
        text-align: center;
        box-shadow: 0 10px 30px rgba(255, 215, 0, 0.5);
      `;
      
      popup.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">🎉 Achievement Unlocked!</h3>
        <div style="font-size: 2rem; margin: 10px 0;">${badge.icon}</div>
        <div style="font-weight: bold; margin-bottom: 5px;">${badge.name}</div>
        <div style="font-size: 14px; opacity: 0.8;">${badge.description}</div>
        <div style="margin-top: 10px; font-size: 12px;">+${badge.points} Bonus Points!</div>
      `;
      
      document.body.appendChild(popup);
      
      // Remove popup after animation
      setTimeout(() => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
        updateBadgesDisplay(); // Update badges display
      }, 3000);
    }, index * 1000);
  });
}

// Demo user setup
function setupDemoUser() {
  currentUser = {
    uid: 'demo',
    name: 'Demo Player',
    avatar: 'https://i.pravatar.cc/50'
  };
  
  // Setup demo data
  userPoints = { totalPoints: 150, streakDays: 3 };
  userBadges = [BADGE_DEFINITIONS['first-game']];
  
  updatePointsDisplay();
  updateBadgesDisplay();
  loadRealLeaderboard('overall');
}

// Setup game buttons
function setupGameButtons() {
  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const gameType = this.dataset.game;
      startGame(gameType);
    });
  });
  
  const exitBtn = document.getElementById('exit-game');
  if (exitBtn) {
    exitBtn.addEventListener('click', exitGame);
  }
  
  // Setup event delegation for dynamically created game buttons
  const gameContent = document.getElementById('game-content');
  if (gameContent) {
    gameContent.addEventListener('click', handleGameButtonClick);
  }
}

// Handle all button clicks within game content using event delegation
function handleGameButtonClick(event) {
  if (!event.target.matches('button')) return;
  
  const button = event.target;
  const action = button.dataset.action;
  const param = button.dataset.param;
  
  switch (action) {
    case 'get-truth':
      getTruthEnhanced();
      break;
    case 'get-dare':
      getDareEnhanced();
      break;
    case 'complete-truth-dare':
      completeTruthDare();
      break;
    case 'answer-would-rather':
      answerWouldRather(param);
      break;
    case 'new-scenario':
      getNewScenarioEnhanced();
      break;
    case 'roll-dice':
      rollDiceEnhanced();
      break;
    case 'play-blackjack':
      playBlackjackEnhanced();
      break;
    case 'get-trivia':
      getTriviaEnhanced();
      break;
    case 'answer-trivia':
      answerTrivia(param);
      break;
    case 'submit-meme':
      submitMemeEnhanced();
      break;
    case 'vote-meme':
      voteMemeUI(param);
      break;
    case 'start-hotseat':
      startHotSeatEnhanced();
      break;
  }
}

// Award points and update displays
async function awardPointsAndUpdate(pointType, gameType, additionalData = {}) {
  if (!currentUser?.uid) return;
  
  const pointsEarned = await awardPoints(currentUser.uid, pointType, gameType, additionalData);
  
  if (pointsEarned > 0) {
    // Reload user points
    userPoints = await getArcadePoints(currentUser.uid);
    updatePointsDisplay();
    
    // Show points animation
    showPointsAnimation(pointsEarned);
    
    // Reload leaderboards
    loadRealLeaderboard('overall');
  }
}

// Show points earned animation
function showPointsAnimation(points) {
  const pointsEl = document.createElement('div');
  pointsEl.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: #2ecc71;
    color: white;
    padding: 10px 20px;
    border-radius: 25px;
    z-index: 9999;
    animation: pointsEarned 2s ease-out;
    font-weight: bold;
  `;
  pointsEl.textContent = `+${points} Points!`;
  
  document.body.appendChild(pointsEl);
  
  setTimeout(() => {
    if (pointsEl.parentNode) {
      pointsEl.parentNode.removeChild(pointsEl);
    }
  }, 2000);
}

// Enhanced Truth or Dare game
function setupTruthOrDare(titleEl, contentEl) {
  titleEl.textContent = '🎯 Truth or Dare';
  
  contentEl.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h3 style="margin-bottom: 20px; color: #ffd700;">Choose Your Fate</h3>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
        <div style="color: #ffd700; font-size: 14px;">Earn ${POINT_VALUES.TRUTH_DARE_COMPLETE} points per completion!</div>
      </div>
      <div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 30px;">
        <button data-action="get-truth" data-testid="button-truth" style="background: #4ecdc4; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 18px; transition: transform 0.2s;">Truth</button>
        <button data-action="get-dare" data-testid="button-dare" style="background: #ff6b9d; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 18px; transition: transform 0.2s;">Dare</button>
      </div>
      <div id="truth-dare-result" style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; min-height: 100px; display: flex; align-items: center; justify-content: center;">
        <p style="color: #bbb; font-style: italic;">Click Truth or Dare to get started!</p>
      </div>
      <div id="completion-area" style="margin-top: 20px; text-align: center; display: none;">
        <button data-action="complete-truth-dare" data-testid="button-complete-truth-dare" style="background: #2ecc71; color: white; border: none; padding: 12px 25px; border-radius: 20px; cursor: pointer;">Complete Challenge</button>
      </div>
    </div>
  `;
}

// Enhanced Truth function
function getTruthEnhanced() {
  const questions = games['truth-dare'].questions;
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  
  document.getElementById('truth-dare-result').innerHTML = `
    <div style="text-align: center;">
      <h4 style="color: #4ecdc4; margin-bottom: 15px;" data-testid="truth-question">💬 Truth</h4>
      <p style="font-size: 18px; line-height: 1.5;">${randomQuestion}</p>
    </div>
  `;
  
  document.getElementById('completion-area').style.display = 'block';
}

// Enhanced Dare function
function getDareEnhanced() {
  const dares = games['truth-dare'].dares;
  const randomDare = dares[Math.floor(Math.random() * dares.length)];
  
  document.getElementById('truth-dare-result').innerHTML = `
    <div style="text-align: center;">
      <h4 style="color: #ff6b9d; margin-bottom: 15px;" data-testid="dare-challenge">😈 Dare</h4>
      <p style="font-size: 18px; line-height: 1.5;">${randomDare}</p>
    </div>
  `;
  
  document.getElementById('completion-area').style.display = 'block';
}

// Complete Truth or Dare challenge
async function completeTruthDare() {
  await awardPointsAndUpdate('TRUTH_DARE_COMPLETE', 'truth-dare');
  
  // Track for passport stamps
  if (typeof window.PassportAPI !== 'undefined') {
    userTruthDareCount++;
    if (userTruthDareCount >= 10) {
      window.PassportAPI.awardStamp('truth_teller', 'arcade', 'Completed 10 Truth or Dare challenges');
    }
  }
  
  document.getElementById('completion-area').innerHTML = `
    <div style="color: #2ecc71; font-weight: bold;" data-testid="challenge-completed">
      ✅ Challenge Completed! +${POINT_VALUES.TRUTH_DARE_COMPLETE} points
    </div>
  `;
  
  setTimeout(() => {
    document.getElementById('completion-area').style.display = 'none';
  }, 3000);
}

// Enhanced Would You Rather
function setupWouldYouRather(titleEl, contentEl) {
  titleEl.textContent = '🤔 Would You Rather';
  
  const scenarios = games['would-rather'].scenarios;
  const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  contentEl.innerHTML = `
    <div style="max-width: 700px; margin: 0 auto; text-align: center;">
      <h3 style="margin-bottom: 20px; color: #ffd700;">Choose Wisely...</h3>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
        <div style="color: #ffd700; font-size: 14px;">Earn ${POINT_VALUES.PLAY_GAME} points per scenario!</div>
      </div>
      <div id="scenario-display" style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; margin-bottom: 30px;">
        <p style="font-size: 20px; line-height: 1.6;" data-testid="scenario-text">${randomScenario}</p>
      </div>
      <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 20px;">
        <button data-action="answer-would-rather" data-param="A" data-testid="button-option-a" style="background: #45b7d1; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">Option A</button>
        <button data-action="answer-would-rather" data-param="B" data-testid="button-option-b" style="background: #e74c3c; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">Option B</button>
      </div>
      <button data-action="new-scenario" data-testid="button-new-scenario" style="background: #45b7d1; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">Get New Scenario</button>
    </div>
  `;
}

// Answer Would You Rather
async function answerWouldRather(choice) {
  await awardPointsAndUpdate('PLAY_GAME', 'would-rather', { choice });
  
  const scenarioDisplay = document.getElementById('scenario-display');
  scenarioDisplay.innerHTML += `
    <div style="margin-top: 15px; color: #2ecc71; font-weight: bold;" data-testid="choice-made">
      ✅ You chose ${choice}! +${POINT_VALUES.PLAY_GAME} points
    </div>
  `;
}

// Get new scenario (enhanced)
async function getNewScenarioEnhanced() {
  const scenarios = games['would-rather'].scenarios;
  const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  const scenarioText = document.querySelector('[data-testid="scenario-text"]');
  if (scenarioText) {
    scenarioText.textContent = randomScenario;
  }
  
  await awardPointsAndUpdate('PLAY_GAME', 'would-rather');
}

// Enhanced Casino game
function setupCasino(titleEl, contentEl) {
  titleEl.textContent = '🎰 Mini Casino';
  
  contentEl.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; text-align: center;">
      <h3 style="margin-bottom: 20px; color: #ffd700;">Welcome to the Casino!</h3>
      <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <span data-testid="casino-chips">💰 Chips: ${casinoChips}</span>
          <span data-testid="casino-streak">🔥 Streak: ${casinoStreak}</span>
        </div>
        <div style="color: #ffd700; font-size: 14px;">Win big for bonus points!</div>
      </div>
      <div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 20px;">
        <button data-action="roll-dice" data-testid="button-roll-dice" style="background: #ff6b00; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">🎲 Roll Dice</button>
        <button data-action="play-blackjack" data-testid="button-blackjack" style="background: #e74c3c; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">🃏 Blackjack</button>
      </div>
      <div id="casino-result" style="margin-top: 20px; font-size: 18px; min-height: 50px;"></div>
    </div>
  `;
}

// Enhanced dice rolling
async function rollDiceEnhanced() {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const total = dice1 + dice2;
  const isWin = total >= 8;
  
  if (isWin) {
    casinoChips += 20;
    casinoStreak++;
    await awardPointsAndUpdate('CASINO_WIN', 'casino', { diceTotal: total });
  } else {
    casinoChips = Math.max(0, casinoChips - 10);
    casinoStreak = 0;
    await awardPointsAndUpdate('PLAY_GAME', 'casino', { diceTotal: total });
  }
  
  // Check for big win achievement
  if (total === 12) {
    await awardPointsAndUpdate('CASINO_WIN', 'casino', { achievement: 'snake_eyes', bigWin: true });
  }
  
  document.getElementById('casino-result').innerHTML = `
    <div>
      <h4 style="color: #ffd700;" data-testid="dice-result">🎲 ${dice1} + ${dice2} = ${total}</h4>
      <p data-testid="dice-outcome">${isWin ? '🎉 Winner! +20 chips!' : '💸 Lost 10 chips'}</p>
      ${total === 12 ? '<p style="color: #ffd700;">🎯 DOUBLE SIXES! Bonus points!</p>' : ''}
    </div>
  `;
  
  // Update chip display
  updateCasinoDisplay();
}

// Enhanced blackjack
async function playBlackjackEnhanced() {
  const playerCard1 = Math.floor(Math.random() * 10) + 1;
  const playerCard2 = Math.floor(Math.random() * 10) + 1;
  const dealerCard = Math.floor(Math.random() * 10) + 1;
  const playerTotal = playerCard1 + playerCard2;
  
  let isWin = false;
  let result = '';
  
  if (playerTotal === 21) {
    isWin = true;
    result = '🎉 BLACKJACK! You win!';
    casinoChips += 50;
    casinoStreak++;
    await awardPointsAndUpdate('CASINO_WIN', 'casino', { blackjack: true });
  } else if (playerTotal > 21) {
    result = '💥 Bust! House wins!';
    casinoChips = Math.max(0, casinoChips - 15);
    casinoStreak = 0;
    await awardPointsAndUpdate('PLAY_GAME', 'casino', { bust: true });
  } else {
    const dealerWins = dealerCard > playerTotal || (dealerCard === playerTotal && Math.random() > 0.5);
    if (!dealerWins) {
      isWin = true;
      result = '🎯 You win!';
      casinoChips += 25;
      casinoStreak++;
      await awardPointsAndUpdate('CASINO_WIN', 'casino');
    } else {
      result = '🎰 Dealer wins!';
      casinoChips = Math.max(0, casinoChips - 15);
      casinoStreak = 0;
      await awardPointsAndUpdate('PLAY_GAME', 'casino');
    }
  }
  
  document.getElementById('casino-result').innerHTML = `
    <div>
      <h4 style="color: #ffd700;" data-testid="blackjack-cards">🃏 Your Cards: ${playerCard1} + ${playerCard2} = ${playerTotal}</h4>
      <h4 data-testid="dealer-card">🎰 Dealer Card: ${dealerCard}</h4>
      <p data-testid="blackjack-result">${result}</p>
    </div>
  `;
  
  updateCasinoDisplay();
}

// Update casino display
function updateCasinoDisplay() {
  const chipsEl = document.querySelector('[data-testid="casino-chips"]');
  const streakEl = document.querySelector('[data-testid="casino-streak"]');
  
  if (chipsEl) chipsEl.textContent = `💰 Chips: ${casinoChips}`;
  if (streakEl) streakEl.textContent = `🔥 Streak: ${casinoStreak}`;
}

// Enhanced Trivia game
function setupTrivia(titleEl, contentEl) {
  titleEl.textContent = '🧠 Trivia & Polls';
  
  contentEl.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; text-align: center;">
      <h3 style="margin-bottom: 20px; color: #ffd700;">Trivia Challenge!</h3>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
        <div style="color: #ffd700; font-size: 14px;">Correct answers: +${POINT_VALUES.TRIVIA_CORRECT} points</div>
      </div>
      <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px;">
        <p style="font-size: 18px; margin-bottom: 30px;">Test your knowledge with dating & pop culture questions!</p>
        <button data-action="get-trivia" data-testid="button-get-trivia" style="background: #3498db; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">🧠 Get Question</button>
        <div id="trivia-result" style="margin-top: 30px; font-size: 16px; min-height: 100px;"></div>
      </div>
    </div>
  `;
}

// Enhanced trivia function
function getTriviaEnhanced() {
  const questions = games['trivia'].questions;
  currentTriviaQuestion = questions[Math.floor(Math.random() * questions.length)];
  
  document.getElementById('trivia-result').innerHTML = `
    <div>
      <h4 style="color: #3498db; margin-bottom: 20px;" data-testid="trivia-question">❓ ${currentTriviaQuestion.q}</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        ${currentTriviaQuestion.options.map((option, index) => `
          <button data-action="answer-trivia" data-param="${option}" data-testid="trivia-option-${index}" style="background: #45b7d1; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 14px;">${option}</button>
        `).join('')}
      </div>
      <div id="trivia-answer" style="margin-top: 15px;"></div>
    </div>
  `;
}

// Answer trivia question
async function answerTrivia(answer) {
  const isCorrect = answer === currentTriviaQuestion.a;
  
  if (isCorrect) {
    await awardPointsAndUpdate('TRIVIA_CORRECT', 'trivia', { correct: true });
  } else {
    await awardPointsAndUpdate('PLAY_GAME', 'trivia', { correct: false });
  }
  
  document.getElementById('trivia-answer').innerHTML = `
    <div style="background: rgba(${isCorrect ? '46, 204, 113' : '231, 76, 60'}, 0.2); padding: 15px; border-radius: 10px;" data-testid="trivia-result">
      <h4 style="color: ${isCorrect ? '#2ecc71' : '#e74c3c'};">
        ${isCorrect ? '✅ Correct!' : '❌ Wrong!'} 
      </h4>
      <p>Answer: ${currentTriviaQuestion.a}</p>
      <p style="font-size: 14px; margin-top: 10px;">
        ${isCorrect ? `+${POINT_VALUES.TRIVIA_CORRECT} points!` : `+${POINT_VALUES.PLAY_GAME} points for trying!`}
      </p>
    </div>
  `;
}

// Full Meme Contest Implementation
function setupMemeContest(titleEl, contentEl) {
  titleEl.textContent = '😂 Meme Contest';
  
  contentEl.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      <h3 style="margin-bottom: 20px; color: #ffd700; text-align: center;">Weekly Meme Contest!</h3>
      
      <!-- Submission Area -->
      <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin-bottom: 30px;">
        <h4 style="color: #f39c12; margin-bottom: 15px;">📷 Submit Your Meme</h4>
        <div style="margin-bottom: 15px;">
          <input type="file" id="meme-file" accept="image/*" data-testid="input-meme-file" style="margin-bottom: 10px; padding: 8px; border-radius: 5px; background: rgba(255,255,255,0.1); color: white; border: 1px solid #555;">
        </div>
        <div style="margin-bottom: 15px;">
          <input type="text" id="meme-caption" placeholder="Add a caption..." data-testid="input-meme-caption" style="width: 100%; padding: 10px; border-radius: 5px; background: rgba(255,255,255,0.1); color: white; border: 1px solid #555;">
        </div>
        <button data-action="submit-meme" data-testid="button-submit-meme" style="background: #f39c12; color: white; border: none; padding: 12px 25px; border-radius: 20px; cursor: pointer;">Submit Meme (+${POINT_VALUES.MEME_SUBMISSION} points)</button>
      </div>
      
      <!-- Contest Memes -->
      <div id="contest-memes">
        <h4 style="color: #ffd700; margin-bottom: 15px; text-align: center;">🏆 This Week's Submissions</h4>
        <div id="memes-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
          Loading contest memes...
        </div>
      </div>
    </div>
  `;
  
  // Load current contest memes
  loadContestMemesUI();
}

// Submit meme (enhanced)
async function submitMemeEnhanced() {
  const fileInput = document.getElementById('meme-file');
  const captionInput = document.getElementById('meme-caption');
  
  if (!fileInput.files[0]) {
    window.toast.warning('Please select an image file!');
    return;
  }
  
  const file = fileInput.files[0];
  const caption = captionInput.value.trim();
  
  if (!currentUser?.uid) {
    window.toast.info('Please log in to submit memes!');
    return;
  }
  
  try {
    // In a real implementation, this would upload to Firebase Storage
    // For now, we'll use a local object URL
    const memeId = await submitMeme(currentUser.uid, file, caption);
    
    if (memeId) {
      await awardPointsAndUpdate('MEME_SUBMISSION', 'meme-contest');
      
      // Track for passport stamps
      if (typeof window.PassportAPI !== 'undefined') {
        userMemeSubmissions++;
        if (userMemeSubmissions >= 5) {
          window.PassportAPI.awardStamp('meme_lord', 'arcade', 'Submitted 5 memes to contests');
        }
      }
      
      // Clear form
      fileInput.value = '';
      captionInput.value = '';
      
      // Reload memes
      loadContestMemesUI();
      
      // Show success message
      const submitButton = document.querySelector('[data-testid="button-submit-meme"]');
      submitButton.innerHTML = '✅ Submitted!';
      setTimeout(() => {
        submitButton.innerHTML = `Submit Meme (+${POINT_VALUES.MEME_SUBMISSION} points)`;
      }, 2000);
    }
  } catch (error) {
    console.error('Error submitting meme:', error);
    window.toast.error('Error submitting meme. Please try again.');
  }
}

// Load contest memes UI
async function loadContestMemesUI() {
  const memesList = document.getElementById('memes-list');
  if (!memesList) return;
  
  try {
    const memes = await getContestMemes();
    
    if (memes.length === 0) {
      memesList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 40px;">
          <div style="font-size: 3rem; margin-bottom: 15px;">🚧</div>
          <p>No memes submitted yet this week!</p>
          <p style="font-size: 14px; margin-top: 10px;">Be the first to submit and earn bonus points!</p>
        </div>
      `;
      return;
    }
    
    memesList.innerHTML = memes.map(meme => `
      <div style="background: rgba(255,255,255,0.05); border-radius: 15px; padding: 15px; text-align: center;">
        <img src="${meme.imageUrl}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 10px;" alt="Meme">
        <div style="color: #eee; margin-bottom: 10px;">${meme.caption || 'No caption'}</div>
        <div style="color: #888; font-size: 12px; margin-bottom: 15px;">by ${meme.submitterName}</div>
        <div style="display: flex; justify-content: center; gap: 10px;">
          <button data-action="vote-meme" data-param="${meme.id}" data-testid="button-vote-${meme.id}" style="background: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 15px; cursor: pointer; font-size: 14px;">
            👍 ${meme.totalVotes || 0}
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading contest memes:', error);
    memesList.innerHTML = '<div style="color: #888; text-align: center;">Error loading memes.</div>';
  }
}

// Vote on meme (UI function)
async function voteMemeUI(memeId) {
  if (!currentUser?.uid) {
    window.toast.info('Please log in to vote!');
    return;
  }
  
  try {
    const success = await voteMeme(memeId, currentUser.uid);
    if (success) {
      // Reload memes to show updated vote count
      loadContestMemesUI();
    }
  } catch (error) {
    console.error('Error voting on meme:', error);
  }
}

// Enhanced Hot Seat setup
function setupHotSeat(titleEl, contentEl) {
  titleEl.textContent = '🔥 Hot Seat';
  
  contentEl.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; text-align: center;">
      <h3 style="margin-bottom: 20px; color: #ffd700;">Hot Seat Challenge!</h3>
      <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px;">
        <p style="font-size: 18px; margin-bottom: 30px;">60 seconds of rapid-fire questions!</p>
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
          <div style="color: #ffd700; font-size: 14px;">Coming soon with multiplayer support!</div>
        </div>
        <button data-action="start-hotseat" data-testid="button-hot-seat" style="background: #e74c3c; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-size: 16px;">🔥 Take the Seat</button>
        <div id="hotseat-result" style="margin-top: 30px; font-size: 16px;">Ready for the challenge? 💪</div>
      </div>
    </div>
  `;
}

// Enhanced Hot Seat (placeholder for future implementation)
function startHotSeatEnhanced() {
  document.getElementById('hotseat-result').innerHTML = `
    <div style="color: #ffd700;">
      🚧 Hot Seat multiplayer feature launching soon!<br>
      <span style="font-size: 14px; color: #888;">This will include real-time questions and competitive scoring!</span>
    </div>
  `;
}

// Start a game
function startGame(gameType) {
  console.log(`🎯 Starting game: ${gameType}`);
  
  const gameArea = document.getElementById('game-area');
  const gameTitle = document.getElementById('current-game-title');
  const gameContent = document.getElementById('game-content');
  
  if (!gameArea || !gameTitle || !gameContent) {
    console.error('❌ Game area elements not found');
    return;
  }
  
  currentGame = gameType;
  gameArea.style.display = 'block';
  
  // Scroll to game area
  gameArea.scrollIntoView({ behavior: 'smooth' });
  
  // Award points for starting any game (first time bonus)
  if (currentUser?.uid && userPoints?.gamesPlayed === 0) {
    awardPointsAndUpdate('FIRST_GAME', gameType);
  } else if (currentUser?.uid) {
    awardPointsAndUpdate('PLAY_GAME', gameType);
  }
  
  switch (gameType) {
    case 'truth-dare':
      setupTruthOrDare(gameTitle, gameContent);
      break;
    case 'would-rather':
      setupWouldYouRather(gameTitle, gameContent);
      break;
    case 'trivia':
      setupTrivia(gameTitle, gameContent);
      break;
    case 'memes':
      setupMemeContest(gameTitle, gameContent);
      break;
    case 'casino':
      setupCasino(gameTitle, gameContent);
      break;
    case 'hotseat':
      setupHotSeat(gameTitle, gameContent);
      break;
    default:
      setupComingSoon(gameTitle, gameContent, gameType);
  }
}

// Exit game
function exitGame() {
  const gameArea = document.getElementById('game-area');
  if (gameArea) {
    gameArea.style.display = 'none';
  }
  currentGame = null;
  console.log('🚪 Exited game');
}

// Coming soon placeholder
function setupComingSoon(titleEl, contentEl, gameType) {
  const gameNames = {
    unknown: '🎮 Mystery Game'
  };
  
  titleEl.textContent = gameNames[gameType] || 'Game';
  
  contentEl.innerHTML = `
    <div style="text-align: center;">
      <h3 style="color: #ffd700; margin-bottom: 20px;">Coming Soon!</h3>
      <p style="color: #bbb; margin-bottom: 30px;">This game is under development and will be available soon.</p>
      <div style="font-size: 4rem; margin-bottom: 20px;">🚧</div>
      <p style="color: #888;">Stay tuned for chaotic fun!</p>
    </div>
  `;
}

// Setup leaderboards with real data
function setupLeaderboards() {
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Load leaderboard for category
      const category = this.dataset.category;
      loadRealLeaderboard(category);
    });
  });
}

// Load real leaderboard with Firebase data
async function loadRealLeaderboard(category) {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;
  
  try {
    listEl.innerHTML = '<div style="text-align: center; color: #888;">Loading leaderboard...</div>';
    
    const leaderboardData = await getLeaderboard(category, 10);
    
    if (leaderboardData.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: #888; padding: 20px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">🏆</div>
          <p>No players yet in this category!</p>
          <p style="font-size: 14px; margin-top: 5px;">Be the first to play and claim the top spot!</p>
        </div>
      `;
      return;
    }
    
    const units = {
      overall: 'points',
      'truth-dare': 'points',
      casino: 'points',
      memes: 'points',
      trivia: 'points'
    };
    
    listEl.innerHTML = leaderboardData.map((entry, index) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: rgba(255,255,255,0.05); margin-bottom: 8px; border-radius: 10px; border-left: 3px solid ${index < 3 ? '#ffd700' : '#555'};" data-testid="leaderboard-entry-${index}">
        <div style="display: flex; align-items: center; gap: 15px;">
          <span style="color: ${index < 3 ? '#ffd700' : '#bbb'}; font-weight: bold; min-width: 30px; font-size: 18px;">
            ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
          </span>
          <img src="${entry.avatar}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid ${index < 3 ? '#ffd700' : '#555'};" alt="${entry.name}">
          <div>
            <div style="color: #eee; font-weight: bold;">${entry.name}</div>
            <div style="color: #888; font-size: 12px;">${entry.gamesPlayed || 0} games played</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="color: ${index < 3 ? '#ffd700' : '#888'}; font-weight: bold; font-size: 16px;">
            ${entry.totalPoints} ${units[category] || 'points'}
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('❌ Error loading leaderboard:', error);
    listEl.innerHTML = '<div style="color: #e74c3c; text-align: center;">Error loading leaderboard</div>';
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pointsEarned {
    0% { transform: translateX(-50%) translateY(0); opacity: 1; }
    100% { transform: translateX(-50%) translateY(-50px); opacity: 0; }
  }
  
  @keyframes badgeUnlock {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  
  .play-btn:hover, button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.3);
  }
`;
document.head.appendChild(style);

// Functions are now properly handled via event delegation - no global assignments needed

console.log('✅ Enhanced Arcade system loaded with full Firebase integration!');