import { formatDuration, getTodayKey } from "./utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("date-display").textContent = new Date().toLocaleDateString(undefined, dateOptions);

  await loadDashboardData();
});

async function loadDashboardData() {
  const todayKey = getTodayKey();
  const allData = await chrome.storage.local.get(null);
  
  const todayStats = allData[todayKey] || {};
  
  renderSummaryCards(todayStats);
  renderTodayChart(todayStats);
  renderUsageTable(todayStats);
  renderHistoryChart(allData);
}

function renderSummaryCards(stats) {
  const entries = Object.entries(stats);
  const totalMs = entries.reduce((sum, [, time]) => sum + time, 0);
  
  document.getElementById("stat-total-time").textContent = formatDuration(totalMs);
  document.getElementById("stat-websites-count").textContent = entries.length;
  
  if (entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1]);
    document.getElementById("stat-most-used").textContent = entries[0][0];
    
    const avgMs = totalMs / entries.length;
    document.getElementById("stat-average-time").textContent = formatDuration(avgMs);
  } else {
    document.getElementById("stat-most-used").textContent = "-";
    document.getElementById("stat-average-time").textContent = "0s";
  }
}

function renderTodayChart(stats) {
  const chartEl = document.getElementById("today-chart");
  chartEl.innerHTML = "";
  
  const entries = Object.entries(stats);
  if (entries.length === 0) {
    chartEl.innerHTML = `<div class="empty-state">No activity yet today.</div>`;
    return;
  }
  
  entries.sort((a, b) => b[1] - a[1]);
  const maxMs = entries[0][1];
  const top5 = entries.slice(0, 5);
  
  top5.forEach(([domain, ms]) => {
    const percentageOfMax = Math.max((ms / maxMs) * 100, 2); // Min 2% for visibility
    const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://${domain}&size=16`;
    
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-label" title="${domain}">
        <img src="${faviconUrl}" onerror="this.src='icons/icon16.png'" alt="">
        ${domain}
      </div>
      <div class="chart-bar-container">
        <div class="chart-bar" style="width: ${percentageOfMax}%; background-color: ${getColorForIndex(top5.indexOf(entries.find(e => e[0] === domain)))};"></div>
      </div>
      <div class="chart-value">${formatDuration(ms)}</div>
    `;
    chartEl.appendChild(row);
  });
}

function renderUsageTable(stats) {
  const tbody = document.getElementById("usage-table-body");
  tbody.innerHTML = "";
  
  const entries = Object.entries(stats);
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No websites tracked today.</td></tr>`;
    return;
  }
  
  const totalMs = entries.reduce((sum, [, time]) => sum + time, 0);
  entries.sort((a, b) => b[1] - a[1]);
  
  entries.forEach(([domain, ms]) => {
    const percentage = Math.round((ms / totalMs) * 100) || '<1';
    const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://${domain}&size=16`;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="td-website">
        <img src="${faviconUrl}" onerror="this.src='icons/icon16.png'" alt="">
        ${domain}
      </td>
      <td>${formatDuration(ms)}</td>
      <td class="td-percentage">${percentage}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderHistoryChart(allData) {
  const chartEl = document.getElementById("history-chart");
  chartEl.innerHTML = "";
  
  const last7Days = [];
  const now = new Date();
  
  // Generate last 7 days keys
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    
    last7Days.push({ key, dayName, data: allData[key] || {} });
  }
  
  // Calculate totals
  const dailyTotals = last7Days.map(day => {
    return Object.values(day.data).reduce((sum, ms) => sum + ms, 0);
  });
  
  const maxDailyMs = Math.max(...dailyTotals, 1); // Avoid division by zero
  
  last7Days.forEach((day, index) => {
    const totalMs = dailyTotals[index];
    const heightPercent = Math.max((totalMs / maxDailyMs) * 100, totalMs > 0 ? 5 : 0);
    
    const group = document.createElement("div");
    group.className = "v-bar-group";
    
    const tooltipText = totalMs > 0 ? formatDuration(totalMs) : "No data";
    
    group.innerHTML = `
      <div class="v-bar" style="height: ${heightPercent}%" data-tooltip="${tooltipText}"></div>
      <div class="v-label">${day.dayName}</div>
    `;
    chartEl.appendChild(group);
  });
}

function getColorForIndex(index) {
  const colors = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE"];
  return colors[Math.min(index, colors.length - 1)];
}
