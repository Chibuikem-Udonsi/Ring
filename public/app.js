/**
 * Ring PWA Client Application Logic
 */

// UI DOM References
const briefDateEl = document.getElementById('brief-date');
const briefTimestampEl = document.getElementById('brief-timestamp');
const techAiListEl = document.getElementById('tech-ai-list');
const techAiExpandedListEl = document.getElementById('tech-ai-expanded-list');
const techAiExpandedWrapper = document.getElementById('tech-ai-expanded-wrapper');
const techAiToggleBtn = document.getElementById('tech-ai-toggle');
const techAiCountEl = document.getElementById('tech-ai-count');

const generalListEl = document.getElementById('general-list');
const generalExpandedListEl = document.getElementById('general-expanded-list');
const generalExpandedWrapper = document.getElementById('general-expanded-wrapper');
const generalToggleBtn = document.getElementById('general-toggle');
const generalCountEl = document.getElementById('general-count');

const refreshBtn = document.getElementById('refresh-button');
const dbIndicator = document.getElementById('db-indicator');
const offlineBanner = document.getElementById('offline-banner');

// Caps for default visible lists
const CAP_GENERAL = 5;
const CAP_TECH_AI = 6;

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[Service Worker] Registered successfully:', reg.scope))
      .catch((err) => console.error('[Service Worker] Registration failed:', err));
  });
}

// Format Unix millisecond epoch timestamp into a beautiful date/time string
function formatBriefDateTime(epochMs) {
  if (!epochMs) return { dateStr: 'Unknown Date', timeStr: '' };
  
  const dateObj = new Date(epochMs);
  
  // Format Date: e.g. "Friday, June 20, 2026"
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const dateStr = dateObj.toLocaleDateString('en-US', dateOptions);
  
  // Format Time: e.g. "06:14 AM"
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const timeStr = `Generated at ${dateObj.toLocaleTimeString('en-US', timeOptions)}`;
  
  return { dateStr, timeStr };
}

// Generate the HTML string for a news card item
function createNewsCardHTML(item, isTechAi = false) {
  const isFlagged = isTechAi && item.flagged;
  const cardClass = isFlagged ? 'news-card flagged' : 'news-card';
  const badgeHTML = isFlagged ? '<span class="flagged-badge">Significant</span>' : '';
  
  return `
    <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer" class="${cardClass}">
      ${badgeHTML}
      <p class="card-summary">${item.summary}</p>
      <div class="card-meta">
        <span class="source-badge">${item.sourceName}</span>
        <span class="read-link">
          Read →
        </span>
      </div>
    </a>
  `;
}

// Render the loading state skeletons
function renderSkeletons() {
  const techSkeleton = `
    <div class="skeleton-container">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
  const generalSkeleton = `
    <div class="skeleton-container">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
  techAiListEl.innerHTML = techSkeleton;
  generalListEl.innerHTML = generalSkeleton;
  
  techAiToggleBtn.classList.add('hidden');
  generalToggleBtn.classList.add('hidden');
  techAiExpandedWrapper.classList.remove('show');
  generalExpandedWrapper.classList.remove('show');
  
  briefDateEl.textContent = 'Loading brief…';
  briefTimestampEl.textContent = 'Checking feeds';
}

