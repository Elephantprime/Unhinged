// Districts Chat Engine - Core functionality for all districts
// =====================================================
// Shared chat utilities, real-time messaging, and district management
// =====================================================

import { auth, db, getUserDoc, userRef } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  where, 
  deleteDoc, 
  getDocs,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =====================================================
// Core District Chat Engine
// =====================================================

class DistrictChatEngine {
  constructor(districtName) {
    this.districtName = districtName;
    this.currentUser = null;
    this.chatListeners = [];
    this.isAuthenticated = false;
    this.messageCache = new Map();
    
    // Initialize authentication
    this.initAuth();
  }

  // Initialize authentication
  async initAuth() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = await getUserDoc(user.uid) || await this.createUserProfile(user);
        this.isAuthenticated = true;
        await this.trackUserInDistrict();
        console.log(`✅ ${this.districtName} District: User authenticated`, this.currentUser?.displayName);
      } else {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.cleanup();
        console.log(`❌ ${this.districtName} District: User not authenticated`);
      }
    });
  }

  // Create initial user profile for district
  async createUserProfile(user) {
    const userData = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || `Member${Math.floor(Math.random() * 1000)}`,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp()
    };
    
    await setDoc(userRef(user.uid), userData, { merge: true });
    return userData;
  }

  // Track user presence in district
  async trackUserInDistrict() {
    if (!this.currentUser?.uid) return;
    
    const districtUserRef = doc(db, 'districts_users', this.currentUser.uid);
    const districtData = {
      uid: this.currentUser.uid,
      displayName: this.currentUser.displayName || 'Unknown',
      photoURL: this.currentUser.photoURL || '',
      currentDistrict: this.districtName,
      lastSeen: serverTimestamp(),
      isActive: true,
      district: this.districtName // For easier querying
    };
    
    // Set district-specific fields with merge to avoid overwriting other district data
    districtData[`${this.districtName}_joinedAt`] = serverTimestamp();
    districtData[`${this.districtName}_messageCount`] = increment(0);
    districtData[`${this.districtName}_reputation`] = increment(0);
    districtData[`${this.districtName}_lastActive`] = serverTimestamp();
    
    try {
      await setDoc(districtUserRef, districtData, { merge: true });
      console.log(`✅ User ${this.currentUser.displayName} tracked in ${this.districtName} district`);
      
      // Set up heartbeat to keep user active while in district
      this.setupUserHeartbeat();
      
    } catch (error) {
      console.error(`❌ Error tracking user in ${this.districtName}:`, error);
    }
  }

  // Setup heartbeat to keep user presence updated
  setupUserHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Update user presence every 2 minutes while active
    this.heartbeatInterval = setInterval(async () => {
      if (this.currentUser?.uid && this.districtName) {
        try {
          const districtUserRef = doc(db, 'districts_users', this.currentUser.uid);
          await updateDoc(districtUserRef, {
            lastSeen: serverTimestamp(),
            currentDistrict: this.districtName,
            isActive: true,
            [`${this.districtName}_lastActive`]: serverTimestamp()
          });
        } catch (error) {
          console.error(`❌ Error updating user heartbeat:`, error);
        }
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  // Send message to district chat
  async sendMessage(content, messageType = 'text', metadata = {}) {
    if (!this.isAuthenticated || !content.trim()) return false;
    
    const chatRef = collection(db, 'districts_chats', this.districtName, 'messages');
    const messageData = {
      uid: this.currentUser.uid,
      displayName: this.currentUser.displayName || 'Unknown',
      photoURL: this.currentUser.photoURL || '',
      content: this.sanitizeMessage(content.trim()),
      messageType,
      district: this.districtName,
      timestamp: serverTimestamp(),
      metadata: metadata || {}
    };
    
    try {
      await addDoc(chatRef, messageData);
      await this.incrementUserStats('messageCount');
      console.log(`✅ ${this.districtName}: Message sent`);
      
      // Update daily missions progress for messages sent
      if (window.DailyMissionsAPI && window.DailyMissionsAPI.isInitialized()) {
        await window.DailyMissionsAPI.updateProgress('messages_sent', 1, {
          district: this.districtName,
          messageType,
          contentLength: content.length
        });
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error sending message to ${this.districtName}:`, error);
      return false;
    }
  }

  // Send anonymous confession (NO PII stored or transmitted)
  async sendAnonymousConfession(content, metadata = {}) {
    if (!this.isAuthenticated || !content.trim()) return false;
    
    const confessionsRef = collection(db, 'districts_confessions', this.districtName, 'confessions');
    const confessionData = {
      // NO PII FIELDS - completely anonymous
      content: this.sanitizeMessage(content.trim()),
      messageType: 'confession',
      district: this.districtName,
      timestamp: serverTimestamp(),
      metadata: {
        confessionNumber: Math.floor(Math.random() * 100000),
        category: metadata.category || 'general',
        anonymous: true,
        ...metadata
      }
    };
    
    try {
      await addDoc(confessionsRef, confessionData);
      // Track stats without revealing identity
      await this.incrementUserStats('confessionCount');
      console.log(`✅ ${this.districtName}: Anonymous confession sent`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending anonymous confession to ${this.districtName}:`, error);
      return false;
    }
  }

  // Listen to district chat messages
  setupChatListener(callback, messageLimit = 50) {
    const chatRef = collection(db, 'districts_chats', this.districtName, 'messages');
    const messagesQuery = query(chatRef, orderBy('timestamp', 'desc'), limit(messageLimit));
    
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        const message = { id: doc.id, ...doc.data() };
        messages.unshift(message); // Reverse order for display
      });
      
      this.messageCache.set(this.districtName, messages);
      callback(messages);
    });
    
    this.chatListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Listen to anonymous confessions (separate collection)
  setupConfessionListener(callback, messageLimit = 50) {
    const confessionsRef = collection(db, 'districts_confessions', this.districtName, 'confessions');
    const confessionsQuery = query(confessionsRef, orderBy('timestamp', 'desc'), limit(messageLimit));
    
    const unsubscribe = onSnapshot(confessionsQuery, (snapshot) => {
      const confessions = [];
      snapshot.forEach((doc) => {
        const confession = { id: doc.id, ...doc.data() };
        // Ensure no PII leaks through - strip any accidentally included fields
        delete confession.uid;
        delete confession.displayName;
        delete confession.photoURL;
        delete confession.email;
        confessions.unshift(confession); // Reverse order for display
      });
      
      this.messageCache.set(`${this.districtName}_confessions`, confessions);
      callback(confessions);
    });
    
    this.chatListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Combined listener for both regular messages and confessions
  setupCombinedListener(callback, messageLimit = 25, confessionLimit = 25) {
    const chatUnsubscribe = this.setupChatListener((messages) => {
      const confessions = this.messageCache.get(`${this.districtName}_confessions`) || [];
      const combined = [...messages, ...confessions].sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0);
        const timeB = b.timestamp?.toDate?.() || new Date(0);
        return timeB - timeA; // Newest first
      });
      callback(combined);
    }, messageLimit);
    
    const confessionUnsubscribe = this.setupConfessionListener((confessions) => {
      const messages = this.messageCache.get(this.districtName) || [];
      const combined = [...messages, ...confessions].sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0);
        const timeB = b.timestamp?.toDate?.() || new Date(0);
        return timeB - timeA; // Newest first
      });
      callback(combined);
    }, confessionLimit);
    
    return [chatUnsubscribe, confessionUnsubscribe];
  }

  // Sanitize message content
  sanitizeMessage(content) {
    if (typeof content !== 'string') return '';
    return content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .substring(0, 500); // Limit message length
  }

  // Create chat message UI element
  createMessageElement(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `district-message ${message.messageType || 'text'}`;
    messageEl.dataset.testid = `message-${message.id}`;
    
    const timestamp = message.timestamp?.toDate?.() || new Date();
    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // CRITICAL ANONYMITY PROTECTION: Handle confessions differently
    if (message.messageType === 'confession') {
      return this.createAnonymousConfessionElement(message, timeString);
    }
    
    const isOwnMessage = message.uid === this.currentUser?.uid;
    if (isOwnMessage) messageEl.classList.add('own-message');
    
    messageEl.innerHTML = `
      <div class="message-header">
        <div class="message-avatar">
          ${message.photoURL ? 
            `<img src="${message.photoURL}" alt="${message.displayName}" class="avatar-img" />` :
            `<div class="avatar-placeholder">${(message.displayName || '?').charAt(0).toUpperCase()}</div>`
          }
        </div>
        <div class="message-info">
          <span class="message-author" data-testid="text-author-${message.id}">
            ${this.escapeHtml(message.displayName || 'Unknown')}
          </span>
          <span class="message-time" data-testid="text-time-${message.id}">${timeString}</span>
        </div>
      </div>
      <div class="message-content" data-testid="text-content-${message.id}">
        ${this.formatMessageContent(message)}
      </div>
    `;
    
    return messageEl;
  }

  // Create completely anonymous confession element (NO PII displayed)
  createAnonymousConfessionElement(message, timeString) {
    const confessionEl = document.createElement('div');
    confessionEl.className = 'district-message confession anonymous';
    confessionEl.dataset.testid = `confession-${message.id}`;
    
    // NO avatar, NO author name, NO user identification!
    confessionEl.innerHTML = `
      <div class="confession-header">
        <div class="confession-icon">
          <div class="confession-avatar">🎭</div>
        </div>
        <div class="confession-info">
          <span class="confession-label" data-testid="text-confession-label-${message.id}">
            Anonymous Confession
          </span>
          <span class="confession-time" data-testid="text-time-${message.id}">${timeString}</span>
        </div>
      </div>
      <div class="confession-content" data-testid="text-content-${message.id}">
        <div class="confession-message">
          <div class="confession-text">${this.escapeHtml(message.content)}</div>
          <div class="confession-id">
            Confession #${message.metadata?.confessionNumber || Math.floor(Math.random() * 1000)}
          </div>
          ${message.metadata?.category && message.metadata.category !== 'general' ? 
            `<div class="confession-category">${this.escapeHtml(message.metadata.category)}</div>` : ''
          }
        </div>
      </div>
    `;
    
    return confessionEl;
  }

  // Format message content based on type
  formatMessageContent(message) {
    switch (message.messageType) {
      case 'image':
        return `<img src="${message.content}" alt="Shared image" class="message-image" />`;
      case 'system':
        return `<div class="system-message">${this.escapeHtml(message.content)}</div>`;
      case 'confession':
        return `
          <div class="confession-message">
            <div class="confession-content">${this.escapeHtml(message.content)}</div>
            <div class="confession-id">Confession #${message.metadata?.confessionNumber || Math.floor(Math.random() * 1000)}</div>
          </div>
        `;
      default:
        return this.escapeHtml(message.content);
    }
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Send system message
  async sendSystemMessage(content) {
    return await this.sendMessage(content, 'system');
  }

  // Increment user statistics
  async incrementUserStats(statType, amount = 1) {
    if (!this.currentUser?.uid) return;
    
    const districtUserRef = doc(db, 'districts_users', this.currentUser.uid);
    const updateData = {};
    updateData[`${this.districtName}_${statType}`] = increment(amount);
    
    try {
      await updateDoc(districtUserRef, updateData);
    } catch (error) {
      console.error(`❌ Error updating user stats:`, error);
    }
  }

  // Get district user stats
  async getUserStats(userId = null) {
    const targetUserId = userId || this.currentUser?.uid;
    if (!targetUserId) return null;
    
    try {
      const userDoc = await getDoc(doc(db, 'districts_users', targetUserId));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error(`❌ Error fetching user stats:`, error);
      return null;
    }
  }

  // React to message (like, support, etc.)
  async reactToMessage(messageId, reactionType) {
    if (!this.isAuthenticated) return false;
    
    const reactionRef = collection(db, 'districts_reactions', this.districtName, 'reactions');
    const reactionData = {
      uid: this.currentUser.uid,
      targetId: messageId,
      targetType: 'message',
      reactionType,
      timestamp: serverTimestamp()
    };
    
    try {
      await addDoc(reactionRef, reactionData);
      return true;
    } catch (error) {
      console.error(`❌ Error reacting to message:`, error);
      return false;
    }
  }

  // Get active district users
  async getActiveUsers(limit = 20) {
    try {
      const usersRef = collection(db, 'districts_users');
      
      // First try to get users with current district filter only
      // This avoids the composite index requirement
      const activeUsersQuery = query(
        usersRef, 
        where('currentDistrict', '==', this.districtName),
        limit(limit * 2) // Get more to account for filtering
      );
      
      const snapshot = await getDocs(activeUsersQuery);
      const users = [];
      
      snapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        // Only include users seen in the last 30 minutes
        const lastSeen = userData.lastSeen?.toDate?.() || new Date(0);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        if (lastSeen > thirtyMinutesAgo) {
          users.push(userData);
        }
      });
      
      // Sort by lastSeen in JavaScript (most recent first)
      users.sort((a, b) => {
        const timeA = a.lastSeen?.toDate?.() || new Date(0);
        const timeB = b.lastSeen?.toDate?.() || new Date(0);
        return timeB - timeA;
      });
      
      // Return limited results
      return users.slice(0, limit);
      
    } catch (error) {
      console.error(`❌ Error fetching active users for ${this.districtName}:`, error);
      
      // Fallback: try getting users without district filter and filter client-side
      try {
        const fallbackQuery = query(collection(db, 'districts_users'), limit(50));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const fallbackUsers = [];
        
        fallbackSnapshot.forEach((doc) => {
          const userData = { id: doc.id, ...doc.data() };
          if (userData.currentDistrict === this.districtName) {
            const lastSeen = userData.lastSeen?.toDate?.() || new Date(0);
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            
            if (lastSeen > thirtyMinutesAgo) {
              fallbackUsers.push(userData);
            }
          }
        });
        
        fallbackUsers.sort((a, b) => {
          const timeA = a.lastSeen?.toDate?.() || new Date(0);
          const timeB = b.lastSeen?.toDate?.() || new Date(0);
          return timeB - timeA;
        });
        
        return fallbackUsers.slice(0, limit);
      } catch (fallbackError) {
        console.error(`❌ Fallback query also failed:`, fallbackError);
        return [];
      }
    }
  }

  // Cleanup listeners and presence
  cleanup() {
    this.chatListeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    this.chatListeners = [];
    
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Mark user as inactive in the district
    this.markUserInactive();
  }

  // Mark user as inactive when leaving district
  async markUserInactive() {
    if (!this.currentUser?.uid || !this.districtName) return;
    
    try {
      const districtUserRef = doc(db, 'districts_users', this.currentUser.uid);
      await updateDoc(districtUserRef, {
        currentDistrict: null,
        isActive: false,
        lastSeen: serverTimestamp(),
        [`${this.districtName}_lastActive`]: serverTimestamp()
      });
      console.log(`✅ User ${this.currentUser.displayName} marked inactive in ${this.districtName}`);
    } catch (error) {
      console.error(`❌ Error marking user inactive:`, error);
    }
  }

  // Destroy instance
  destroy() {
    this.cleanup();
    this.messageCache.clear();
  }
}

