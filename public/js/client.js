window.API_BASE = '';
window.socket = io();

// Request cache for faster repeated requests
const requestCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

window.joinHospitalRoom = function (hospitalId) {
  if (!hospitalId) return;
  window.socket.emit('joinHospitalRoom', hospitalId);
};

function getToken() {
  try { return localStorage.getItem('jwt') || ''; } catch (e) { return ''; }
}

function setToken(t) {
  try { localStorage.setItem('jwt', t || ''); } catch (e) { }
}

async function api(path, options = {}) {
  // Check cache for GET requests
  const cacheKey = `${options.method || 'GET'}:${path}`;
  if (!options.method || options.method === 'GET') {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    headers,
    credentials: 'same-origin',
    ...options,
  });

  if (!res.ok) {
    // Handle 401 Unauthorized (Missing token or Invalid token)
    if (res.status === 401) {
      const errorData = await res.json().catch(() => ({ message: 'Unauthorized' }));
      // Clear token and redirect to login
      localStorage.removeItem('jwt');
      localStorage.removeItem('role');
      localStorage.removeItem('doctor');
      localStorage.removeItem('hospitalId');
      localStorage.removeItem('ambulance');

      const msg = errorData.message || 'Session expired. Please login again.';
      if (window.notify) window.notify(msg, 'error');

      // Only redirect if not already on login page
      if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
        setTimeout(() => { window.location.href = '/'; }, 1500);
      }
      throw new Error(msg);
    }

    let errorMsg = 'Request failed';
    try {
      const errorData = await res.json();
      errorMsg = errorData.message || errorData.error || errorMsg;
    } catch (e) {
      errorMsg = await res.text() || errorMsg;
    }

    if (window.notify) window.notify(errorMsg, 'error');
    throw new Error(errorMsg);
  }

  const data = await res.json();

  // Cache GET requests
  if (!options.method || options.method === 'GET') {
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

async function login(role, username, password) {
  const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ role, username, password }) });
  setToken(data.token);
  return data; // { token, forcePasswordChange }
}

async function changePassword(role, username, newPassword) {
  return api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ role, username, newPassword }) });
}


// --- Utility Functions ---

window.logout = function () {
  localStorage.clear();
  window.location.href = '/';
};

window.notify = function (message, type = 'info') {
  // Remove existing toasts to prevent stacking
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;

  // Determine colors based on type
  let bgColor, icon, title;
  switch (type) {
    case 'success':
      bgColor = '#28a745';
      icon = '✅';
      title = 'Success';
      break;
    case 'error':
      bgColor = '#dc3545';
      icon = '❌';
      title = 'Error';
      break;
    case 'warning':
      bgColor = '#ffc107';
      icon = '⚠️';
      title = 'Warning';
      break;
    default:
      bgColor = '#17a2b8';
      icon = 'ℹ️';
      title = 'Info';
  }

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: ${bgColor};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 500;
    animation: slideInRight 0.3s ease-out;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    max-width: 400px;
    min-width: 300px;
  `;

  toast.innerHTML = `
    <span style="font-size: 1.2rem; flex-shrink: 0;">${icon}</span>
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; opacity: 0.9;">${title}</div>
      <div style="font-size: 0.95rem; line-height: 1.4;">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; opacity: 0.8; padding: 0; margin-left: 8px; flex-shrink: 0;">&times;</button>
  `;

  document.body.appendChild(toast);

  // Add animation styles if not present
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = `
      @keyframes slideInRight { 
        from { transform: translateX(100%); opacity: 0; } 
        to { transform: translateX(0); opacity: 1; } 
      }
      @keyframes fadeOut { 
        from { opacity: 1; } 
        to { opacity: 0; } 
      }
    `;
    document.head.appendChild(style);
  }

  // Auto-remove after 5 seconds (longer for errors)
  const duration = type === 'error' ? 6000 : 5000;
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

window.formatDate = function (dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
};

// Polling utility for real-time updates (fallback to WebSockets)
window.createPolling = function (callback, interval = 5000) {
  let pollInterval = null;
  let isPolling = false;

  const start = () => {
    if (isPolling) return;
    isPolling = true;
    pollInterval = setInterval(() => {
      try {
        callback();
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, interval);
  };

  const stop = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      isPolling = false;
    }
  };

  // Auto-start if socket is not connected
  if (window.socket && window.socket.connected) {
    // Socket is connected, don't start polling
    console.log('WebSocket connected, skipping polling');
  } else {
    // Socket not connected, start polling
    console.log('WebSocket not connected, starting polling fallback');
    start();
  }

  // Listen for socket connection/disconnection
  if (window.socket) {
    window.socket.on('connect', () => {
      console.log('WebSocket connected, stopping polling');
      stop();
    });
    window.socket.on('disconnect', () => {
      console.log('WebSocket disconnected, starting polling fallback');
      start();
    });
  }

  return { start, stop };
};

// Export to window
window.api = api;
window.login = login;
window.changePassword = changePassword;
window.setToken = setToken;
window.getToken = getToken;


