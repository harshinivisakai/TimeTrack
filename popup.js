import { formatDuration, getTodayKey } from "./utils.js";

let timerInterval;
let liveDomain = null;
let liveStartTime = null;

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btn-dashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: "dashboard.html" });
  });

  await loadData();
  setupLiveTimer();
  
  // Listen for storage changes to keep UI somewhat fresh
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.currentDomain || changes.trackingStartTime || changes.isTrackingPaused) {
        setupLiveTimer();
      }
      
      const todayKey = getTodayKey();
      if (changes[todayKey]) {
        renderWebsitesList(changes[todayKey].newValue || {});
      }
    }
  });
});

async function loadData() {
  const todayKey = getTodayKey();
  const data = await chrome.storage.local.get([todayKey]);
  const todayStats = data[todayKey] || {};
  
  renderWebsitesList(todayStats);
}

function renderWebsitesList(stats) {
  const listEl = document.getElementById("websites-list");
  listEl.innerHTML = "";
  
  const entries = Object.entries(stats);
  
  if (entries.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No activity recorded yet.</p>
        <p style="margin-top: 8px; font-size: 11px; opacity: 0.8;">Start browsing and TimeTrack will automatically record your active website usage.</p>
      </div>`;
    document.getElementById("total-time").textContent = "0h 0m";
    return;
  }
  
  // Calculate total time
  const totalMs = entries.reduce((sum, [, time]) => sum + time, 0);
  document.getElementById("total-time").textContent = formatDuration(totalMs);
  
  // Sort descending
  entries.sort((a, b) => b[1] - a[1]);
  
  // Show top 5
  const topEntries = entries.slice(0, 5);
  
  topEntries.forEach(([domain, ms]) => {
    const percentage = Math.round((ms / totalMs) * 100) || '<1';
    
    // Attempt favicon with chrome api (Manifest V3 approach using _favicon)
    // Note: requires "favicon" permission which we have
    const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://${domain}&size=16`;
    
    const item = document.createElement("div");
    item.className = "website-item";
    item.innerHTML = `
      <div class="site-header">
        <img src="${faviconUrl}" class="site-favicon" onerror="this.src='icons/icon16.png'" alt="">
        <div class="site-domain">${domain}</div>
        <div class="site-time">${formatDuration(ms)}</div>
      </div>
      <div class="progress-container">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-text">${percentage}%</div>
      </div>
    `;
    listEl.appendChild(item);
  });
}

async function setupLiveTimer() {
  clearInterval(timerInterval);
  
  const data = await chrome.storage.local.get(["currentDomain", "trackingStartTime", "isTrackingPaused"]);
  
  const statusEl = document.getElementById("tracking-status");
  const domainEl = document.getElementById("current-domain");
  const timeEl = document.getElementById("current-time");
  
  if (data.isTrackingPaused) {
    statusEl.classList.add("paused");
    domainEl.textContent = "Tracking Paused";
    timeEl.textContent = "--:--:--";
    return;
  }
  
  statusEl.classList.remove("paused");
  
  if (data.currentDomain && data.trackingStartTime) {
    liveDomain = data.currentDomain;
    liveStartTime = data.trackingStartTime;
    domainEl.textContent = liveDomain;
    
    updateTimerVisuals();
    timerInterval = setInterval(updateTimerVisuals, 1000);
  } else {
    domainEl.textContent = "Idle / Not tracking";
    timeEl.textContent = "00:00:00";
  }
}

function updateTimerVisuals() {
  if (!liveStartTime) return;
  const elapsed = Date.now() - liveStartTime;
  
  const totalSeconds = Math.floor(elapsed / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  
  document.getElementById("current-time").textContent = `${h}:${m}:${s}`;
}