// =====================================================
// District-Specific Engines (Extended functionality)
// =====================================================

// Dating District Engine
class DatingDistrictEngine extends DistrictChatEngine {
  constructor() {
    super('dating');
    this.pickupLines = [
      "Are you a parking ticket? Because you've got FINE written all over you!",
      "Is your name Google? Because you've got everything I'm searching for.",
      "Are you WiFi? Because I'm really feeling a connection.",
      "Do you have a map? I keep getting lost in your eyes.",
      "Are you a magician? Because whenever I look at you, everyone else disappears!"
    ];
  }

  async sendPickupLine() {
    const randomLine = this.pickupLines[Math.floor(Math.random() * this.pickupLines.length)];
    return await this.sendMessage(randomLine, 'pickup_line');
  }

  async sendDateAdvice(situation) {
    const advice = this.generateDateAdvice(situation);
    return await this.sendMessage(advice, 'dating_advice');
  }

  generateDateAdvice(situation) {
    const advice = {
      'first_date': "First date tips: Pick a public place, be yourself, ask engaging questions, and put your phone away!",
      'texting': "Texting etiquette: Don't double text, match their energy, use emojis sparingly, and be authentic.",
      'rejection': "Handling rejection: It's not personal, stay respectful, learn from it, and keep putting yourself out there!",
      'red_flags': "Red flags to watch: Disrespectful to service staff, always on phone, talks only about themselves."
    };
    return advice[situation] || "Remember: Communication and respect are the foundations of any good relationship!";
  }

