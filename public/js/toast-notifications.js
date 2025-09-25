// Simple, elegant toast notification system
class ToastNotifications {
  constructor() {
    this.container = null;
    this.createContainer();
  }

  createContainer() {
    // Create toast container if it doesn't exist
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
      `;
      document.body.appendChild(this.container);
    }
  }

  showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Get emoji based on type
    const emoji = this.getEmoji(type);
    
    toast.style.cssText = `
      background: ${this.getBackgroundColor(type)};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      max-width: 100%;
      word-wrap: break-word;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">${emoji}</span>
        <span style="flex: 1;">${this.escapeHtml(message)}</span>
        <span style="opacity: 0.7; cursor: pointer; font-size: 18px; line-height: 1; margin-left: 8px;" onclick="this.parentElement.parentElement.remove()">×</span>
      </div>
    `;
    
    // Click to dismiss
    toast.addEventListener('click', () => {
      this.removeToast(toast);
    });
    
    this.container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    
    // Auto remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
    
    return toast;
  }

  removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }

  getEmoji(type) {
    const emojis = {
      'success': '✅',
      'info': 'ℹ️',
      'warning': '⚠️',
      'error': '❌',
      'love': '💖',
      'wave': '👋',
      'fire': '🔥',
      'star': '⭐',
      'rocket': '🚀',
      'party': '🎉',
      'thumbs': '👍'
    };
    return emojis[type] || 'ℹ️';
  }

  getBackgroundColor(type) {
    const colors = {
      'success': '#22c55e',
      'info': '#3b82f6', 
      'warning': '#f59e0b',
      'error': '#ef4444',
      'love': '#ec4899',
      'wave': '#8b5cf6',
      'fire': '#f97316',
      'star': '#eab308',
      'rocket': '#06b6d4',
      'party': '#f43f5e',
      'thumbs': '#10b981'
    };
    return colors[type] || '#3b82f6';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convenience methods
  success(message, duration = 4000) {
    return this.showToast(message, 'success', duration);
  }

  info(message, duration = 4000) {
    return this.showToast(message, 'info', duration);
  }

  warning(message, duration = 5000) {
    return this.showToast(message, 'warning', duration);
  }

  error(message, duration = 6000) {
    return this.showToast(message, 'error', duration);
  }

  love(message, duration = 4000) {
    return this.showToast(message, 'love', duration);
  }

  wave(message, duration = 3000) {
    return this.showToast(message, 'wave', duration);
  }
}

// Create global instance
window.toast = new ToastNotifications();

// Add global showToast function for compatibility
window.showToast = (message, type = 'info', duration = 4000) => {
  return window.toast.showToast(message, type, duration);
};

// Export for ES6 modules
// Removed export statement - this file is loaded as a classic script
