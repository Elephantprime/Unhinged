// Casualties of Modern Dating Manager
// =====================================================
// Manages dating horror stories, red flags, and casualties
// with Firebase integration and real-time updates
// =====================================================

import { 
  auth, 
  db, 
  waitForAuth, 
  getUserDoc, 
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
  getDocs
} from "./firebase.js";

import {
  safeGetById,
  safeSetInnerHTML,
  safeSetTextContent,
  safeAddEventListener
} from "./safe-dom-utils.js";

// =====================================================
// CASUALTY DATA STRUCTURE
// =====================================================

// Sample casualty stories for initial content
const SAMPLE_CASUALTIES = [
  {
    id: "ghost-after-engagement",
    title: "Ghosted After 6 Month Engagement",
    category: "ghosting",
    severity: "brutal",
    story: "Was planning our wedding when they disappeared from all social media and changed their number. Found out they moved states through mutual friends.",
    votes: 247,
    comments: 18,
    timestamp: new Date('2024-01-15'),
    tags: ["ghosting", "engagement", "disappearing-act"]
  },
  {
    id: "catfish-three-years",
    title: "3 Year Catfish with Fake Photos",
    category: "catfish",
    severity: "devastating",
    story: "Online relationship for 3 years. When we finally met, they looked nothing like their photos. Turns out every pic was their attractive cousin.",
    votes: 189,
    comments: 23,
    timestamp: new Date('2024-02-08'),
    tags: ["catfish", "online-dating", "fake-photos"]
  },
  {
    id: "ex-wedding-crasher",
    title: "Ex Showed Up to My Wedding",
    category: "ex-drama",
    severity: "unhinged",
    story: "My ex crashed my wedding reception, gave a toast about our 'unfinished business' and tried to kiss me at the altar. Security had to escort them out.",
    votes: 312,
    comments: 31,
    timestamp: new Date('2024-01-22'),
    tags: ["ex-drama", "wedding", "stalking"]
  },
  {
    id: "dating-entire-friend-group",
    title: "Dated My Entire Friend Group",
    category: "betrayal",
    severity: "brutal",
    story: "Found out my ex systematically dated every single person in our 8-person friend group. They kept spreadsheets ranking our 'performance'.",
    votes: 156,
    comments: 27,
    timestamp: new Date('2024-02-14'),
    tags: ["betrayal", "friend-group", "serial-dating"]
  },
  {
    id: "fake-identity-millionaire",
    title: "Fake Millionaire for 2 Years",
    category: "catfish",
    severity: "devastating",
    story: "They convinced me they were a tech millionaire. Rented fancy cars, fake Rolex, borrowed friend's mansion for dates. Was actually unemployed living with parents.",
    votes: 201,
    comments: 19,
    timestamp: new Date('2024-01-30'),
    tags: ["fake-identity", "financial-lies", "long-term-deception"]
  },
  {
    id: "stolen-identity-dating",
    title: "Used My Identity to Date Others",
    category: "identity-theft",
    severity: "criminal",
    story: "Ex stole my photos and personal info to create fake dating profiles. Matched with my friends who thought I was cheating on them.",
    votes: 278,
    comments: 35,
    timestamp: new Date('2024-02-03'),
    tags: ["identity-theft", "fake-profiles", "reputation-damage"]
  }
];

// Severity levels with styling
const SEVERITY_STYLES = {
  mild: { color: "#ffeb3b", emoji: "😤", label: "Mild Chaos" },
  brutal: { color: "#ff5722", emoji: "💀", label: "Brutal" },
  devastating: { color: "#e91e63", emoji: "💥", label: "Devastating" },
  unhinged: { color: "#e11d2a", emoji: "🔥", label: "Unhinged" },
  criminal: { color: "#9c27b0", emoji: "⚖️", label: "Criminal" }
};

// Category icons
const CATEGORY_ICONS = {
  ghosting: "👻",
  catfish: "🎣", 
  "ex-drama": "💔",
  betrayal: "🗡️",
  "identity-theft": "🎭",
  "financial-lies": "💰",
  stalking: "👁️",
  "toxic-behavior": "☠️"
};