  async updateStatus() {
    const statuses = [
      "💕 Looking for love", "🌟 Single and ready to mingle", "💘 Open to connections", 
      "🌈 Exploring new relationships", "💫 Ready for something real", "🦋 New chapter, new love"
    ];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const statusMessage = `Status updated: ${randomStatus} ✨`;
    return await this.sendMessage(statusMessage, 'status_update', { status: randomStatus });
  }

  // Alias method for districts.js compatibility
  async getDatingAdvice(situation) {
    return await this.sendDateAdvice(situation);
  }
}

// Meme Market Engine
class MemeMarketEngine extends DistrictChatEngine {
  constructor() {
    super('memes');
  }

  async sendMeme(imageUrl, caption = '') {
    return await this.sendMessage(imageUrl, 'image', { caption, memeType: 'user_upload' });
  }

  async startMemeContest(theme) {
    const contestMessage = `🎭 MEME CONTEST STARTED! Theme: "${theme}" - Submit your best memes now!`;
    return await this.sendSystemMessage(contestMessage);
  }

  async uploadMeme() {
    // For security, this would integrate with proper file upload system
    const placeholderMemes = [
      "📸 [Uploaded: Distracted Boyfriend Meme]", "📸 [Uploaded: Drake Pointing Meme]", 
      "📸 [Uploaded: This Is Fine Dog Meme]", "📸 [Uploaded: Woman Yelling at Cat Meme]"
    ];
    const randomMeme = placeholderMemes[Math.floor(Math.random() * placeholderMemes.length)];
    return await this.sendMessage(randomMeme, 'meme_upload', { uploadType: 'placeholder' });
  }

