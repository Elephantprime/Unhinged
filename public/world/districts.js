// Complete Districts System - Full Interactive Implementation
console.log('🏛️ Districts.js v4 loading - Full Interactive Features');

// Import Firebase with modular v10 SDK
import {
  auth,
  db,
  onAuthStateChanged,
  serverTimestamp,
  collection,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  updateDoc,
  deleteDoc,
  getDocs,
  getUserDoc
} from '../js/firebase.js';

// Immediately try to show district cards
setTimeout(() => {
  console.log('⚡ Emergency district card display...');
  const districtsGrid = document.querySelector('.districts-grid');
  const districtsContainer = document.getElementById('districts-container');
  
  if (districtsGrid) {
    districtsGrid.style.display = 'grid';
    districtsGrid.style.visibility = 'visible';
    districtsGrid.style.opacity = '1';
    console.log('🚨 EMERGENCY: Districts grid shown');
  }
  if (districtsContainer) {
    districtsContainer.style.display = 'block';
    districtsContainer.style.visibility = 'visible';
    districtsContainer.style.opacity = '1';
    console.log('🚨 EMERGENCY: Districts container shown');
  }
}, 100);

let activeDistrict = null;
let currentUser = null;
let chatListener = null;
let pollsListener = null;
let storiesListener = null;

// District configuration
const DISTRICTS = {
  dating: {
    name: '💕 Dating District',
    features: ['💕 Speed Dating', '💬 Pickup Lines', '⭐ Date Reviews']
  },
  memes: {
    name: '😂 Meme Market', 
    features: ['📸 Meme Trading', '🔥 Roast Battles', '🎭 Comedy Shows']
  },
  confessions: {
    name: '🤫 Confession Corner',
    features: ['👤 Anonymous Chat', '🤝 Support Groups', '💭 Secret Sharing']
  },
  debates: {
    name: '⚔️ Debate Dome',
    features: ['🗣️ Topic Debates', '✅ Fact Checking', '📊 Opinion Polls']
  },
  toxic: {
    name: '💀 Toxic Exes Anonymous',
    features: ['📖 Story Sharing', '🚩 Red Flag Bingo', '💊 Recovery Tips']
  }
};

// Safe toast wrapper with fallback
function safeShowToast(message, type = "info") {
  try {
    if (typeof showToast === 'function') {
      showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  } catch (error) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    console.warn('Toast notification failed:', error);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Always show district cards first
    showDistrictCards();
    initializeFirebase();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize Districts:', error);
    // Still show district cards even if Firebase fails
    showDistrictCards();
    safeShowToast("Districts loaded with limited functionality. Some features may not work.", "warning");
  }
});

function showDistrictCards() {
  console.log('🃏 Forcing district cards to show...');
  // Ensure district cards are always visible
  const districtsGrid = document.querySelector('.districts-grid');
  const districtsContainer = document.getElementById('districts-container');
  const districtFullpage = document.getElementById('district-fullpage');
  
  console.log('🔍 Found elements:', { 
    districtsGrid: !!districtsGrid, 
    districtsContainer: !!districtsContainer, 
    districtFullpage: !!districtFullpage 
  });
  
  if (districtsGrid) {
    districtsGrid.style.display = 'grid';
    districtsGrid.style.visibility = 'visible';
    districtsGrid.style.opacity = '1';
    console.log('✅ Districts grid shown');
  }
  if (districtsContainer) {
    districtsContainer.style.display = 'block';
    districtsContainer.style.visibility = 'visible';
    districtsContainer.style.opacity = '1';
    console.log('✅ Districts container shown');
  }
  if (districtFullpage) {
    districtFullpage.style.display = 'none';
    console.log('✅ District fullpage hidden');
  }
  
  // Force show the body content
  document.body.style.visibility = 'visible';
  document.body.style.opacity = '1';
  
  console.log('✅ District cards forced to show');
}

function initializeFirebase() {
  console.log('🔥 Initializing Districts Firebase connection...');
  
  try {
    // Using modular Firebase v10 imports
    console.log('✅ Firebase services connected via modular imports');
    
    // Listen for authentication state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('🔐 User signed in:', user.uid);
        setCurrentUser(user);
        // Ensure cards stay visible even with auth changes
        showDistrictCards();
      } else {
        console.log('🚪 User signed out');
        currentUser = null;
      }
    });
    
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    safeShowToast("Firebase connection failed. Some features may not work.", "error");
  }
}

async function setCurrentUser(authUser) {
  try {
    // Get user data from Firestore using modular imports
    const userData = await getUserDoc(authUser.uid);
    
    currentUser = {
      uid: authUser.uid,
      name: userData?.name || userData?.displayName || authUser.displayName || authUser.email || 'User',
      email: authUser.email
    };
    
    console.log('✅ Districts user set:', currentUser.name);
    safeShowToast(`Welcome to Districts, ${currentUser.name}!`, "success");
    
  } catch (error) {
    console.log('⚠️ Error fetching user data, using auth data:', error);
    currentUser = {
      uid: authUser.uid,
      name: authUser.displayName || authUser.email || 'User',
      email: authUser.email
    };
    safeShowToast(`Welcome to Districts, ${currentUser.name}!`, "success");
  }
}