// =====================================================
// CASUALTY MANAGER CLASS
// =====================================================

class CasualtiesManager {
  constructor() {
    this.currentUser = null;
    this.casualties = [];
    this.casualtiesListener = null;
    this.isLoading = false;
    this.currentFilter = 'recent';
    this.userVotes = new Map(); // Track user votes
    
    this.init();
  }

  async init() {
    console.log('💀 Casualties Manager initializing...');
    
    // Wait for authentication
    this.currentUser = await waitForAuth();
    if (this.currentUser) {
      // Get user profile data (read-only)
      const userProfile = await getUserDoc(this.currentUser.uid);
      if (userProfile) {
        this.currentUser.displayName = userProfile.displayName || this.currentUser.displayName;
      }
      await this.loadUserVotes();
    }
    
    // Initialize UI and data - check for selection first
    this.setupEventListeners();
    this.loadSelectedCasualty();
    
    console.log('✅ Casualties Manager initialized');
  }

  setupEventListeners() {
    // Add voting and interaction listeners will be added dynamically
    console.log('🔧 Setting up casualties event listeners...');
  }

  previousCasualty() {
    if (this.currentCasualtyIndex > 0) {
      this.currentCasualtyIndex--;
      this.renderCasualties();
    }
  }

  nextCasualty() {
    if (this.currentCasualtyIndex < this.casualties.length - 1) {
      this.currentCasualtyIndex++;
      this.renderCasualties();
    }
  }

  loadSelectedCasualty() {
    // Check if there's a selected casualty in localStorage
    const selectedCasualty = localStorage.getItem('selectedCasualty');
    
    if (selectedCasualty) {
      try {
        const selection = JSON.parse(selectedCasualty);
        console.log('📖 Loading selected casualty:', selection);
        this.renderSingleCasualty(selection);
        return;
      } catch (error) {
        console.error('❌ Error parsing selected casualty:', error);
      }
    }
    
    // No selection - show empty state
    this.showEmptyState();
  }

  async loadFromFirebase() {
    try {
      // Try multiple possible collection structures to find your real data
      let snapshot;
      let collectionName;
      
      // First try the original structure without complex index
      try {
        snapshot = await getDocs(collection(db, 'dating_casualties'));
        collectionName = 'dating_casualties';
        console.log(`🔍 Found ${snapshot.size} documents in dating_casualties`);
      } catch (e) {
        console.log('🔍 dating_casualties collection not found, trying alternatives...');
      }
      
      // Try alternative collection names that might exist
      if (!snapshot || snapshot.empty) {
        try {
          snapshot = await getDocs(collection(db, 'casualties'));
          collectionName = 'casualties';
          console.log(`🔍 Found ${snapshot.size} documents in casualties`);
        } catch (e) {
          console.log('🔍 casualties collection not found either');
        }
      }
      
      if (snapshot && !snapshot.empty) {
        this.casualties = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort locally by votes if available
        this.casualties.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        
        console.log(`📊 Loaded ${this.casualties.length} real casualties from ${collectionName}`);
        console.log('🔍 Real data structure sample:', {
          id: this.casualties[0]?.id,
          keys: this.casualties[0] ? Object.keys(this.casualties[0]) : [],
          sample: this.casualties[0]
        });
      } else {
        console.log('⚠️ No casualties found in any collection');
        this.casualties = [];
      }
      
    } catch (error) {
      console.error('❌ Error loading from Firebase:', error);
      this.casualties = [];
    }
  }

  async initializeSampleData() {
    console.log('🔧 Initializing sample casualty data...');
    
    try {
      const batch = [];
      for (const casualty of SAMPLE_CASUALTIES) {
        const casualtyData = {
          ...casualty,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          reportCount: 0,
          isVisible: true
        };
        
        const docRef = doc(collection(db, 'dating_casualties'), casualty.id);
        batch.push(setDoc(docRef, casualtyData));
      }
      
      await Promise.all(batch);
      console.log('✅ Sample casualties initialized in Firebase');
    } catch (error) {
      console.error('❌ Error initializing sample data:', error);
    }
  }

