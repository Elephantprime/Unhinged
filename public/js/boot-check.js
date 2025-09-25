console.log('BOOT OK - JavaScript console capture working');
document.documentElement.setAttribute('data-boot','ok');

// CRITICAL: Send beacon to server to confirm JavaScript execution
fetch('/__client-boot', { method: 'POST' }).catch(() => {});