function setupEventListeners() {
  // District card clicks
  document.querySelectorAll('.district-card').forEach(card => {
    card.addEventListener('click', function() {
      const district = this.dataset.district;
      openDistrict(district);
    });
  });
  
  // Search functionality
  const searchInput = document.getElementById('district-search');
  searchInput.addEventListener('input', filterDistricts);
  
  // Chat input enter key
  document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
}

function filterDistricts() {
  const searchTerm = document.getElementById('district-search').value.toLowerCase();
  const cards = document.querySelectorAll('.district-card');
  
  cards.forEach(card => {
    const title = card.querySelector('h3').textContent.toLowerCase();
    const description = card.querySelector('.district-description').textContent.toLowerCase();
    
    if (title.includes(searchTerm) || description.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function openDistrict(district) {
  console.log('🚪 Opening district:', district);
  
  if (!currentUser) {
    safeShowToast("Please log in to join districts", "error");
    return;
  }

  activeDistrict = district;
  const fullpage = document.getElementById('district-fullpage');
  const title = document.getElementById('district-title');
  const districtsContainer = document.getElementById('districts-container');
  
  console.log('🔍 Found elements:', { 
    fullpage: !!fullpage, 
    title: !!title, 
    districtsContainer: !!districtsContainer 
  });
  
  // Set district title
  if (title) {
    title.textContent = DISTRICTS[district].name;
  }
  
  // Hide only the districts grid, not the container (since fullpage is inside container)
  const districtsGrid = document.querySelector('.districts-grid');
  if (districtsGrid) {
    districtsGrid.style.display = 'none';
    console.log('✅ Districts grid hidden (not container)');
  }
  if (fullpage) {
    // Clear all content and rebuild from scratch
    fullpage.innerHTML = '';
    fullpage.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #1e3c72 100%); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; visibility: visible; opacity: 1;');
    
    // Create simple, working interface
    fullpage.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
        <button onclick="goBackToDistricts()" style="padding: 10px 16px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 20px; cursor: pointer;">← Back to Districts</button>
        <h2 style="margin: 0; color: white; font-size: 1.8rem;">${DISTRICTS[district].name}</h2>
        <button onclick="location.reload()" style="padding: 10px 16px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 20px; cursor: pointer;">🔄 Refresh</button>
      </div>
      
      <div id="features-bar" style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px; flex-wrap: wrap;">
      </div>
      
      <div style="flex: 1; display: flex; flex-direction: column; padding: 20px;">
        <div style="flex: 1; background: rgba(0,0,0,0.2); border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); padding: 15px; overflow-y: auto; margin-bottom: 15px; max-height: calc(100vh - 200px);" id="active-chat">
          <!-- Chat messages will appear here -->
        </div>
        
        <div style="display: flex; gap: 10px;">
          <input type="text" id="chat-input" placeholder="Type your message..." style="flex: 1; padding: 12px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 20px; outline: none;" />
          <button onclick="sendChatMessage()" style="padding: 12px 24px; background: #4ecdc4; border: none; color: white; border-radius: 20px; cursor: pointer; font-weight: bold;">Send</button>
        </div>
      </div>
    `;
    
    console.log('✅ District interface completely rebuilt with inline HTML');
    
    // Add Enter key support to chat input
    const chatInput = fullpage.querySelector('#chat-input');
    if (chatInput) {
      chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          sendChatMessage();
        }
      });
    }
  }
  
  // NOW setup features and load content after DOM is rebuilt
  setupDistrictFeatures(district);
  loadDistrictContent(district);
  
  safeShowToast(`Entering ${DISTRICTS[district].name}...`, "success");
  console.log('🎉 District opened successfully');
}

function setupDistrictFeatures(district) {
  const featuresBar = document.getElementById('features-bar');
  if (!featuresBar) {
    console.log('❌ Features bar not found');
    return;
  }
  
  featuresBar.innerHTML = '';
  
  // Add feature buttons for this district
  DISTRICTS[district].features.forEach(feature => {
    const button = document.createElement('button');
    button.className = 'feature-chat-btn';
    button.textContent = feature;
    button.style.cssText = 'padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 15px; cursor: pointer; margin-right: 10px;';
    button.onclick = () => activateFeature(district, feature);
    button.setAttribute('data-testid', `feature-${feature.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
    featuresBar.appendChild(button);
  });
  
  console.log('✅ Feature buttons created:', DISTRICTS[district].features.length);
}

function loadDistrictContent(district) {
  console.log('📱 Loading content for district:', district);
  
  // Stop previous listeners if they exist
  if (chatListener) chatListener();
  if (pollsListener) pollsListener();
  if (storiesListener) storiesListener();
  
  const chatBox = document.getElementById('active-chat');
  if (chatBox) {
    // Clear chat and prepare for content
    chatBox.innerHTML = '';
    console.log('✅ Chat cleared and ready for content');
  }
  
  // Try to load Firebase content, but don't let failures break the interface
  try {
    loadChatMessages(district);
    loadPolls(district);
    loadStories(district);
    console.log('🔄 Firebase content loading initiated');
  } catch (error) {
    console.log('⚠️ Firebase content loading failed, but interface still works:', error);
  }
}

function loadChatMessages(district) {
  const collectionName = `districts_${district}`;
  chatListener = onSnapshot(
    query(
      collection(db, collectionName),
      orderBy('timestamp', 'asc'),
      limit(30)
    ),
    (snapshot) => {
      renderChatMessages(snapshot.docs);
    }, (error) => {
      console.error('Error loading chat:', error);
      // IMPROVED: Show user-visible error instead of just console logs
      safeShowToast('Failed to load chat messages. Please refresh.', 'error');
      const chatBox = document.getElementById('active-chat');
      if (chatBox) {
        chatBox.innerHTML = '<div style="color: rgba(255,100,100,0.8); text-align: center; padding: 20px;">❌ Failed to load chat. Please refresh the page.</div>';
      }
    });
}

function loadPolls(district) {
  const collectionName = `districts_polls`;
  pollsListener = onSnapshot(
    query(
      collection(db, collectionName),
      where('district', '==', district),
      orderBy('timestamp', 'desc'),
      limit(10)
    ),
    (snapshot) => {
      // Polls don't clear chat
      console.log('📊 Polls updated:', snapshot.docs.length);
    }, (error) => {
      console.error('Error loading polls:', error);
      // IMPROVED: Show user-visible error instead of just console logs
      if (error.code !== 'failed-precondition') {
        safeShowToast('Failed to load polls. Some features may be limited.', 'warning');
      }
    });
}

function loadStories(district) {
  const collectionName = `districts_stories`;
  storiesListener = onSnapshot(
    query(
      collection(db, collectionName),
      where('district', '==', district),
      orderBy('timestamp', 'desc'),
      limit(10)
    ),
    (snapshot) => {
      // Stories don't clear chat  
      console.log('📚 Stories updated:', snapshot.docs.length);
    }, (error) => {
      console.error('Error loading stories:', error);
      // IMPROVED: Show user-visible error instead of just console logs
      if (error.code !== 'failed-precondition') {
        safeShowToast('Failed to load stories. Some features may be limited.', 'warning');
      }
    });
}

// SECURE function that safely renders messages without XSS vulnerability
function renderChatMessages(docs) {
  const chatBox = document.getElementById('active-chat');
  if (!chatBox) return;
  
  // DON'T clear the chat - just add messages that aren't already there
  console.log('💬 Rendering chat messages:', docs.length);
  
  docs.forEach(doc => {
    const data = doc.data();
    const messageId = `msg-${doc.id}`;
    
    // Only add if message doesn't already exist
    if (!chatBox.querySelector(`#${messageId}`) && data.text) {
      const messageElement = document.createElement('div');
      messageElement.id = messageId;
      messageElement.className = 'chat-message-firebase';
      messageElement.style.cssText = 'margin-bottom: 15px; padding: 12px; background: rgba(78, 205, 196, 0.2); border-radius: 10px; border-left: 4px solid #4ecdc4; border: 1px solid rgba(78, 205, 196, 0.4);';
      
      // SECURE: Create DOM elements safely using textContent (prevents XSS)
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 5px;';
      
      const usernameStrong = document.createElement('strong');
      usernameStrong.style.cssText = 'color: #4ecdc4; font-weight: bold;';
      usernameStrong.textContent = data.username || 'Anonymous';  // SECURE: textContent prevents XSS
      
      const timestampSpan = document.createElement('span');
      timestampSpan.style.cssText = 'color: rgba(255,255,255,0.8); font-size: 0.9rem;';
      timestampSpan.textContent = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();
      
      headerDiv.appendChild(usernameStrong);
      headerDiv.appendChild(timestampSpan);
      
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'color: white; line-height: 1.4; font-size: 1rem;';
      contentDiv.textContent = data.text;  // SECURE: textContent prevents XSS
      
      messageElement.appendChild(headerDiv);
      messageElement.appendChild(contentDiv);
      
      chatBox.appendChild(messageElement);
    }
  });
  
  // Auto-scroll to bottom
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function renderAllContent() {
  if (!activeDistrict) return;
  
  const chatBox = document.getElementById('active-chat');
  chatBox.innerHTML = '';
  
  try {
    // Get all content types
    const [chatSnapshot, pollsSnapshot, storiesSnapshot] = await Promise.all([
      getDocs(query(
        collection(db, `districts_${activeDistrict}`),
        orderBy('timestamp', 'asc'),
        limit(30)
      )),
      getDocs(query(
        collection(db, 'districts_polls'),
        where('district', '==', activeDistrict),
        orderBy('timestamp', 'desc'),
        limit(10)
      )),
      getDocs(query(
        collection(db, 'districts_stories'),
        where('district', '==', activeDistrict),
        orderBy('timestamp', 'desc'),
        limit(10)
      ))
    ]);
    
    const allContent = [];
    
    // Add chat messages
    chatSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allContent.push({
        type: 'chat',
        data: data,
        timestamp: data.timestamp?.toDate() || new Date(),
        id: doc.id
      });
    });
    
    // Add polls
    pollsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allContent.push({
        type: 'poll',
        data: data,
        timestamp: data.timestamp?.toDate() || new Date(),
        id: doc.id
      });
    });
    
    // Add stories
    storiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allContent.push({
        type: 'story',
        data: data,
        timestamp: data.timestamp?.toDate() || new Date(),
        id: doc.id
      });
    });
    
    // Sort all content by timestamp
    allContent.sort((a, b) => a.timestamp - b.timestamp);
    
    // Render all content
    allContent.forEach(item => {
      if (item.type === 'chat') {
        renderChatMessage(item.data, chatBox, item.id);
      } else if (item.type === 'poll') {
        renderPoll(item.data, item.id, chatBox);
      } else if (item.type === 'story') {
        renderStory(item.data, item.id, chatBox);
      }
    });
    
    // Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
    
  } catch (error) {
    console.error('Error rendering content:', error);
    // Don't show error content if it's just security rules
    if (error.code === 'failed-precondition') {
      chatBox.innerHTML = '<div style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">Chat loading...</div>';
    } else {
      chatBox.innerHTML = '<div style="color: rgba(255,100,100,0.8); text-align: center; padding: 20px;">Error loading content</div>';
    }
  }
}

