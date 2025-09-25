
// Utility functions for the Unhinged app
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  // Set background color based on type
  const colors = {
    info: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b'
  };
  notification.style.backgroundColor = colors[type] || colors.info;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
