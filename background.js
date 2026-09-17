import { getDomainFromUrl, getTodayKey } from "./utils.js";

// State
let currentDomain = null;
let trackingStartTime = null;
let isUserIdle = false;
let isTrackingPaused = false;
let idleTimeout = 2; // default minutes
let excludedDomains = [];

// Initialize state
async function initState() {
  const data = await chrome.storage.local.get(["isTrackingPaused", "idleTimeout", "excludedDomains"]);
  isTrackingPaused = data.isTrackingPaused || false;
  idleTimeout = data.idleTimeout || 2;
  excludedDomains = data.excludedDomains || [];
  
  chrome.idle.setDetectionInterval(idleTimeout * 60);
  
  // Try to find the active tab on start
  checkActiveTab();
}

async function checkActiveTab() {
  if (isUserIdle || isTrackingPaused) return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && tab.url) {
    handleUrlChange(tab.url);
  } else {
    stopCurrentTracking();
  }
}

async function handleUrlChange(url) {
  if (isUserIdle || isTrackingPaused) return;

  const domain = getDomainFromUrl(url);
  
  if (currentDomain === domain) {
    return; // No change
  }

  // Stop tracking previous domain
  await stopCurrentTracking();

  // Start tracking new domain if valid and not excluded
  if (domain && !excludedDomains.includes(domain)) {
    startTracking(domain);
  }
}

function startTracking(domain) {
  currentDomain = domain;
  trackingStartTime = Date.now();
  
  // Persist transient state in storage so popup can read it
  chrome.storage.local.set({ currentDomain, trackingStartTime });
}

async function stopCurrentTracking() {
  if (currentDomain && trackingStartTime) {
    const elapsedTime = Date.now() - trackingStartTime;
    if (elapsedTime > 0) {
      await saveElapsedTime(currentDomain, elapsedTime);
    }
  }
  
  currentDomain = null;
  trackingStartTime = null;
  chrome.storage.local.set({ currentDomain: null, trackingStartTime: null });
}

async function saveElapsedTime(domain, milliseconds) {
  const todayKey = getTodayKey();
  
  const data = await chrome.storage.local.get([todayKey]);
  const todayStats = data[todayKey] || {};
  
  todayStats[domain] = (todayStats[domain] || 0) + milliseconds;
  
  await chrome.storage.local.set({ [todayKey]: todayStats });
  updateBadge(todayStats);
}

function updateBadge(todayStats) {
  const totalMs = Object.values(todayStats).reduce((a, b) => a + b, 0);
  const totalMins = Math.floor(totalMs / 60000);
  
  let badgeText = "";
  if (totalMins > 0) {
    if (totalMins >= 60) {
      const h = Math.floor(totalMins / 60);
      badgeText = `${h}h`;
    } else {
      badgeText = `${totalMins}m`;
    }
  }
  
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: "#4F46E5" });
}

// Event Listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    handleUrlChange(tab.url);
  } else {
    stopCurrentTracking();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    handleUrlChange(changeInfo.url);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopCurrentTracking();
  } else {
    checkActiveTab();
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "active") {
    isUserIdle = false;
    checkActiveTab();
  } else {
    isUserIdle = true;
    await stopCurrentTracking();
  }
});

// Periodic save to prevent data loss and update UI
chrome.alarms.create("saveInterval", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "saveInterval") {
    if (currentDomain && trackingStartTime && !isUserIdle && !isTrackingPaused) {
      const now = Date.now();
      const elapsedTime = now - trackingStartTime;
      await saveElapsedTime(currentDomain, elapsedTime);
      // Reset start time to now so we don't double count
      trackingStartTime = now;
      chrome.storage.local.set({ trackingStartTime });
    }
    await cleanOldData();
  }
});

// Settings changes from popup/options
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    if (changes.isTrackingPaused) {
      isTrackingPaused = changes.isTrackingPaused.newValue;
      if (isTrackingPaused) {
        stopCurrentTracking();
      } else {
        checkActiveTab();
      }
    }
    
    if (changes.idleTimeout) {
      idleTimeout = changes.idleTimeout.newValue;
      chrome.idle.setDetectionInterval(idleTimeout * 60);
    }
    
    if (changes.excludedDomains) {
      excludedDomains = changes.excludedDomains.newValue;
      // If currently tracking an excluded domain, stop
      if (currentDomain && excludedDomains.includes(currentDomain)) {
        stopCurrentTracking();
      }
    }
  }
});

async function cleanOldData() {
  const data = await chrome.storage.local.get(null);
  const now = new Date();
  now.setHours(0,0,0,0);
  
  const keysToRemove = [];
  
  for (const key in data) {
    // Check if key is a date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const parts = key.split('-');
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 30) {
        keysToRemove.push(key);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

// On startup or install
chrome.runtime.onStartup.addListener(() => {
  initState();
});

chrome.runtime.onInstalled.addListener(() => {
  initState();
});

// Run init on initial script load
initState();