function renderChatMessage(msg, container, messageId = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  if (messageId) messageDiv.dataset.messageId = messageId;
  
  if (msg.type === 'feature') {
    messageDiv.className += ' feature-message';
    
    const featureHeader = document.createElement('div');
    featureHeader.className = 'feature-header';
    featureHeader.textContent = msg.feature || 'Feature';
    
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = msg.user || 'Anonymous';
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTimestamp(msg.timestamp);
    
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = msg.content || '';
    
    messageDiv.appendChild(featureHeader);
    messageDiv.appendChild(username);
    messageDiv.appendChild(timestamp);
    messageDiv.appendChild(content);
    
  } else {
    // Regular text message
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = msg.user || 'Anonymous';
    
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTimestamp(msg.timestamp);
    
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = msg.content || '';
    
    // Add delete button for user's own messages
    if (currentUser && msg.userUid === currentUser.uid) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-message-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Delete message';
      deleteBtn.onclick = () => deleteMessage(messageDiv.dataset.messageId, messageDiv);
      deleteBtn.setAttribute('data-testid', `delete-message-${messageDiv.dataset.messageId}`);
      messageDiv.appendChild(deleteBtn);
    }
    
    messageDiv.appendChild(username);
    messageDiv.appendChild(timestamp);
    messageDiv.appendChild(content);
  }
  
  container.appendChild(messageDiv);
}

