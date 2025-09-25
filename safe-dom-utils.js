// Safe DOM Utilities for preventing null reference errors
// =====================================================

/**
 * Safely get a DOM element by ID with null checking
 * @param {string} id - Element ID
 * @param {boolean} required - Whether to log error if element not found
 * @returns {Element|null} Element or null if not found
 */
function safeGetById(id, required = true) {
  try {
    const element = document.getElementById(id);
    if (!element && required) {
      console.warn(`⚠️ Element with ID "${id}" not found`);
    }
    return element;
  } catch (error) {
    console.error(`❌ Error getting element "${id}":`, error);
    return null;
  }
}

/**
 * Safely get a DOM element by querySelector with null checking
 * @param {string} selector - CSS selector
 * @param {boolean} required - Whether to log error if element not found
 * @returns {Element|null} Element or null if not found
 */
function safeQuerySelector(selector, required = true) {
  try {
    const element = document.querySelector(selector);
    if (!element && required) {
      console.warn(`⚠️ Element with selector "${selector}" not found`);
    }
    return element;
  } catch (error) {
    console.error(`❌ Error querying selector "${selector}":`, error);
    return null;
  }
}

/**
 * Safely append a child to an element with null checking
 * @param {Element|null} parent - Parent element
 * @param {Element|null} child - Child element to append
 * @param {string} context - Context for logging (optional)
 * @returns {boolean} Success status
 */