  async showTrending() {
    const trendingMessage = `📈 TRENDING MEMES TODAY:

🥇 Distracted Boyfriend (↗️ 420%)
🥈 Drake Pointing (↗️ 340%)
🥉 This Is Fine (↗️ 280%)
4️⃣ Surprised Pikachu (↗️ 210%)
5️⃣ Woman Yelling at Cat (↗️ 180%)

Join the trend! Share your version! 🔥`;
    return await this.sendSystemMessage(trendingMessage);
  }

  // Alias method for districts.js compatibility
  async startContest(theme) {
    return await this.startMemeContest(theme);
  }

  // Browse memes functionality
  async browseMemes() {
    const browseMessage = `🗂️ MEME CATEGORIES:

😂 Classic Memes
🔥 Trending Now
💀 Dark Humor
🐶 Wholesome Memes
🎮 Gaming Memes
💼 Work From Home
📱 Gen Z Humor
🍕 Food Memes
💔 Relationship Memes

React with numbers to explore categories! 🎭`;
    return await this.sendSystemMessage(browseMessage);
  }
}

// Confession Corner Engine
class ConfessionEngine extends DistrictChatEngine {
  constructor() {
    super('confessions');
  }

  // FIXED: Use completely anonymous confession method (NO PII)
  async sendConfession(confession, category = 'general') {
    return await this.sendAnonymousConfession(confession, { 
      category,
      anonymous: true 
    });
  }

