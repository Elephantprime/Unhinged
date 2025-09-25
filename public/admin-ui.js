// Admin UI Components
// This module creates admin controls for chat clearing that only show for admin users

import { isCurrentUserAdmin, clearDistrictChat, clearWorldFeed, clearLoungeChat, clearEventChat, clearRoomChat, clearTableChat, clearLiveStreamChat, clearAllStagesChat, getAvailableDistricts, onAuthStateChanged } from './firebase.js';

let isAdmin = false;

// Initialize admin UI on page load
export async function initAdminUI() {
  console.log('🔧 Admin UI: Starting initialization...');
  
  // Wait for Firebase Auth to be ready
  const { auth } = await import('./firebase.js');
  
  // Wait for auth state to be ready
  await new Promise((resolve) => {
    if (auth.currentUser) {
      resolve();
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve();
        }
      });
    }
  });

  try {
    console.log('🔧 Admin UI: Auth ready, checking if current user is admin...');
    isAdmin = await isCurrentUserAdmin();
    console.log('🔧 Admin UI: Admin check result:', isAdmin);
    if (isAdmin) {
      console.log('🔐 Admin detected - initializing admin controls');
      addAdminControls();
      addAdminBadge();
      console.log('🔐 Admin UI fully initialized!');
    } else {
      console.log('🔧 Admin UI: User is not admin, skipping controls');
    }
  } catch (error) {
    console.error('❌ Error initializing admin UI:', error);
  }
}

// Add admin badge to header
function addAdminBadge() {
  // Remove existing badge if it exists
  const existingBadge = document.getElementById('admin-badge');
  if (existingBadge) {
    existingBadge.remove();
  }

  // Try multiple locations for the badge
  const body = document.body;
  const nav = document.querySelector('nav');
  const header = document.querySelector('header');
  const target = nav || header || body;

  if (target) {
    const adminBadge = document.createElement('div');
    adminBadge.id = 'admin-badge';
    adminBadge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #ff0000, #cc0000);
      color: white;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid #ff3333;
      box-shadow: 0 4px 8px rgba(255,0,0,0.5);
      z-index: 9999;
      cursor: pointer;
    `;
    adminBadge.textContent = '🛡️ ADMIN PANEL';
    adminBadge.onclick = () => toggleAdminPanel();
    
    if (nav) {
      nav.insertBefore(adminBadge, nav.firstChild);
    } else {
      target.appendChild(adminBadge);
    }
    console.log('🔐 Admin badge added successfully!');
  }
}

// Add admin controls to various chat interfaces
function addAdminControls() {
  // Add the general admin panel first (always visible)
  addGeneralAdminPanel();
  
  // Add controls to current page based on URL/content
  addDistrictAdminControls();
  addWorldFeedAdminControls();
  addLoungeAdminControls();
}

// Toggle admin panel visibility
function toggleAdminPanel() {
  const panel = document.getElementById('general-admin-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

// Add admin controls to district chat
function addDistrictAdminControls() {
  const districtChat = document.getElementById('chat-container');
  const districtTitle = document.getElementById('district-title');
  
  if (districtChat && districtTitle && !document.getElementById('district-admin-controls')) {
    const adminControls = document.createElement('div');
    adminControls.id = 'district-admin-controls';
    adminControls.style.cssText = `
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff3333;
      border-radius: 8px;
      padding: 8px;
      margin: 8px 0;
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    adminControls.innerHTML = `
      <span style="color: #ff3333; font-size: 12px; font-weight: bold;">🛡️ ADMIN:</span>
      <button id="clear-district-chat" class="btn" style="background: #ff3333; color: white; font-size: 11px; padding: 4px 8px;">
        🗑️ Clear District Chat
      </button>
    `;
    
    districtChat.insertBefore(adminControls, districtChat.firstChild);
    
    // Add event listener for clear button
    document.getElementById('clear-district-chat').addEventListener('click', async () => {
      const district = getCurrentDistrict();
      if (district) {
        try {
          showToast('Clearing district chat...', 'info');
          await clearDistrictChat(district);
          showToast(`${district} district chat cleared!`, 'success');
        } catch (error) {
          console.error('Error clearing district chat:', error);
          showToast('Error clearing district chat: ' + error.message, 'error');
        }
      }
    });
  }
}