  // Removed startRealtimeListener - no longer needed for single selection mode

  async loadUserVotes() {
    if (!this.currentUser) return;
    
    try {
      const userVotesDoc = await getDoc(doc(db, 'user_casualty_votes', this.currentUser.uid));
      if (userVotesDoc.exists()) {
        const votes = userVotesDoc.data().votes || {};
        this.userVotes = new Map(Object.entries(votes));
      }
    } catch (error) {
      console.error('❌ Error loading user votes:', error);
    }
  }

  showLoadingState() {
    const casualtiesList = safeGetById('casualtiesList');
    if (casualtiesList) {
      const loadingHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #ff6b00;">' +
        '<div style="font-size: 2rem; margin-bottom: 16px;">💀</div>' +
        '<div style="font-size: 1.1rem; font-weight: bold;">Loading Dating Casualties...</div>' +
        '<div style="font-size: 0.9rem; margin-top: 8px; color: #999;">Gathering horror stories...</div>' +
        '</div>';
      safeSetInnerHTML(casualtiesList, loadingHTML);
    }
  }

  showErrorState() {
    const casualtiesList = safeGetById('casualtiesList');
    if (casualtiesList) {
      const errorHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #e11d2a;">' +
        '<div style="font-size: 2rem; margin-bottom: 16px;">💥</div>' +
        '<div style="font-size: 1.1rem; font-weight: bold;">Failed to Load Casualties</div>' +
        '<div style="font-size: 0.9rem; margin-top: 8px; color: #999;">Even our horror stories are broken...</div>' +
        '<button onclick="window.casualtiesManager?.loadCasualties()" style="margin-top: 16px; padding: 8px 16px; background: #e11d2a; color: white; border: none; border-radius: 8px; cursor: pointer;">' +
        'Try Again' +
        '</button>' +
        '</div>';
      safeSetInnerHTML(casualtiesList, errorHTML);
    }
  }

  renderSingleCasualty(selection) {
    const casualtiesList = safeGetById('casualtiesList');
    if (!casualtiesList) {
      console.warn('⚠️ casualtiesList element not found');
      return;
    }

    // Show the selected casualty without navigation or scrolling
    const casualtyHtml = '<div style="width: 100%; height: 100%; overflow-y: hidden; padding: 12px; display: flex; flex-direction: column; justify-content: center;">' +
      '<div style="background: linear-gradient(135deg, #1a1b22 60%, #252535 100%); ' +
      'border: 1px solid #2a2c39; border-radius: 10px; padding: 16px;">' +
      
      '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">' +
      '<span style="font-size: 1.4rem;">💔</span>' +
      '<span style="color: #ff6b00; font-size: 1.2rem; font-weight: bold;">' + (selection.title || 'Dating Horror Story') + '</span>' +
      '</div>' +
      
      '<div style="color: #ccc; font-size: 1rem; line-height: 1.4; margin-bottom: 16px;">' +
      (selection.story || selection.description || 'Story content loading...') +
      '</div>' +
      
      '<div style="display: flex; justify-content: space-between; align-items: center;">' +
      '<div style="display: flex; gap: 12px; align-items: center;">' +
      '<span style="color: #ff6b00; font-size: 0.9rem;">💀 ' + (selection.votes || 0) + ' votes</span>' +
      '<span style="color: #888; font-size: 0.9rem;">💬 ' + (selection.comments || 0) + ' comments</span>' +
      '</div>' +
      
      '<button onclick="window.casualtiesManager?.clearSelection()" ' +
      'style="padding: 6px 12px; background: #2a2c39; color: #ccc; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">' +
      'Close' +
      '</button>' +
      '</div>' +
      
      '</div>' +
      '</div>';

    safeSetInnerHTML(casualtiesList, casualtyHtml);
  }

  clearSelection() {
    localStorage.removeItem('selectedCasualty');
    this.showEmptyState();
  }