// Fetch the brief from the API and update the DOM
async function fetchLatestBrief() {
  renderSkeletons();
  
  try {
    const response = await fetch('/api/brief/latest');
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const brief = await response.json();
    
    // 1. Render Header Meta Information
    const { dateStr, timeStr } = formatBriefDateTime(brief.generatedAt);
    briefDateEl.textContent = dateStr;
    briefTimestampEl.textContent = timeStr;
    
    // Update database source indicator
    if (brief.storage === 'firebase') {
      dbIndicator.textContent = 'Database: Firebase';
      dbIndicator.className = 'db-indicator firebase';
    } else {
      dbIndicator.textContent = 'Database: Local';
      dbIndicator.className = 'db-indicator local';
    }

    // 2. Process Tech & AI Items
    const rawTechAi = brief.techAi || [];
    techAiCountEl.textContent = `${rawTechAi.length} item${rawTechAi.length !== 1 ? 's' : ''}`;
    
    if (rawTechAi.length === 0) {
      techAiListEl.innerHTML = `
        <div class="error-state">
          <span class="error-title">No Tech/AI updates today</span>
          <span class="error-desc">There are no summaries in the database for this category.</span>
        </div>
      `;
      techAiToggleBtn.classList.add('hidden');
    } else {
      // Prioritize: flagged: true items MUST float to the top
      const flaggedItems = rawTechAi.filter(item => item.flagged);
      const regularItems = rawTechAi.filter(item => !item.flagged);
      const sortedTechAi = [...flaggedItems, ...regularItems];
      
      // Split into default visible vs expanded/collapsed
      const visibleTech = sortedTechAi.slice(0, CAP_TECH_AI);
      const hiddenTech = sortedTechAi.slice(CAP_TECH_AI);
      
      // Render visible list
      techAiListEl.innerHTML = visibleTech.map(item => createNewsCardHTML(item, true)).join('');
      
      // Render expanded list
      if (hiddenTech.length > 0) {
        techAiExpandedListEl.innerHTML = hiddenTech.map(item => createNewsCardHTML(item, true)).join('');
        techAiToggleBtn.classList.remove('hidden');
        techAiToggleBtn.setAttribute('aria-expanded', 'false');
        techAiToggleBtn.querySelector('.toggle-text').textContent = `Show ${hiddenTech.length} more`;
      } else {
        techAiExpandedListEl.innerHTML = '';
        techAiToggleBtn.classList.add('hidden');
      }
    }

    // 3. Process General News Items
    const rawGeneral = brief.general || [];
    generalCountEl.textContent = `${rawGeneral.length} item${rawGeneral.length !== 1 ? 's' : ''}`;
    
    if (rawGeneral.length === 0) {
      generalListEl.innerHTML = `
        <div class="error-state">
          <span class="error-title">No general news updates today</span>
          <span class="error-desc">There are no summaries in the database for this category.</span>
        </div>
      `;
      generalToggleBtn.classList.add('hidden');
    } else {
      // Split into default visible vs expanded
      const visibleGeneral = rawGeneral.slice(0, CAP_GENERAL);
      const hiddenGeneral = rawGeneral.slice(CAP_GENERAL);
      
      // Render visible list
      generalListEl.innerHTML = visibleGeneral.map(item => createNewsCardHTML(item, false)).join('');
      
      // Render expanded list
      if (hiddenGeneral.length > 0) {
        generalExpandedListEl.innerHTML = hiddenGeneral.map(item => createNewsCardHTML(item, false)).join('');
        generalToggleBtn.classList.remove('hidden');
        generalToggleBtn.setAttribute('aria-expanded', 'false');
        generalToggleBtn.querySelector('.toggle-text').textContent = `Show ${hiddenGeneral.length} more`;
      } else {
        generalExpandedListEl.innerHTML = '';
        generalToggleBtn.classList.add('hidden');
      }
    }
    
  } catch (error) {
    console.error('Error fetching brief:', error);
    
    briefDateEl.textContent = 'Unable to load brief';
    briefTimestampEl.textContent = 'Could not reach the server';
    
    const errorHTML = `
      <div class="error-state">
        <span class="error-title">Brief not found</span>
        <span class="error-desc">The server could not retrieve today's brief.<br><br>${error.message}</span>
      </div>
    `;
    techAiListEl.innerHTML = errorHTML;
    generalListEl.innerHTML = errorHTML;
    
    techAiToggleBtn.classList.add('hidden');
    generalToggleBtn.classList.add('hidden');
  }
}

// Accordion Expand/Collapse Logic — single handler per button
function initToggle(toggleBtn, wrapper) {
  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    const textEl = toggleBtn.querySelector('.toggle-text');
    
    // Find number of hidden items
    const listId = toggleBtn.id === 'tech-ai-toggle' ? 'tech-ai-expanded-list' : 'general-expanded-list';
    const hiddenCount = document.getElementById(listId).children.length;
    
    if (isExpanded) {
      // Collapse
      wrapper.classList.remove('show');
      toggleBtn.setAttribute('aria-expanded', 'false');
      textEl.textContent = `Show ${hiddenCount} more`;
      
      // Scroll back up to the section header
      const headerId = toggleBtn.id === 'tech-ai-toggle' ? 'tech-ai-section' : 'general-section';
      document.getElementById(headerId).scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Expand
      wrapper.classList.add('show');
      toggleBtn.setAttribute('aria-expanded', 'true');
      textEl.textContent = 'Show less';
    }
  });
}

