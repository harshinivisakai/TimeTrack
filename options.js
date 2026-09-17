import { getTodayKey } from "./utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const pauseToggle = document.getElementById("pause-toggle");
  const idleSelect = document.getElementById("idle-select");
  const excludeInput = document.getElementById("exclude-input");
  const btnAddExclude = document.getElementById("btn-add-exclude");
  const excludedList = document.getElementById("excluded-list");
  const btnResetToday = document.getElementById("btn-reset-today");
  const btnDeleteAll = document.getElementById("btn-delete-all");

  // Load current settings
  const data = await chrome.storage.local.get(["isTrackingPaused", "idleTimeout", "excludedDomains"]);
  
  pauseToggle.checked = data.isTrackingPaused || false;
  idleSelect.value = data.idleTimeout || 2;
  const excludedDomains = data.excludedDomains || [];

  renderExcludedDomains(excludedDomains);

  // Listeners
  pauseToggle.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ isTrackingPaused: e.target.checked });
  });

  idleSelect.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ idleTimeout: parseInt(e.target.value) });
  });

  btnAddExclude.addEventListener("click", async () => {
    let domain = excludeInput.value.trim().toLowerCase();
    
    // basic cleanup if user pastes url
    try {
      if (domain.startsWith("http")) {
        const url = new URL(domain);
        domain = url.hostname;
      }
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }
    } catch(e) {}

    if (domain && !excludedDomains.includes(domain)) {
      excludedDomains.push(domain);
      await chrome.storage.local.set({ excludedDomains });
      renderExcludedDomains(excludedDomains);
      excludeInput.value = "";
    }
  });

  // Handle enter key
  excludeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      btnAddExclude.click();
    }
  });

  btnResetToday.addEventListener("click", async () => {
    if (confirm("Are you sure you want to delete today's browsing data? This cannot be undone.")) {
      const todayKey = getTodayKey();
      await chrome.storage.local.remove([todayKey, "currentDomain", "trackingStartTime"]);
      
      // Update badge
      chrome.action.setBadgeText({ text: "" });
      alert("Today's data has been reset.");
    }
  });

  btnDeleteAll.addEventListener("click", async () => {
    if (confirm("WARNING: Are you sure you want to delete ALL browsing history? Settings will be kept.")) {
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      for (const key in allData) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) || key === "currentDomain" || key === "trackingStartTime") {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
      
      chrome.action.setBadgeText({ text: "" });
      alert("All browsing data has been deleted.");
    }
  });

  function renderExcludedDomains(domains) {
    excludedList.innerHTML = "";
    if (domains.length === 0) {
      const li = document.createElement("li");
      li.className = "exclusion-item";
      li.style.color = "#6B7280";
      li.textContent = "No excluded websites.";
      excludedList.appendChild(li);
      return;
    }

    domains.forEach(domain => {
      const li = document.createElement("li");
      li.className = "exclusion-item";
      
      const span = document.createElement("span");
      span.className = "domain-name";
      span.textContent = domain;
      
      const btn = document.createElement("button");
      btn.className = "btn-remove";
      btn.textContent = "Remove";
      btn.onclick = async () => {
        const index = excludedDomains.indexOf(domain);
        if (index > -1) {
          excludedDomains.splice(index, 1);
          await chrome.storage.local.set({ excludedDomains });
          renderExcludedDomains(excludedDomains);
        }
      };
      
      li.appendChild(span);
      li.appendChild(btn);
      excludedList.appendChild(li);
    });
  }
});