  showEmptyState() {
    const casualtiesList = safeGetById('casualtiesList');
    if (casualtiesList) {
      const emptyHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #888;">' +
        '<div style="font-size: 2rem; margin-bottom: 16px;">💀</div>' +
        '<div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 8px;">No Casualty Selected</div>' +
        '<div style="font-size: 0.9rem; text-align: center;">Select a dating horror story to view it here</div>' +
        '</div>';
      safeSetInnerHTML(casualtiesList, emptyHTML);
    }
  }

  renderCasualtyCard(casualty) {
    const severity = SEVERITY_STYLES[casualty.severity] || SEVERITY_STYLES.mild;
    const categoryIcon = CATEGORY_ICONS[casualty.category] || "💔";
    const hasVoted = this.userVotes.has(casualty.id);
    const userVote = this.userVotes.get(casualty.id);

    const cardStart = '<div class="casualty-card" data-casualty-id="' + casualty.id + '" style="' +
      'background: linear-gradient(135deg, #1a1b22 60%, #252535 100%); ' +
      'border: 1px solid #2a2c39; ' +
      'border-radius: 10px; ' +
      'padding: 12px; ' +
      'cursor: pointer; ' +
      'transition: all 0.2s ease; ' +
      'position: relative;">';

    const headerStart = '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">' +
      '<div style="display: flex; align-items: center; gap: 8px; flex: 1;">' +
      '<span style="font-size: 1.2rem;">' + categoryIcon + '</span>' +
      '<span style="color: ' + severity.color + '; font-size: 1.1rem;">' + severity.emoji + '</span>' +
      '<span style="color: #fff; font-weight: bold; font-size: 0.95rem;">' + casualty.title + '</span>' +
      '</div>' +
      '<div style="display: flex; align-items: center; gap: 12px;">' +
      '<div style="display: flex; align-items: center; gap: 4px;">' +
      '<span style="font-size: 0.8rem;">💀</span>' +
      '<span style="color: #ff6b00; font-size: 0.85rem; font-weight: bold;">' + casualty.votes + '</span>' +
      '</div>' +
      '<div style="display: flex; align-items: center; gap: 4px;">' +
      '<span style="font-size: 0.8rem;">💬</span>' +
      '<span style="color: #999; font-size: 0.85rem;">' + casualty.comments + '</span>' +
      '</div>' +
      '</div>' +
      '</div>';

    const storyPreview = '<div style="color: #d7d7e3; font-size: 0.85rem; line-height: 1.4; margin-bottom: 10px;">' +
      (casualty.story.length > 120 ? casualty.story.substring(0, 120) + '...' : casualty.story) +
      '</div>';

    const tagsHTML = casualty.tags.slice(0, 2).map(tag => 
      '<span style="background: rgba(225,29,42,0.2); color: #ff6b9d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">#' + tag + '</span>'
    ).join('');

    const actionsStart = '<div style="display: flex; justify-content: space-between; align-items: center;">' +
      '<div style="display: flex; gap: 8px;">' + tagsHTML + '</div>' +
      '<div style="display: flex; gap: 8px; align-items: center;">';

    const voteButton = '<button class="vote-btn ' + (hasVoted && userVote === 'up' ? 'voted' : '') + '" ' +
      'data-casualty-id="' + casualty.id + '" data-vote="up" data-testid="vote-up-' + casualty.id + '" ' +
      'style="background: ' + (hasVoted && userVote === 'up' ? '#ff6b00' : 'transparent') + '; ' +
      'border: 1px solid #ff6b00; color: ' + (hasVoted && userVote === 'up' ? '#fff' : '#ff6b00') + '; ' +
      'padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">' +
      '⬆ ' + (hasVoted && userVote === 'up' ? 'Voted' : 'RIP') +
      '</button>';

    const detailsButton = '<button class="view-details-btn" data-casualty-id="' + casualty.id + '" ' +
      'data-testid="view-details-' + casualty.id + '" ' +
      'style="background: transparent; border: 1px solid #e11d2a; color: #e11d2a; ' +
      'padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">' +
      'Details' +
      '</button>';

    const actionsEnd = '</div></div>';
    const cardEnd = '</div>';

    return cardStart + headerStart + storyPreview + actionsStart + voteButton + detailsButton + actionsEnd + cardEnd;
  }