  // Override chat listener to use combined listener for confessions
  setupChatListener(callback, messageLimit = 50) {
    // FIXED: Call parent method directly to avoid infinite recursion
    return super.setupChatListener(callback, messageLimit);
  }

  async supportConfession(messageId) {
    return await this.reactToMessage(messageId, 'support');
  }

  async sendSupportMessage() {
    const supportMessages = [
      "💜 Support sent",
      "🫂 You're heard", 
      "🌟 Stay strong",
      "✨ Community support",
      "💪 You've got this"
    ];
    const randomMessage = supportMessages[Math.floor(Math.random() * supportMessages.length)];
    return await this.sendSystemMessage(randomMessage);
  }

  async browseCategories() {
    const categoriesMessage = `🤫 CONFESSION CATEGORIES:

💔 Relationship & Dating  🔒 Family Secrets  💼 Work & Career
🎭 Personal Growth  🌈 Identity & Sexuality  💸 Money & Financial
🎯 Dreams & Aspirations  😅 Embarrassing Moments  🤐 General Confessions`;
    return await this.sendSystemMessage(categoriesMessage);
  }

  // Alias method for districts.js compatibility
  async reactToConfession(messageId) {
    return await this.supportConfession(messageId);
  }
}

// Debate Dome Engine
class DebateDomeEngine extends DistrictChatEngine {
  constructor() {
    super('debates');
    this.activeDebates = new Map();
    this.debateTopics = [
      "Pineapple belongs on pizza",
      "Social media does more harm than good",
      "Remote work is better than office work",
      "Cats are better pets than dogs",
      "Artificial intelligence will replace most jobs",
      "Video games are a waste of time",
      "Money can buy happiness",
      "True crime podcasts are problematic"
    ];
  }