// Wire up events
document.addEventListener('DOMContentLoaded', () => {
  // Initial fetch
  fetchLatestBrief();
  
  // Set up refresh button
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    fetchLatestBrief().finally(() => {
      setTimeout(() => {
        refreshBtn.classList.remove('spinning');
      }, 600); // Minimum rotation duration
    });
  });

  // Watch for offline banner toggles
  window.addEventListener('online', () => {
    offlineBanner.classList.add('hidden');
    fetchLatestBrief();
  });
  
  window.addEventListener('offline', () => {
    offlineBanner.classList.remove('hidden');
  });

  // Check initial connection status
  if (!navigator.onLine) {
    offlineBanner.classList.remove('hidden');
  }

  // Set up toggle accordions (single handler — fixes the duplicate listener bug)
  initToggle(techAiToggleBtn, techAiExpandedWrapper);
  initToggle(generalToggleBtn, generalExpandedWrapper);
});

// =====================================================
// Push Notification Module (M3: Real-Time Alerts)
// =====================================================

/**
 * Convert a base64 VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Initialize push notification flow after brief loads.
 */
async function initPushNotifications() {
  // Check browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    console.log('[Push] Push notifications not supported in this browser.');
    return;
  }

  const banner = document.getElementById('notification-banner');
  const enableBtn = document.getElementById('enable-notifications-btn');
  const dismissBtn = document.getElementById('dismiss-notifications-btn');

  if (!banner || !enableBtn) return;

  const permission = Notification.permission;

  if (permission === 'granted') {
    // Already granted — ensure subscription exists
    await subscribeToPush();
    return;
  }

  if (permission === 'denied') {
    // User previously denied — don't ask again
    console.log('[Push] Notification permission denied by user.');
    return;
  }

  // permission === 'default' — show the banner
  banner.style.display = '';
  banner.classList.add('show');

  enableBtn.addEventListener('click', async () => {
    banner.classList.remove('show');
    setTimeout(() => { banner.style.display = 'none'; }, 400);

    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await subscribeToPush();
      showToast('Alerts enabled ✓');
    } else {
      console.log('[Push] Permission not granted:', result);
    }
  });

  dismissBtn.addEventListener('click', () => {
    banner.classList.remove('show');
    setTimeout(() => { banner.style.display = 'none'; }, 400);
    // Remember dismissal for this session
    sessionStorage.setItem('ring-push-dismissed', 'true');
  });

  // Don't show if already dismissed this session
  if (sessionStorage.getItem('ring-push-dismissed')) {
    banner.style.display = 'none';
  }
}

/**
 * Subscribe to Web Push and send subscription to server.
 */
async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('[Push] Already subscribed.');
      return;
    }

    // Fetch VAPID public key from server
    const response = await fetch('/api/push/vapid-key');
    if (!response.ok) throw new Error('Failed to fetch VAPID key');
    const { publicKey } = await response.json();

    // Subscribe
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    console.log('[Push] Successfully subscribed to push notifications.');
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
  }
}

/**
 * Show a brief confirmation toast.
 */
function showToast(message) {
  const existing = document.querySelector('.alert-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'alert-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/**
 * Handle deep-link from notification tap.
 * Checks for ?alert= parameter and highlights the matching item.
 */
function handleAlertDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const alertUrl = params.get('alert');

  if (!alertUrl) return;

  // Clean the URL bar
  window.history.replaceState({}, '', '/');

  // Wait for content to render, then find and highlight the matching card
  setTimeout(() => {
    const allCards = document.querySelectorAll('.news-card');
    for (const card of allCards) {
      if (card.href && card.href.includes(alertUrl)) {
        card.classList.add('alert-highlight');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Remove highlight after animation
        setTimeout(() => card.classList.remove('alert-highlight'), 4000);
        return;
      }
    }
  }, 1500);
}

// Listen for navigation messages from service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'RING_ALERT_NAVIGATE') {
      const alertUrl = event.data.url;
      const allCards = document.querySelectorAll('.news-card');
      for (const card of allCards) {
        if (card.href && card.href.includes(alertUrl)) {
          card.classList.add('alert-highlight');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => card.classList.remove('alert-highlight'), 4000);
          return;
        }
      }
    }
  });
}

// Initialize push notifications after DOM is ready and brief has loaded
document.addEventListener('DOMContentLoaded', () => {
  // Delay push init slightly to not compete with brief loading
  setTimeout(() => {
    initPushNotifications();
    handleAlertDeepLink();
  }, 2000);
});