  showEmptyState() {
    const casualtiesList = safeGetById('casualtiesList');
    if (casualtiesList) {
      const emptyHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #ff6b00;">' +
        '<div style="font-size: 2rem; margin-bottom: 16px;">💀</div>' +
        '<div style="font-size: 1.1rem; font-weight: bold;">No Dating Casualties Yet</div>' +
        '<div style="font-size: 0.9rem; margin-top: 8px; color: #999;">The dating world is surprisingly peaceful...</div>' +
        '<div style="font-size: 0.9rem; color: #999;">Or everyone\'s in denial.</div>' +
        '</div>';
      safeSetInnerHTML(casualtiesList, emptyHTML);
    }
  }

  attachCardEventListeners() {
    // Attach vote button listeners
    document.querySelectorAll('.vote-btn').forEach(btn => {
      safeAddEventListener(btn, 'click', (e) => {
        e.stopPropagation();
        const casualtyId = btn.dataset.casualtyId;
        const voteType = btn.dataset.vote;
        this.voteOnCasualty(casualtyId, voteType);
      });
    });

    // Attach view details listeners
    document.querySelectorAll('.view-details-btn').forEach(btn => {
      safeAddEventListener(btn, 'click', (e) => {
        e.stopPropagation();
        const casualtyId = btn.dataset.casualtyId;
        this.showCasualtyDetails(casualtyId);
      });
    });

    // Attach card click listeners
    document.querySelectorAll('.casualty-card').forEach(card => {
      safeAddEventListener(card, 'click', () => {
        const casualtyId = card.dataset.casualtyId;
        this.showCasualtyDetails(casualtyId);
      });
    });
  }