  async startDebate(topic = null) {
    const selectedTopic = topic || this.debateTopics[Math.floor(Math.random() * this.debateTopics.length)];
    const debateId = `debate_${Date.now()}`;
    
    const debateData = {
      id: debateId,
      topic: selectedTopic,
      startTime: new Date(),
      sides: { pro: [], con: [] },
      votes: { pro: 0, con: 0 },
      status: 'active'
    };
    
    this.activeDebates.set(debateId, debateData);
    
    const debateMessage = `⚖️ DEBATE STARTED!\n\nTopic: "${selectedTopic}"\n\n🟢 Pro Side vs 🔴 Con Side\n\nType your position and join a side!`;
    return await this.sendMessage(debateMessage, 'debate_start', { debateId, topic: selectedTopic });
  }

  async joinDebateSide(debateId, side, userId) {
    const debate = this.activeDebates.get(debateId);
    if (!debate) return false;
    
    if (side === 'pro' && !debate.sides.pro.includes(userId)) {
      debate.sides.pro.push(userId);
      await this.sendSystemMessage(`${this.currentUser?.displayName} joined the PRO side! 🟢`);
    } else if (side === 'con' && !debate.sides.con.includes(userId)) {
      debate.sides.con.push(userId);
      await this.sendSystemMessage(`${this.currentUser?.displayName} joined the CON side! 🔴`);
    }
    
    return true;
  }

  async voteOnDebate(debateId, side) {
    const debate = this.activeDebates.get(debateId);
    if (!debate) return false;
    
    debate.votes[side]++;
    
    if (debate.votes.pro + debate.votes.con >= 10) {
      await this.endDebate(debateId);
    }
    
    return true;
  }

  async endDebate(debateId) {
    const debate = this.activeDebates.get(debateId);
    if (!debate) return;
    
    const winner = debate.votes.pro > debate.votes.con ? 'PRO' : 'CON';
    const resultMessage = `🏆 DEBATE ENDED!\n\nTopic: "${debate.topic}"\n\nWinner: ${winner} side!\n\nFinal votes: PRO ${debate.votes.pro} vs CON ${debate.votes.con}`;
    
    await this.sendMessage(resultMessage, 'debate_end', { debateId, winner, votes: debate.votes });
    this.activeDebates.delete(debateId);
  }