function safeAppendChild(parent, child, context = '') {
  try {
    if (!parent) {
      console.warn(`⚠️ Cannot append child: parent element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    if (!child) {
      console.warn(`⚠️ Cannot append child: child element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    if (typeof parent.appendChild !== 'function') {
      console.warn(`⚠️ Parent element does not have appendChild method${context ? ` (${context})` : ''}`);
      return false;
    }
    
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.error(`❌ Error appending child${context ? ` (${context})` : ''}:`, error);
    return false;
  }
}

/**
 * Safely set innerHTML with null checking
 * @param {Element|null} element - Target element
 * @param {string} html - HTML content to set
 * @param {string} context - Context for logging (optional)
 * @returns {boolean} Success status
 */
function safeSetInnerHTML(element, html, context = '') {
  try {
    if (!element) {
      console.warn(`⚠️ Cannot set innerHTML: element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    
    element.innerHTML = html;
    return true;
  } catch (error) {
    console.error(`❌ Error setting innerHTML${context ? ` (${context})` : ''}:`, error);
    return false;
  }
}

/**
 * Safely set textContent with null checking
 * @param {Element|null} element - Target element
 * @param {string} text - Text content to set
 * @param {string} context - Context for logging (optional)
 * @returns {boolean} Success status
 */
function safeSetTextContent(element, text, context = '') {
  try {
    if (!element) {
      console.warn(`⚠️ Cannot set textContent: element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    
    element.textContent = text;
    return true;
  } catch (error) {
    console.error(`❌ Error setting textContent${context ? ` (${context})` : ''}:`, error);
    return false;
  }
}

/**
 * Safely add event listener with null checking
 * @param {Element|null} element - Target element
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 * @param {string} context - Context for logging (optional)
 * @returns {boolean} Success status
 */
function safeAddEventListener(element, event, handler, context = '') {
  try {
    if (!element) {
      console.warn(`⚠️ Cannot add event listener: element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    if (typeof handler !== 'function') {
      console.warn(`⚠️ Cannot add event listener: handler is not a function${context ? ` (${context})` : ''}`);
      return false;
    }
    
    element.addEventListener(event, handler);
    return true;
  } catch (error) {
    console.error(`❌ Error adding event listener${context ? ` (${context})` : ''}:`, error);
    return false;
  }
}

/**
 * Safely remove an element from DOM with null checking
 * @param {Element|null} element - Element to remove
 * @param {string} context - Context for logging (optional)
 * @returns {boolean} Success status
 */
function safeRemoveElement(element, context = '') {
  try {
    if (!element) {
      console.warn(`⚠️ Cannot remove element: element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    if (!element.parentNode) {
      console.warn(`⚠️ Cannot remove element: no parent node${context ? ` (${context})` : ''}`);
      return false;
    }
    
    element.parentNode.removeChild(element);
    return true;
  } catch (error) {
    console.error(`❌ Error removing element${context ? ` (${context})` : ''}:`, error);
    return false;
  }
}

/**
 * Safely set element style with null checking
 * @param {Element|null} element - Target element
 * @param {string|Object} styleProperty - Style property name or object of properties
 * @param {string} value - Style value (if styleProperty is string)
 * @param {string} context - Context for logging (optional)
 * @returns {boolean} Success status
 */
function safeSetStyle(element, styleProperty, value = null, context = '') {
  try {
    if (!element) {
      console.warn(`⚠️ Cannot set style: element is null${context ? ` (${context})` : ''}`);
      return false;
    }
    
    if (typeof styleProperty === 'object') {
      // Set multiple styles
      Object.entries(styleProperty).forEach(([prop, val]) => {
        element.style[prop] = val;
      });
    } else if (typeof styleProperty === 'string' && value !== null) {
      // Set single style
      element.style[styleProperty] = value;
    } else {
      console.warn(`⚠️ Invalid style parameters${context ? ` (${context})` : ''}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error setting style${context ? ` (${context})` : ''}:`, error);
    return false;
  }
}

/**
 * Wait for DOM to be ready before executing callback
 * @param {Function} callback - Function to execute when DOM is ready
 */
function safeDOMReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    // DOM is already ready
    callback();
  }
}

/**
 * Wait for element to exist in DOM (useful for dynamically loaded content)
 * @param {string} selector - CSS selector or element ID
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Element|null>} Promise resolving to element or null on timeout
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    // Check if element already exists
    const existing = selector.startsWith('#') 
      ? document.getElementById(selector.substring(1))
      : document.querySelector(selector);
      
    if (existing) {
      resolve(existing);
      return;
    }
    
    let attempts = 0;
    const maxAttempts = timeout / 50; // Check every 50ms
    
    const checkInterval = setInterval(() => {
      const element = selector.startsWith('#') 
        ? document.getElementById(selector.substring(1))
        : document.querySelector(selector);
        
      if (element) {
        clearInterval(checkInterval);
        resolve(element);
      } else if (attempts++ >= maxAttempts) {
        clearInterval(checkInterval);
        console.warn(`⚠️ Element "${selector}" not found after ${timeout}ms`);
        resolve(null);
      }
    }, 50);
  });
}

/**
 * Batch DOM operations to improve performance
 * @param {Function} operations - Function containing DOM operations
 * @param {Element} container - Container element to hide during operations
 */
function batchDOMOperations(operations, container = null) {
  try {
    // Hide container to improve performance if provided
    if (container) {
      container.style.display = 'none';
    }
    
    // Execute operations
    operations();
    
    // Show container again if hidden
    if (container) {
      container.style.display = '';
    }
  } catch (error) {
    console.error('❌ Error in batch DOM operations:', error);
    // Ensure container is shown even if operations fail
    if (container) {
      container.style.display = '';
    }
  }
}

// Export all utilities for use in other modules
export {
  safeGetById,
  safeQuerySelector,
  safeAppendChild,
  safeSetInnerHTML,
  safeSetTextContent,
  safeAddEventListener,
  safeRemoveElement,
  safeSetStyle,
  safeDOMReady,
  waitForElement,
  batchDOMOperations
};

// Also make available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.SafeDOMUtils = {
    safeGetById,
    safeQuerySelector,
    safeAppendChild,
    safeSetInnerHTML,
    safeSetTextContent,
    safeAddEventListener,
    safeRemoveElement,
    safeSetStyle,
    safeDOMReady,
    waitForElement,
    batchDOMOperations
  };
}