  async voteOnCasualty(casualtyId, voteType) {
    if (!this.currentUser) {
      window.toast?.error('Please sign in to vote on casualties');
      return;
    }

    try {
      const previousVote = this.userVotes.get(casualtyId);
      
      // Toggle vote logic
      let newVote = null;
      let voteChange = 0;
      
      if (previousVote === voteType) {
        // Remove vote
        newVote = null;
        voteChange = voteType === 'up' ? -1 : 1;
        this.userVotes.delete(casualtyId);
      } else {
        // Add or change vote
        newVote = voteType;
        if (previousVote) {
          voteChange = voteType === 'up' ? 2 : -2; // Changing from opposite vote
        } else {
          voteChange = voteType === 'up' ? 1 : -1; // New vote
        }
        this.userVotes.set(casualtyId, newVote);
      }

      // Update Firebase
      await updateDoc(doc(db, 'dating_casualties', casualtyId), {
        votes: increment(voteChange),
        updatedAt: serverTimestamp()
      });

      // Save user vote
      const userVotesObj = Object.fromEntries(this.userVotes);
      await setDoc(doc(db, 'user_casualty_votes', this.currentUser.uid), {
        votes: userVotesObj,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log('✅ Vote ' + (newVote || 'removed') + ' on casualty ' + casualtyId);
      
    } catch (error) {
      console.error('❌ Error voting on casualty:', error);
      window.toast?.error('Failed to vote. Please try again.');
    }
  }

  showCasualtyDetails(casualtyId) {
    const casualty = this.casualties.find(c => c.id === casualtyId);
    if (!casualty) return;

    const severity = SEVERITY_STYLES[casualty.severity] || SEVERITY_STYLES.mild;
    const categoryIcon = CATEGORY_ICONS[casualty.category] || "💔";

    // Create modal HTML using string concatenation to avoid template literal issues
    const modalHTML = '<div id="casualtyModal" style="' +
      'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; ' +
      'background: rgba(0,0,0,0.8); display: flex; align-items: center; ' +
      'justify-content: center; z-index: 1000; padding: 20px; box-sizing: border-box;">' +
      '<div style="background: linear-gradient(135deg, #1a1b22 60%, #252535 100%); ' +
      'border: 2px solid #e11d2a; border-radius: 16px; padding: 24px; ' +
      'max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto; position: relative;">' +
      '<button id="closeCasualtyModal" style="position: absolute; top: 16px; right: 16px; ' +
      'background: transparent; border: none; color: #e11d2a; font-size: 1.5rem; ' +
      'cursor: pointer; padding: 4px;" data-testid="close-casualty-modal">×</button>' +
      '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">' +
      '<span style="font-size: 2rem;">' + categoryIcon + '</span>' +
      '<span style="color: ' + severity.color + '; font-size: 1.5rem;">' + severity.emoji + '</span>' +
      '<h3 style="color: #fff; margin: 0; font-size: 1.3rem;">' + casualty.title + '</h3>' +
      '</div>' +
      '<div style="display: inline-block; background: ' + severity.color + '; color: #fff; ' +
      'padding: 4px 12px; border-radius: 8px; font-size: 0.9rem; font-weight: bold; margin-bottom: 16px;">' +
      severity.label + '</div>' +
      '<div style="color: #d7d7e3; font-size: 1rem; line-height: 1.6; margin-bottom: 20px; ' +
      'background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px;">' +
      casualty.story + '</div>' +
      '<div style="margin-bottom: 20px;">' +
      '<div style="color: #ff6b00; font-size: 0.9rem; font-weight: bold; margin-bottom: 8px;">Tags:</div>' +
      '<div style="display: flex; flex-wrap: wrap; gap: 6px;">' +
      casualty.tags.map(tag => 
        '<span style="background: rgba(225,29,42,0.2); color: #ff6b9d; padding: 4px 8px; ' +
        'border-radius: 6px; font-size: 0.8rem;">#' + tag + '</span>'
      ).join('') + '</div></div>' +
      '<div style="display: flex; justify-content: space-between; align-items: center; ' +
      'border-top: 1px solid #2a2c39; padding-top: 16px;">' +
      '<div style="display: flex; gap: 20px;">' +
      '<div style="display: flex; align-items: center; gap: 6px;">' +
      '<span style="font-size: 1rem;">💀</span>' +
      '<span style="color: #ff6b00; font-weight: bold;">' + casualty.votes + ' votes</span>' +
      '</div>' +
      '<div style="display: flex; align-items: center; gap: 6px;">' +
      '<span style="font-size: 1rem;">💬</span>' +
      '<span style="color: #999;">' + casualty.comments + ' comments</span>' +
      '</div></div>' +
      '<div style="color: #999; font-size: 0.8rem;">' +
      (casualty.timestamp ? new Date(casualty.timestamp.seconds * 1000 || casualty.timestamp).toLocaleDateString() : 'Recently') +
      '</div></div></div></div>';

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add close functionality
    const modal = document.getElementById('casualtyModal');
    const closeBtn = document.getElementById('closeCasualtyModal');
    
    safeAddEventListener(closeBtn, 'click', () => modal.remove());
    safeAddEventListener(modal, 'click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  showAllCasualties() {
    console.log('🔍 Showing all casualties view...');
    // This could open a full-page view or modal with all casualties
    // For now, just scroll to top and show a toast
    window.toast?.info('💀 All ' + this.casualties.length + ' casualties loaded!');
  }

  cleanup() {
    if (this.casualtiesListener) {
      this.casualtiesListener();
      this.casualtiesListener = null;
    }
    console.log('🧹 Casualties Manager cleaned up');
  }
}

// =====================================================
// GLOBAL EXPORT
// =====================================================

// Create global instance
let casualtiesManagerInstance = null;

export function initializeCasualtiesManager() {
  if (!casualtiesManagerInstance) {
    casualtiesManagerInstance = new CasualtiesManager();
    // Make it globally accessible for button callbacks
    window.casualtiesManager = casualtiesManagerInstance;
  }
  return casualtiesManagerInstance;
}

export function getCasualtiesManager() {
  return casualtiesManagerInstance;
}

export default CasualtiesManager;