function renderPoll(pollData, pollId, container) {
  const pollDiv = document.createElement('div');
  pollDiv.className = 'poll-message interactive-content';
  
  // Poll header
  const header = document.createElement('div');
  header.className = 'poll-header';
  
  const icon = document.createElement('span');
  icon.textContent = '📊';
  icon.className = 'poll-icon';
  
  const title = document.createElement('span');
  title.textContent = 'Poll';
  title.className = 'poll-title';
  
  const creator = document.createElement('div');
  creator.className = 'poll-creator';
  creator.textContent = `by ${pollData.creator || 'Anonymous'}`;
  
  const timestamp = document.createElement('div');
  timestamp.className = 'poll-timestamp';
  timestamp.textContent = formatTimestamp(pollData.timestamp);
  
  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(creator);
  header.appendChild(timestamp);
  
  // Poll question
  const question = document.createElement('div');
  question.className = 'poll-question';
  question.textContent = pollData.question;
  
  // Poll options
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'poll-options';
  
  const totalVotes = Object.values(pollData.votes || {}).reduce((sum, votes) => sum + votes.length, 0);
  const userVote = getUserVote(pollData.votes, currentUser?.uid);
  
  pollData.options.forEach((option, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'poll-option';
    
    const optionVotes = pollData.votes?.[index]?.length || 0;
    const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
    
    const button = document.createElement('button');
    button.className = `poll-option-btn ${userVote === index ? 'voted' : ''}`;
    button.onclick = () => votePoll(pollId, index);
    button.disabled = userVote !== null;
    button.setAttribute('data-testid', `vote-option-${index}`);
    
    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = option;
    
    const stats = document.createElement('span');
    stats.className = 'option-stats';
    stats.textContent = `${optionVotes} votes (${percentage}%)`;
    
    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'option-progress';
    progressBar.style.width = `${percentage}%`;
    
    button.appendChild(text);
    button.appendChild(stats);
    button.appendChild(progressBar);
    
    optionDiv.appendChild(button);
    optionsDiv.appendChild(optionDiv);
  });
  
  // Total votes display
  const totalDiv = document.createElement('div');
  totalDiv.className = 'poll-total';
  totalDiv.textContent = `Total votes: ${totalVotes}`;
  
  // Add delete button for user's own polls
  if (currentUser && pollData.creatorUid === currentUser.uid) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-content-btn';
    deleteBtn.innerHTML = '🗑️ Delete Poll';
    deleteBtn.onclick = () => deletePoll(pollId, pollDiv);
    deleteBtn.setAttribute('data-testid', `delete-poll-${pollId}`);
    pollDiv.appendChild(deleteBtn);
  }
  
  pollDiv.appendChild(header);
  pollDiv.appendChild(question);
  pollDiv.appendChild(optionsDiv);
  pollDiv.appendChild(totalDiv);
  
  container.appendChild(pollDiv);
}