  // Alias method for districts.js compatibility
  async joinSide(debateId, side) {
    return await this.joinDebateSide(debateId, side, this.currentUser?.uid);
  }
}

// Toxic Exes Anonymous Engine
class ToxicExesEngine extends DistrictChatEngine {
  constructor() {
    super('toxic');
    this.supportReactions = ['💜', '🫂', '💪', '👑', '✨'];
    this.redFlags = [
      'Love bombing', 'Gaslighting', 'Silent treatment', 'Jealousy/possessiveness',
      'Isolation from friends/family', 'Financial control', 'Emotional manipulation',
      'Constant criticism', 'Double standards', 'Refusing to communicate'
    ];
  }

  async shareExStory(story, anonymous = false) {
    const storyMetadata = {
      storyType: 'ex_experience',
      anonymous,
      supportCount: 0,
      category: 'experience_sharing'
    };
    
    if (anonymous) {
      return await this.sendMessage(story, 'anonymous_story', storyMetadata);
    } else {
      return await this.sendMessage(story, 'ex_story', storyMetadata);
    }
  }

  async sendSupportReaction(messageId) {
    const randomReaction = this.supportReactions[Math.floor(Math.random() * this.supportReactions.length)];
    return await this.reactToMessage(messageId, 'support', { reaction: randomReaction });
  }

  async playRedFlagBingo() {
    const bingoFlags = this.redFlags.slice().sort(() => 0.5 - Math.random()).slice(0, 9);
    const bingoCard = `🚩 RED FLAG BINGO 🚩\n\nMark off the red flags you've experienced:\n\n${bingoFlags.map((flag, i) => `${i + 1}. ${flag}`).join('\n')}\n\nReact with numbers for flags you've seen!`;
    
    return await this.sendMessage(bingoCard, 'red_flag_bingo', { flags: bingoFlags });
  }

  async sendRecoveryAffirmation() {
    const affirmations = [
      "You deserve healthy love, not toxic chaos 👑",
      "Their behavior was about them, not your worth ✨",
      "You're healing and becoming stronger every day 💪",
      "Trust your instincts - they tried to make you doubt them 🎯",
      "You're not responsible for fixing broken people 🫂",
      "Your peace is more valuable than their presence 🌟",
      "You're learning what you won't accept anymore 💜"
    ];
    
    const randomAffirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
    return await this.sendSystemMessage(randomAffirmation);
  }

  async startTherapyCircle() {
    const circleMessage = `🌟 THERAPY CIRCLE STARTED 🌟\n\nSafe space to share, support, and heal together.\n\nRules:\n✅ No judgment\n✅ Respect boundaries\n✅ Support > advice\n✅ What's shared here, stays here\n\nShare when you're ready 💜`;
    return await this.sendSystemMessage(circleMessage);
  }
}

// Gaming Quarter Engine
class GamingQuarterEngine extends DistrictChatEngine {
  constructor() {
    super('gaming');
    this.activeTournaments = new Map();
    this.gameNights = new Map();
    this.leaderboard = new Map();
    this.popularGames = [
      'Among Us', 'Fall Guys', 'Rocket League', 'Minecraft', 'Fortnite',
      'Valorant', 'League of Legends', 'Overwatch 2', 'Apex Legends', 'Call of Duty'
    ];
  }

  async createTournament(gameName, maxPlayers = 16) {
    const tournamentId = `tournament_${Date.now()}`;
    const tournamentData = {
      id: tournamentId,
      game: gameName,
      maxPlayers,
      participants: [],
      status: 'recruiting',
      createdBy: this.currentUser?.uid,
      createdAt: new Date()
    };
    
    this.activeTournaments.set(tournamentId, tournamentData);
    
    const tournamentMessage = `🏆 TOURNAMENT CREATED! 🏆\n\nGame: ${gameName}\nMax Players: ${maxPlayers}\nStatus: Recruiting\n\nType /join to participate!`;
    return await this.sendMessage(tournamentMessage, 'tournament_create', { tournamentId, game: gameName });
  }