// Add admin controls to world feed
function addWorldFeedAdminControls() {
  const worldFeed = document.getElementById('world-feed-container') || document.querySelector('.world-feed');
  
  if (worldFeed && !document.getElementById('worldfeed-admin-controls')) {
    const adminControls = document.createElement('div');
    adminControls.id = 'worldfeed-admin-controls';
    adminControls.style.cssText = `
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff3333;
      border-radius: 8px;
      padding: 8px;
      margin: 8px 0;
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    adminControls.innerHTML = `
      <span style="color: #ff3333; font-size: 12px; font-weight: bold;">🛡️ ADMIN:</span>
      <button id="clear-world-feed" class="btn" style="background: #ff3333; color: white; font-size: 11px; padding: 4px 8px;">
        🗑️ Clear World Feed
      </button>
    `;
    
    worldFeed.insertBefore(adminControls, worldFeed.firstChild);
    
    // Add event listener for clear button
    document.getElementById('clear-world-feed').addEventListener('click', async () => {
      try {
        showToast('Clearing world feed...', 'info');
        await clearWorldFeed();
        showToast('World feed cleared!', 'success');
      } catch (error) {
        console.error('Error clearing world feed:', error);
        showToast('Error clearing world feed: ' + error.message, 'error');
      }
    });
  }
}

// Add admin controls to lounge
function addLoungeAdminControls() {
  const loungeChat = document.getElementById('lounge-chat') || document.querySelector('.lounge-chat');
  
  if (loungeChat && !document.getElementById('lounge-admin-controls')) {
    const adminControls = document.createElement('div');
    adminControls.id = 'lounge-admin-controls';
    adminControls.style.cssText = `
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff3333;
      border-radius: 8px;
      padding: 8px;
      margin: 8px 0;
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    adminControls.innerHTML = `
      <span style="color: #ff3333; font-size: 12px; font-weight: bold;">🛡️ ADMIN:</span>
      <button id="clear-lounge-chat" class="btn" style="background: #ff3333; color: white; font-size: 11px; padding: 4px 8px;">
        🗑️ Clear Lounge Chat
      </button>
    `;
    
    loungeChat.insertBefore(adminControls, loungeChat.firstChild);
    
    // Add event listener for clear button
    document.getElementById('clear-lounge-chat').addEventListener('click', async () => {
      try {
        showToast('Clearing lounge chat...', 'info');
        await clearLoungeChat();
        showToast('Lounge chat cleared!', 'success');
      } catch (error) {
        console.error('Error clearing lounge chat:', error);
        showToast('Error clearing lounge chat: ' + error.message, 'error');
      }
    });
  }
}

