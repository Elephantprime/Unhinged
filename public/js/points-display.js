// public/js/points-display.js
// =====================================================
// Global Points Display Component
// Reusable component for showing user points across all pages
// =====================================================

import { auth, onAuthStateChanged } from './firebase.js';

/**
 * Creates and initializes a points display element
 * @param {HTMLElement} container - Container element to append the points display to
 * @param {Object} options - Configuration options
 * @param {string} options.position - 'append' or 'prepend' (default: 'append')
 * @param {string} options.size - 'small', 'medium', 'large' (default: 'medium')
 * @param {boolean} options.showOnZero - Show display even when points are 0 (default: false)
 * @param {string} options.customStyles - Additional CSS styles to apply
 * @returns {HTMLElement} The created points display element
 */
export function createPointsDisplay(container, options = {}) {
  const {
    position = 'append',
    size = 'medium',
    showOnZero = false,
    customStyles = ''
  } = options;

  // Create points display element
  const pointsDisplay = document.createElement('div');
  pointsDisplay.id = 'userPointsDisplay';
  pointsDisplay.className = 'btn points-display';
  pointsDisplay.setAttribute('data-testid', 'button-points');
  pointsDisplay.title = 'View leaderboard';
  pointsDisplay.style.cursor = 'pointer';
  
  // Base styles
  const baseStyles = `
    background: linear-gradient(135deg, #ffd700, #ffb347);
    border-color: #ffd700;
    color: #000;
    font-weight: bold;
    display: none;
    transition: all 0.2s ease;
  `;
  
  // Size-based styles
  const sizeStyles = {
    small: 'padding: 6px 12px; font-size: 12px;',
    medium: 'padding: 8px 16px; font-size: 14px;',
    large: 'padding: 10px 20px; font-size: 16px;'
  };
  
  pointsDisplay.style.cssText = baseStyles + sizeStyles[size] + customStyles;
  
  // Add content
  pointsDisplay.innerHTML = `
    🏆 <span id="userPointsCount">0</span> pts
  `;
  
  // Add click handler to navigate to leaderboard
  pointsDisplay.addEventListener('click', () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/world/')) {
      window.location.href = '../leaderboard.html';
    } else {
      window.location.href = './leaderboard.html';
    }
  });
  
  // Add hover effects
  pointsDisplay.addEventListener('mouseenter', () => {
    pointsDisplay.style.transform = 'translateY(-1px) scale(1.02)';
    pointsDisplay.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
  });
  
  pointsDisplay.addEventListener('mouseleave', () => {
    pointsDisplay.style.transform = 'translateY(0) scale(1)';
    pointsDisplay.style.boxShadow = 'none';
  });
  
  // Add to container
  if (position === 'prepend') {
    container.prepend(pointsDisplay);
  } else {
    container.appendChild(pointsDisplay);
  }
  
  // Initialize points display
  initializePointsDisplay(pointsDisplay, showOnZero);
  
  return pointsDisplay;
}

/**
 * Initializes points display with user's current points
 * @param {HTMLElement} pointsElement - The points display element
 * @param {boolean} showOnZero - Whether to show display when points are 0
 */
function initializePointsDisplay(pointsElement, showOnZero = false) {
  const pointsCount = pointsElement.querySelector('#userPointsCount');
  
  if (!pointsCount) return;
  
  // Wait for authentication
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Dynamically import arcade helpers to avoid circular dependencies
        const { getArcadePoints } = await import('./arcade-helpers.js');
        const pointsData = await getArcadePoints(user.uid);
        const totalPoints = pointsData?.totalPoints || 0;
        
        // Update display
        pointsCount.textContent = totalPoints.toLocaleString();
        
        // Show/hide based on points and showOnZero setting
        if (totalPoints > 0 || showOnZero) {
          pointsElement.style.display = 'inline-flex';
        } else {
          pointsElement.style.display = 'none';
        }
        
        console.log(`✅ Points display initialized: ${totalPoints} points`);
      } catch (error) {
        console.error('❌ Error loading user points for display:', error);
        pointsCount.textContent = '0';
        if (showOnZero) {
          pointsElement.style.display = 'inline-flex';
        }
      }
    } else {
      pointsElement.style.display = 'none';
    }
  });
}

/**
 * Updates the points display with new value
 * @param {number} newPoints - New points value
 */
export function updatePointsDisplay(newPoints) {
  const pointsCount = document.getElementById('userPointsCount');
  if (pointsCount) {
    pointsCount.textContent = newPoints.toLocaleString();
    
    // Show display if hidden and points > 0
    const pointsDisplay = document.getElementById('userPointsDisplay');
    if (pointsDisplay && newPoints > 0) {
      pointsDisplay.style.display = 'inline-flex';
    }
  }
}

/**
 * Easy function to add points display to navigation bar
 * @param {string} navSelector - CSS selector for navigation container
 * @param {Object} options - Configuration options
 */
export function addPointsToNavigation(navSelector, options = {}) {
  const navContainer = document.querySelector(navSelector);
  if (navContainer) {
    // Look for existing nav-right container or create one
    let rightContainer = navContainer.querySelector('.nav-right');
    if (!rightContainer) {
      rightContainer = navContainer.querySelector('.nav-left'); // Fallback to nav-left
    }
    if (!rightContainer) {
      rightContainer = navContainer; // Use main container as fallback
    }
    
    return createPointsDisplay(rightContainer, {
      position: 'prepend',
      ...options
    });
  }
  return null;
}

/**
 * Easy function to add points display to header
 * @param {string} headerSelector - CSS selector for header container
 * @param {Object} options - Configuration options
 */
export function addPointsToHeader(headerSelector, options = {}) {
  const headerContainer = document.querySelector(headerSelector);
  if (headerContainer) {
    return createPointsDisplay(headerContainer, {
      position: 'append',
      ...options
    });
  }
  return null;
}

/**
 * Listens for points updates and refreshes display
 */
export function startPointsListener() {
  // Listen for badge unlock events (which award points)
  window.addEventListener('badgeUnlocked', () => {
    setTimeout(() => {
      refreshPointsDisplay();
    }, 1000); // Delay to allow points to be updated in database
  });
  
  // Listen for custom points update events
  window.addEventListener('pointsUpdated', (event) => {
    if (event.detail && event.detail.newTotal) {
      updatePointsDisplay(event.detail.newTotal);
    }
  });
}

/**
 * Manually refresh points display from database
 */
export async function refreshPointsDisplay() {
  const user = auth.currentUser;
  if (user) {
    try {
      const { getArcadePoints } = await import('./arcade-helpers.js');
      const pointsData = await getArcadePoints(user.uid);
      const totalPoints = pointsData?.totalPoints || 0;
      updatePointsDisplay(totalPoints);
    } catch (error) {
      console.error('❌ Error refreshing points display:', error);
    }
  }
}

// Auto-start points listener when module loads
if (typeof window !== 'undefined') {
  startPointsListener();
  
  // Expose functions globally for easy access
  window.PointsDisplay = {
    create: createPointsDisplay,
    update: updatePointsDisplay,
    addToNav: addPointsToNavigation,
    addToHeader: addPointsToHeader,
    refresh: refreshPointsDisplay
  };
}