function renderStory(storyData, storyId, container) {
  const storyDiv = document.createElement('div');
  storyDiv.className = 'story-message interactive-content';
  
  // Story header
  const header = document.createElement('div');
  header.className = 'story-header';
  
  const icon = document.createElement('span');
  icon.textContent = getStoryIcon(storyData.category);
  icon.className = 'story-icon';
  
  const category = document.createElement('span');
  category.textContent = storyData.category || 'Story';
  category.className = 'story-category';
  
  const creator = document.createElement('div');
  creator.className = 'story-creator';
  creator.textContent = `by ${storyData.creator || 'Anonymous'}`;
  
  const timestamp = document.createElement('div');
  timestamp.className = 'story-timestamp';
  timestamp.textContent = formatTimestamp(storyData.timestamp);
  
  header.appendChild(icon);
  header.appendChild(category);
  header.appendChild(creator);
  header.appendChild(timestamp);
  
  // Story title (if exists)
  if (storyData.title) {
    const title = document.createElement('div');
    title.className = 'story-title';
    title.textContent = storyData.title;
    storyDiv.appendChild(title);
  }
  
  // Story content
  const content = document.createElement('div');
  content.className = 'story-content';
  content.textContent = storyData.content;
  
  // Reactions
  const reactionsDiv = document.createElement('div');
  reactionsDiv.className = 'story-reactions';
  
  const reactions = ['👍', '❤️', '😂', '😮', '😢'];
  reactions.forEach(emoji => {
    const reactionBtn = document.createElement('button');
    reactionBtn.className = 'reaction-btn';
    reactionBtn.textContent = emoji;
    reactionBtn.onclick = () => reactToStory(storyId, emoji);
    
    const count = storyData.reactions?.[emoji]?.length || 0;
    if (count > 0) {
      reactionBtn.textContent += ` ${count}`;
    }
    
    const userReacted = storyData.reactions?.[emoji]?.includes(currentUser?.uid);
    if (userReacted) {
      reactionBtn.classList.add('reacted');
    }
    
    reactionBtn.setAttribute('data-testid', `react-${emoji}`);
    reactionsDiv.appendChild(reactionBtn);
  });
  
  // Add delete button for user's own stories (non-anonymous only)
  if (currentUser && storyData.creatorUid === currentUser.uid && storyData.creator !== 'Anonymous') {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-content-btn';
    deleteBtn.innerHTML = '🗑️ Delete';
    deleteBtn.onclick = () => deleteStory(storyId, storyDiv);
    deleteBtn.setAttribute('data-testid', `delete-story-${storyId}`);
    storyDiv.appendChild(deleteBtn);
  }
  
  storyDiv.appendChild(header);
  storyDiv.appendChild(content);
  storyDiv.appendChild(reactionsDiv);
  
  container.appendChild(storyDiv);
}

function getStoryIcon(category) {
  const icons = {
    'Story': '📖',
    'Confession': '🤫',
    'Debate Topic': '🗣️',
    'Fact Check': '✅',
    'Recovery Tip': '💊',
    'Red Flag': '🚩',
    'Pickup Line': '💬',
    'Date Review': '⭐',
    'Meme': '📸',
    'Roast': '🔥',
    'Joke': '🎭'
  };
  return icons[category] || '📝';
}

function getUserVote(votes, uid) {
  if (!votes || !uid) return null;
  
  for (let optionIndex in votes) {
    if (votes[optionIndex].includes(uid)) {
      return parseInt(optionIndex);
    }
  }
  return null;
}

async function votePoll(pollId, optionIndex) {
  if (!currentUser) {
    safeShowToast("Please log in to vote", "error");
    return;
  }
  
  try {
    const pollRef = doc(db, 'districts_polls', pollId);
    const pollDoc = await getDoc(pollRef);
    const pollData = pollDoc.data();
    
    // Check if user already voted
    const userVote = getUserVote(pollData.votes, currentUser.uid);
    if (userVote !== null) {
      safeShowToast("You already voted!", "info");
      return;
    }
    
    // Add user's vote
    const updatedVotes = { ...pollData.votes };
    if (!updatedVotes[optionIndex]) {
      updatedVotes[optionIndex] = [];
    }
    updatedVotes[optionIndex].push(currentUser.uid);
    
    await updateDoc(pollRef, { votes: updatedVotes });
    safeShowToast("Vote recorded! 🗳️", "success");
    
  } catch (error) {
    console.error('Error voting:', error);
    safeShowToast("Error recording vote", "error");
  }
}

async function reactToStory(storyId, emoji) {
  if (!currentUser) {
    safeShowToast("Please log in to react", "error");
    return;
  }
  
  try {
    const storyRef = doc(db, 'districts_stories', storyId);
    const storyDoc = await getDoc(storyRef);
    const storyData = storyDoc.data();
    
    const updatedReactions = { ...storyData.reactions };
    if (!updatedReactions[emoji]) {
      updatedReactions[emoji] = [];
    }
    
    // Toggle reaction
    const userIndex = updatedReactions[emoji].indexOf(currentUser.uid);
    if (userIndex > -1) {
      updatedReactions[emoji].splice(userIndex, 1);
    } else {
      updatedReactions[emoji].push(currentUser.uid);
    }
    
    await updateDoc(storyRef, { reactions: updatedReactions });
    
  } catch (error) {
    console.error('Error reacting:', error);
    safeShowToast("Error adding reaction", "error");
  }
}