// Add general admin panel with all options
function addGeneralAdminPanel() {
  // Remove existing panel if it exists
  const existingPanel = document.getElementById('general-admin-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  // Add to all pages where admin is detected
  {
    const body = document.body;
    if (body && !document.getElementById('general-admin-panel')) {
      const adminPanel = document.createElement('div');
      adminPanel.id = 'general-admin-panel';
      adminPanel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #ff3333;
        border-radius: 12px;
        padding: 12px;
        z-index: 9998;
        width: 220px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.5);
        display: none;
      `;
      
      adminPanel.innerHTML = `
        <!-- Districts Section -->
        <div style="margin-bottom: 8px;">
          <div style="color: #ff6666; font-weight: bold; font-size: 10px; margin-bottom: 3px;">🏘️ DISTRICTS</div>
          <button id="clear-district-dating" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            💖 Dating District
          </button>
          <button id="clear-district-memes" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            😂 Memes District
          </button>
          <button id="clear-district-confessions" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🤫 Confessions District
          </button>
          <button id="clear-district-debates" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🔥 Debates District
          </button>
          <button id="clear-district-support" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🤗 Support District
          </button>
          <button id="clear-district-gaming" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 2px; border: none; border-radius: 4px; cursor: pointer;">
            🎮 Gaming District
          </button>
        </div>

        <!-- Chat Tabs Section -->
        <div style="margin-bottom: 8px;">
          <div style="color: #ff6666; font-weight: bold; font-size: 10px; margin-bottom: 3px;">💬 CHAT TABS</div>
          <button id="clear-tab-general" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🗣️ #general
          </button>
          <button id="clear-tab-first-dates" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            💕 #first-dates
          </button>
          <button id="clear-tab-gym-rats" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            💪 #gym-rats
          </button>
          <button id="clear-tab-chaos-lounge" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🌀 #chaos-lounge
          </button>
          <button id="clear-tab-dating" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            💖 #dating
          </button>
          <button id="clear-tab-friends" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            👫 #friends
          </button>
          <button id="clear-tab-fwb" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            😉 #fwb
          </button>
          <button id="clear-tab-vents" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 2px; border: none; border-radius: 4px; cursor: pointer;">
            😤 #vents
          </button>
        </div>

        <!-- Individual Lounge Tables -->
        <div style="margin-bottom: 8px;">
          <div style="color: #ff6666; font-weight: bold; font-size: 10px; margin-bottom: 3px;">🪑 LOUNGE TABLES</div>
          <div style="max-height: 150px; overflow-y: auto; border: 1px solid #333; border-radius: 4px; padding: 4px;">
            <!-- Dating Tables -->
            <div style="color: #ffaaaa; font-size: 9px; margin: 2px 0;">💖 Dating:</div>
            <button id="clear-table-love-seat" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              💖 Love Seat
            </button>
            <button id="clear-table-thirst-trap" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🔥 Thirst Trap
            </button>
            <button id="clear-table-situationship" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              😵‍💫 Situationship
            </button>
            <button id="clear-table-swipe-right" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              👉 Swipe Right
            </button>
            <button id="clear-table-first-date" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🌹 First Date
            </button>
            <button id="clear-table-complicated" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 2px; border: none; border-radius: 3px; cursor: pointer;">
              🤷‍♀️ Complicated
            </button>
            
            <!-- Lounge Tables -->
            <div style="color: #ffaaaa; font-size: 9px; margin: 2px 0;">🍸 Lounge:</div>
            <button id="clear-table-barstool" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🍺 Barstool
            </button>
            <button id="clear-table-vip-booth" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              👑 VIP Booth
            </button>
            <button id="clear-table-dance-floor" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              💃 Dance Floor
            </button>
            <button id="clear-table-champagne-corner" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🥂 Champagne Corner
            </button>
            <button id="clear-table-late-night" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🌙 Late Night
            </button>
            <button id="clear-table-candlelight" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 2px; border: none; border-radius: 3px; cursor: pointer;">
              🕯️ Candlelight
            </button>
            
            <!-- Unhinged Tables -->
            <div style="color: #ffaaaa; font-size: 9px; margin: 2px 0;">🤯 Unhinged:</div>
            <button id="clear-table-red-flag" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🚩 Red Flag
            </button>
            <button id="clear-table-ghosting-central" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              👻 Ghosting Central
            </button>
            <button id="clear-table-toxic-exes" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              ☠️ Toxic Exes
            </button>
            <button id="clear-table-gaslight-grill" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              💡 Gaslight Grill
            </button>
            <button id="clear-table-delulu-den" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🤡 Delulu Den
            </button>
            <button id="clear-table-drama-table" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 2px; border: none; border-radius: 3px; cursor: pointer;">
              🎭 Drama Table
            </button>
            
            <!-- Icebreaker Tables -->
            <div style="color: #ffaaaa; font-size: 9px; margin: 2px 0;">🎭 Icebreakers:</div>
            <button id="clear-table-truth-dare" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🎯 Truth/Dare
            </button>
            <button id="clear-table-hot-take" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🔥 Hot Take HQ
            </button>
            <button id="clear-table-unpopular-opinions" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🗣️ Unpopular Opinions
            </button>
            <button id="clear-table-dealbreaker-diner" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              💔 Dealbreaker Diner
            </button>
            <button id="clear-table-would-rather" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              🤔 Would Rather
            </button>
            <button id="clear-table-storytime" style="background: #ff3333; color: white; font-size: 9px; padding: 2px 4px; width: 100%; margin-bottom: 1px; border: none; border-radius: 3px; cursor: pointer;">
              📚 Storytime
            </button>
          </div>
        </div>

        <!-- Other Areas -->
        <div style="margin-bottom: 8px;">
          <div style="color: #ff6666; font-weight: bold; font-size: 10px; margin-bottom: 3px;">🌐 OTHER</div>
          <button id="clear-lounge-admin" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🍹 Lounge
          </button>
          <button id="clear-world-feed-admin" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            📰 World Feed
          </button>
          <button id="clear-stages-chat" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            🎪 Stages
          </button>
          <button id="clear-live-streams" style="background: #ff3333; color: white; font-size: 10px; padding: 3px 6px; width: 100%; margin-bottom: 1px; border: none; border-radius: 4px; cursor: pointer;">
            📺 Streams
          </button>
        </div>
      `;
      
      document.body.appendChild(adminPanel);
      
      // Panel starts hidden - no toggle button needed
      
      // Individual District Clearing
      const districts = ['dating', 'memes', 'confessions', 'debates', 'support', 'gaming'];
      districts.forEach(district => {
        document.getElementById(`clear-district-${district}`).addEventListener('click', async () => {
          try {
            showToast(`Clearing ${district} district...`, 'info');
            await clearDistrictChat(district);
            showToast(`${district.charAt(0).toUpperCase() + district.slice(1)} district cleared!`, 'success');
          } catch (error) {
            console.error(`Error clearing ${district} district:`, error);
            showToast(`Error clearing ${district} district: ` + error.message, 'error');
          }
        });
      });

      // Chat Tab Rooms (specific to community chat tabs)
      const chatTabs = ['general', 'first-dates', 'gym-rats', 'chaos-lounge', 'dating', 'friends', 'fwb', 'vents'];
      chatTabs.forEach(tab => {
        document.getElementById(`clear-tab-${tab}`).addEventListener('click', async () => {
          try {
            showToast(`Clearing #${tab} tab...`, 'info');
            await clearRoomChat(tab.replace('-', '_')); // Handle hyphenated names
            showToast(`#${tab} tab cleared!`, 'success');
          } catch (error) {
            console.error(`Error clearing #${tab} tab:`, error);
            showToast(`Error clearing #${tab} tab: ` + error.message, 'error');
          }
        });
      });

      // Live Events
      document.getElementById('clear-stages-chat').addEventListener('click', async () => {
        try {
          showToast('Clearing stages chat...', 'info');
          await clearAllStagesChat();
          showToast('Stages chat cleared!', 'success');
        } catch (error) {
          console.error('Error clearing stages chat:', error);
          showToast('Error clearing stages chat: ' + error.message, 'error');
        }
      });

      document.getElementById('clear-live-streams').addEventListener('click', async () => {
        try {
          showToast('Clearing live stream chat...', 'info');
          await clearLiveStreamChat();
          showToast('Live stream chat cleared!', 'success');
        } catch (error) {
          console.error('Error clearing live stream chat:', error);
          showToast('Error clearing live stream chat: ' + error.message, 'error');
        }
      });
      
      // Clear world feed from admin panel
      document.getElementById('clear-world-feed-admin').addEventListener('click', async () => {
        try {
          showToast('Clearing world feed...', 'info');
          await clearWorldFeed();
          showToast('World feed cleared!', 'success');
        } catch (error) {
          console.error('Error clearing world feed:', error);
          showToast('Error clearing world feed: ' + error.message, 'error');
        }
      });
      
      // Clear lounge from admin panel
      document.getElementById('clear-lounge-admin').addEventListener('click', async () => {
        try {
          showToast('Clearing lounge chat...', 'info');
          await clearLoungeChat();
          showToast('Lounge chat cleared!', 'success');
        } catch (error) {
          console.error('Error clearing lounge chat:', error);
          showToast('Error clearing lounge chat: ' + error.message, 'error');
        }
      });

      // Individual table clearing event listeners
      const allTables = [
        // Dating Tables
        'love-seat', 'thirst-trap', 'situationship', 'swipe-right', 'first-date', 'complicated',
        // Lounge Tables  
        'barstool', 'vip-booth', 'dance-floor', 'champagne-corner', 'late-night', 'candlelight',
        // Unhinged Tables
        'red-flag', 'ghosting-central', 'toxic-exes', 'gaslight-grill', 'delulu-den', 'drama-table',
        // Icebreaker Tables
        'truth-dare', 'hot-take', 'unpopular-opinions', 'dealbreaker-diner', 'would-rather', 'storytime'
      ];

      allTables.forEach(tableId => {
        const button = document.getElementById(`clear-table-${tableId}`);
        if (button) {
          button.addEventListener('click', async () => {
            try {
              const tableName = tableId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              showToast(`Clearing ${tableName} table chat...`, 'info');
              await clearTableChat(tableId);
              showToast(`${tableName} table chat cleared!`, 'success');
            } catch (error) {
              const tableName = tableId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              console.error(`Error clearing ${tableName} table:`, error);
              showToast(`Error clearing ${tableName} table: ` + error.message, 'error');
            }
          });
        }
      });
    }
  }
}