  async joinTournament(tournamentId, userId) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament || tournament.participants.includes(userId)) return false;
    
    if (tournament.participants.length >= tournament.maxPlayers) {
      await this.sendSystemMessage('Tournament is full! 🚫');
      return false;
    }
    
    tournament.participants.push(userId);
    await this.sendSystemMessage(`${this.currentUser?.displayName} joined the tournament! (${tournament.participants.length}/${tournament.maxPlayers}) 🎮`);
    
    if (tournament.participants.length >= tournament.maxPlayers) {
      await this.startTournament(tournamentId);
    }
    
    return true;
  }

  async startTournament(tournamentId) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;
    
    tournament.status = 'active';
    const startMessage = `🚀 TOURNAMENT STARTING! 🚀\n\nGame: ${tournament.game}\nParticipants: ${tournament.participants.length}\n\nGood luck to all players! 🏆`;
    
    await this.sendSystemMessage(startMessage);
  }

  async organizeGameNight(game = null) {
    const selectedGame = game || this.popularGames[Math.floor(Math.random() * this.popularGames.length)];
    const gameNightId = `gamenight_${Date.now()}`;
    
    const gameNightData = {
      id: gameNightId,
      game: selectedGame,
      participants: [],
      scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
      organizer: this.currentUser?.uid
    };
    
    this.gameNights.set(gameNightId, gameNightData);
    
    const gameNightMessage = `🎯 GAME NIGHT ORGANIZED! 🎯\n\nGame: ${selectedGame}\nWhen: Starting in 1 hour\nOrganizer: ${this.currentUser?.displayName}\n\nReact to join the fun! 🎮`;
    return await this.sendMessage(gameNightMessage, 'game_night', { gameNightId, game: selectedGame });
  }

  async updateLeaderboard(userId, points) {
    const currentScore = this.leaderboard.get(userId) || 0;
    this.leaderboard.set(userId, currentScore + points);
    
    return this.leaderboard.get(userId);
  }

  async showLeaderboard() {
    const sortedLeaderboard = Array.from(this.leaderboard.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    let leaderboardMessage = '🏆 GAMING LEADERBOARD 🏆\n\n';
    sortedLeaderboard.forEach(([userId, points], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      leaderboardMessage += `${medal} ${userId}: ${points} points\n`;
    });
    
    return await this.sendSystemMessage(leaderboardMessage);
  }

  async challengePlayer(challengedUserId, game) {
    const challengeMessage = `⚔️ CHALLENGE ISSUED! ⚔️\n\n${this.currentUser?.displayName} challenges ${challengedUserId} to ${game}!\n\nAccept the challenge? 🎮`;
    return await this.sendMessage(challengeMessage, 'player_challenge', { 
      challenger: this.currentUser?.uid, 
      challenged: challengedUserId, 
      game 
    });
  }

  async joinGameNight(gameNightId = null) {
    if (gameNightId) {
      const gameNight = this.gameNights.get(gameNightId);
      if (gameNight && this.currentUser?.uid) {
        gameNight.participants.push(this.currentUser.uid);
        return await this.sendSystemMessage(`${this.currentUser.displayName} joined the game night! 🎯`);
      }
    } else {
      // Create a new game night
      return await this.organizeGameNight();
    }
  }

  // Alias method for districts.js compatibility
  async createChallenge(challengedUserId, game) {
    return await this.challengePlayer(challengedUserId, game);
  }
}

// Export engines
export {
  DistrictChatEngine,
  DatingDistrictEngine,
  MemeMarketEngine,
  ConfessionEngine,
  DebateDomeEngine,
  ToxicExesEngine,
  GamingQuarterEngine
};