function formatTimestamp(timestamp) {
  if (timestamp?.toDate) {
    return timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
  return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const chatBox = document.getElementById('active-chat');
  const text = input.value.trim();
  
  if (!text || !activeDistrict || !currentUser) return;
  
  let username = currentUser.name;
  let isAnonymous = false;
  
  // District-specific username modifications
  if (activeDistrict === 'confessions') {
    username = "Anonymous";
    isAnonymous = true;
  } else if (activeDistrict === 'debates') {
    const teams = ['Team Pro', 'Team Con'];
    const selectedTeam = teams[Math.floor(Math.random() * teams.length)];
    username = `${selectedTeam} - ${currentUser.name}`;
  }
  
  // Clear the welcome message first if it exists (using unique class)
  const welcomeMsg = chatBox.querySelector('.welcome-message-unique');
  if (welcomeMsg) {
    welcomeMsg.remove();
    console.log('✅ Welcome message cleared for new chat');
  }
  
  console.log('💬 About to add message to chat box:', text);
  
  // Add message to chat immediately for instant feedback with brighter styling
  const messageElement = document.createElement('div');
  messageElement.className = 'chat-message-user';
  messageElement.style.cssText = 'margin-bottom: 15px; padding: 12px; background: rgba(78, 205, 196, 0.2); border-radius: 10px; border-left: 4px solid #4ecdc4; border: 1px solid rgba(78, 205, 196, 0.4);';
  messageElement.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
      <strong style="color: #4ecdc4; font-weight: bold;">${username}</strong>
      <span style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">${new Date().toLocaleTimeString()}</span>
    </div>
    <div style="color: white; line-height: 1.4; font-size: 1rem;">${text}</div>
  `;
  
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
  console.log('✅ Message added to chat:', text);
  
  // Force scroll to show the message
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 100);
  
  // Clear input immediately
  input.value = '';
  
  // Try to save to Firebase in background (but don't block if it fails)
  try {
    const message = {
      uid: currentUser.uid,
      username: username,
      text: text,
      timestamp: serverTimestamp()
    };
    
    const collectionName = `districts_${activeDistrict}`;
    await addDoc(collection(db, collectionName), message);
    console.log('✅ Message saved to Firebase');
    
  } catch (error) {
    console.log('⚠️ Firebase save failed, but message displayed locally:', error);
  }
}

// Interactive feature activation system
function activateFeature(district, feature) {
  const featureActions = {
    dating: {
      '💕 Speed Dating': () => startSpeedDating(),
      '💬 Pickup Lines': () => showPickupLineForm(),
      '⭐ Date Reviews': () => showDateReviewForm()
    },
    memes: {
      '📸 Meme Trading': () => showMemeForm(),
      '🔥 Roast Battles': () => showRoastForm(),
      '🎭 Comedy Shows': () => showJokeForm()
    },
    confessions: {
      '👤 Anonymous Chat': () => showAnonymousForm(),
      '🤝 Support Groups': () => showSupportForm(),
      '💭 Secret Sharing': () => showSecretForm()
    },
    debates: {
      '🗣️ Topic Debates': () => showDebateForm(),
      '✅ Fact Checking': () => showFactCheckForm(),
      '📊 Opinion Polls': () => showPollForm()
    },
    toxic: {
      '📖 Story Sharing': () => showStoryForm(),
      '🚩 Red Flag Bingo': () => showRedFlagForm(),
      '💊 Recovery Tips': () => showRecoveryTipForm()
    }
  };
  
  const action = featureActions[district]?.[feature];
  if (action) {
    action();
  } else {
    safeShowToast(`${feature} feature coming soon!`, "info");
  }
}

// Inline form system
function showInlineForm(title, fields, onSubmit) {
  const chatBox = document.getElementById('active-chat');
  
  const formDiv = document.createElement('div');
  formDiv.className = 'inline-form';
  formDiv.setAttribute('data-testid', 'inline-form');
  
  const formTitle = document.createElement('div');
  formTitle.className = 'form-title';
  formTitle.textContent = title;
  
  const form = document.createElement('form');
  form.className = 'feature-form';
  form.onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }
    onSubmit(data);
    formDiv.remove();
  };
  
  fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-field';
    
    if (field.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.name = field.name;
      textarea.placeholder = field.placeholder;
      textarea.required = field.required || false;
      textarea.setAttribute('data-testid', `input-${field.name}`);
      fieldDiv.appendChild(textarea);
    } else if (field.type === 'select') {
      const select = document.createElement('select');
      select.name = field.name;
      select.required = field.required || false;
      select.setAttribute('data-testid', `select-${field.name}`);
      
      field.options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
      });
      fieldDiv.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = field.type || 'text';
      input.name = field.name;
      input.placeholder = field.placeholder;
      input.required = field.required || false;
      input.setAttribute('data-testid', `input-${field.name}`);
      fieldDiv.appendChild(input);
    }
    
    form.appendChild(fieldDiv);
  });
  
  const buttons = document.createElement('div');
  buttons.className = 'form-buttons';
  
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit';
  submitBtn.className = 'submit-btn';
  submitBtn.setAttribute('data-testid', 'button-submit');
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.onclick = () => formDiv.remove();
  cancelBtn.setAttribute('data-testid', 'button-cancel');
  
  buttons.appendChild(submitBtn);
  buttons.appendChild(cancelBtn);
  form.appendChild(buttons);
  
  formDiv.appendChild(formTitle);
  formDiv.appendChild(form);
  
  chatBox.appendChild(formDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Feature form implementations
function showPollForm() {
  showInlineForm('📊 Create Poll', [
    { name: 'question', type: 'text', placeholder: 'Enter your poll question...', required: true },
    { name: 'option1', type: 'text', placeholder: 'Option 1', required: true },
    { name: 'option2', type: 'text', placeholder: 'Option 2', required: true },
    { name: 'option3', type: 'text', placeholder: 'Option 3 (optional)' },
    { name: 'option4', type: 'text', placeholder: 'Option 4 (optional)' }
  ], async (data) => {
    const options = [data.option1, data.option2];
    if (data.option3) options.push(data.option3);
    if (data.option4) options.push(data.option4);
    
    await createPoll(data.question, options);
  });
}

function showStoryForm() {
  showInlineForm('📖 Share Story', [
    { name: 'title', type: 'text', placeholder: 'Story title (optional)' },
    { name: 'content', type: 'textarea', placeholder: 'Share your story...', required: true }
  ], async (data) => {
    await createStory('Story', data.title, data.content);
  });
}

function showDebateForm() {
  showInlineForm('🗣️ Start Debate', [
    { name: 'topic', type: 'text', placeholder: 'Debate topic...', required: true },
    { name: 'description', type: 'textarea', placeholder: 'Describe the topic in detail...', required: true }
  ], async (data) => {
    await createStory('Debate Topic', data.topic, data.description);
  });
}

function showFactCheckForm() {
  showInlineForm('✅ Fact Check Request', [
    { name: 'claim', type: 'textarea', placeholder: 'Enter the claim to be fact-checked...', required: true }
  ], async (data) => {
    await createStory('Fact Check', 'Fact Check Request', data.claim);
  });
}

function showPickupLineForm() {
  showInlineForm('💬 Share Pickup Line', [
    { name: 'line', type: 'textarea', placeholder: 'Your pickup line...', required: true },
    { name: 'rating', type: 'select', options: ['😅 Cheesy', '😎 Smooth', '🔥 Fire', '💀 Terrible'] }
  ], async (data) => {
    await createStory('Pickup Line', `${data.rating} Pickup Line`, data.line);
  });
}

function showDateReviewForm() {
  showInlineForm('⭐ Date Review', [
    { name: 'rating', type: 'select', options: ['⭐ 1 Star', '⭐⭐ 2 Stars', '⭐⭐⭐ 3 Stars', '⭐⭐⭐⭐ 4 Stars', '⭐⭐⭐⭐⭐ 5 Stars'], required: true },
    { name: 'review', type: 'textarea', placeholder: 'Tell us about your date...', required: true }
  ], async (data) => {
    await createStory('Date Review', `${data.rating} Date Review`, data.review);
  });
}

function showMemeForm() {
  showInlineForm('📸 Share Meme', [
    { name: 'caption', type: 'text', placeholder: 'Meme caption...' },
    { name: 'content', type: 'textarea', placeholder: 'Describe your meme or share the joke...', required: true }
  ], async (data) => {
    await createStory('Meme', data.caption || 'Meme Share', data.content);
  });
}

function showRoastForm() {
  showInlineForm('🔥 Roast Battle', [
    { name: 'target', type: 'text', placeholder: 'Roast target (optional)' },
    { name: 'roast', type: 'textarea', placeholder: 'Your roast...', required: true }
  ], async (data) => {
    const title = data.target ? `Roasting ${data.target}` : 'Roast Battle';
    await createStory('Roast', title, data.roast);
  });
}

function showJokeForm() {
  showInlineForm('🎭 Share Joke', [
    { name: 'setup', type: 'text', placeholder: 'Joke setup...', required: true },
    { name: 'punchline', type: 'text', placeholder: 'Punchline...', required: true }
  ], async (data) => {
    await createStory('Joke', 'Comedy Show', `${data.setup}\n\n${data.punchline}`);
  });
}

function showAnonymousForm() {
  showInlineForm('👤 Anonymous Message', [
    { name: 'message', type: 'textarea', placeholder: 'Your anonymous message...', required: true }
  ], async (data) => {
    await createStory('Confession', null, data.message, true);
  });
}

function showSupportForm() {
  showInlineForm('🤝 Support Message', [
    { name: 'message', type: 'textarea', placeholder: 'Share supportive words or advice...', required: true }
  ], async (data) => {
    await createStory('Support', 'Support Group', data.message);
  });
}

function showSecretForm() {
  showInlineForm('💭 Share Secret', [
    { name: 'secret', type: 'textarea', placeholder: 'Your secret (anonymous)...', required: true }
  ], async (data) => {
    await createStory('Confession', 'Secret Sharing', data.secret, true);
  });
}

function showRedFlagForm() {
  showInlineForm('🚩 Red Flag Bingo', [
    { name: 'redflag', type: 'textarea', placeholder: 'Describe the red flag...', required: true },
    { name: 'severity', type: 'select', options: ['🟡 Yellow Flag', '🟠 Orange Flag', '🔴 Red Flag', '🚩 MAJOR Red Flag'], required: true }
  ], async (data) => {
    await createStory('Red Flag', data.severity, data.redflag);
  });
}

function showRecoveryTipForm() {
  showInlineForm('💊 Recovery Tip', [
    { name: 'tip', type: 'textarea', placeholder: 'Share your recovery tip or advice...', required: true }
  ], async (data) => {
    await createStory('Recovery Tip', 'Recovery Advice', data.tip);
  });
}

// Firebase operations
async function createPoll(question, options) {
  if (!currentUser) return;
  
  try {
    const pollData = {
      question: question,
      options: options,
      votes: {},
      creator: currentUser.name,
      creatorUid: currentUser.uid,
      district: activeDistrict,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, 'districts_polls'), pollData);
    safeShowToast("Poll created! 📊", "success");
    
  } catch (error) {
    console.error('Error creating poll:', error);
    safeShowToast("Error creating poll", "error");
  }
}

async function createStory(category, title, content, anonymous = false) {
  if (!currentUser) return;
  
  try {
    const isAnonymous = anonymous || activeDistrict === 'confessions';
    
    const storyData = {
      category: category,
      title: title,
      content: content,
      creator: isAnonymous ? 'Anonymous' : currentUser.name,
      district: activeDistrict,
      reactions: {},
      timestamp: serverTimestamp()
    };
    
    // Only store uid for non-anonymous posts
    if (!isAnonymous) {
      storyData.creatorUid = currentUser.uid;
    }
    
    await addDoc(collection(db, 'districts_stories'), storyData);
    safeShowToast(`${category} shared! ✨`, "success");
    
  } catch (error) {
    console.error('Error creating story:', error);
    safeShowToast("Error sharing content", "error");
  }
}

// Simple implementations for features that don't need forms
async function startSpeedDating() {
  const prompt = "🚀 Ready for speed dating! Looking for someone to chat with for 3 minutes ⏰ Drop a comment if you're interested!";
  await createStory('Speed Dating', 'Speed Dating Session', prompt);
}

function goBackToDistricts() {
  const fullpage = document.getElementById('district-fullpage');
  const districtsGrid = document.querySelector('.districts-grid');
  
  // Hide full page district 
  if (fullpage) {
    fullpage.style.display = 'none';
  }
  
  // Show districts grid
  if (districtsGrid) {
    districtsGrid.style.display = 'grid';
    console.log('✅ Districts grid restored');
  }
  
  activeDistrict = null;
  
  // Stop all listeners
  if (chatListener) {
    chatListener();
    chatListener = null;
  }
  if (pollsListener) {
    pollsListener();
    pollsListener = null;
  }
  if (storiesListener) {
    storiesListener();
    storiesListener = null;
  }
  
  safeShowToast('Back to Districts', 'success');
}

function refreshDistrict() {
  if (!activeDistrict) return;
  
  safeShowToast('Refreshing district content...', 'info');
  loadDistrictContent(activeDistrict);
}

// Delete Functions
async function deleteMessage(messageId, messageElement) {
  if (!messageId || !currentUser) return;
  
  if (!confirm('Delete this message?')) return;
  
  try {
    await deleteDoc(doc(db, `districts_${activeDistrict}`, messageId));
    messageElement.remove();
    safeShowToast('Message deleted', 'success');
  } catch (error) {
    console.error('Error deleting message:', error);
    safeShowToast('Error deleting message', 'error');
  }
}

async function deletePoll(pollId, pollElement) {
  if (!pollId || !currentUser) return;
  
  if (!confirm('Delete this poll?')) return;
  
  try {
    await deleteDoc(doc(db, 'districts_polls', pollId));
    pollElement.remove();
    safeShowToast('Poll deleted', 'success');
  } catch (error) {
    console.error('Error deleting poll:', error);
    safeShowToast('Error deleting poll', 'error');
  }
}

async function deleteStory(storyId, storyElement) {
  if (!storyId || !currentUser) return;
  
  if (!confirm('Delete this story?')) return;
  
  try {
    await deleteDoc(doc(db, 'districts_stories', storyId));
    storyElement.remove();
    safeShowToast('Story deleted', 'success');
  } catch (error) {
    console.error('Error deleting story:', error);
    safeShowToast('Error deleting story', 'error');
  }
}

// Navigation function for back button
function goToWorldHub() {
  window.location.href = '/world/world.html';
}

// ==== GLOBAL FUNCTION EXPOSURE FOR INLINE HANDLERS ====
// Make functions globally available for onclick handlers
window.goBackToDistricts = goBackToDistricts;
window.goToWorldHub = goToWorldHub;
window.refreshDistrict = refreshDistrict;
window.sendChatMessage = sendChatMessage;
// SECURITY FIX: Expose missing functions to prevent undefined errors
window.activateFeature = activateFeature;
window.deleteMessage = deleteMessage;