// Helper function to get current district from URL or page context
function getCurrentDistrict() {
  // Check URL for district parameter
  const urlParams = new URLSearchParams(window.location.search);
  const district = urlParams.get('district');
  if (district) return district;
  
  // Check page title or data attributes
  const title = document.getElementById('district-title');
  if (title) {
    const titleText = title.textContent.toLowerCase();
    if (titleText.includes('dating')) return 'dating';
    if (titleText.includes('meme')) return 'memes';
    if (titleText.includes('confession')) return 'confessions';
    if (titleText.includes('debate')) return 'debates';
    if (titleText.includes('toxic')) return 'toxic';
  }
  
  return null;
}

// Toast notification fallback
function showToast(message, type = 'info') {
  // Try to use global showToast if available
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  
  // Fallback to simple alert or console
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Create simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ff3333' : type === 'success' ? '#33ff33' : '#3399ff'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Auto-initialize if DOM is ready
console.log('🔧 Admin UI module loaded, checking DOM readiness...');
if (document.readyState === 'loading') {
  console.log('🔧 Admin UI: DOM still loading, adding event listener');
  document.addEventListener('DOMContentLoaded', initAdminUI);
} else {
  console.log('🔧 Admin UI: DOM ready, initializing immediately');
  initAdminUI();
}