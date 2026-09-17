# TimeTrack Chrome Extension

TimeTrack is a complete, local-only Chrome extension that automatically tracks how much active time you spend on different websites. It is built entirely with Vanilla JavaScript, HTML, CSS, and Manifest V3, without relying on external APIs, databases, or third-party libraries.

## Features

- **Automatic Website Tracking**: Tracks active browsing time based on domain (e.g., `youtube.com`).
- **Idle Detection**: Pauses tracking automatically when you step away from your computer (configurable timeout).
- **Window Focus Handling**: Stops tracking when Chrome is no longer the active window.
- **Privacy-First (Local Storage)**: All browsing statistics are stored locally on your device via Chrome's storage API. No external network requests are made.
- **Daily Summaries & Auto-Reset**: Automatically begins a new tracking period at midnight and keeps up to 30 days of historical data.
- **Modern Dashboard**: Features an intuitive dashboard with CSS-based bar charts displaying today's usage and a 7-day history.
- **Excluded Websites**: Option to whitelist/exclude specific domains (e.g., internal work tools, localhost).
- **Pause Tracking**: A toggle to completely pause all time tracking.
- **Extension Badge**: Optionally shows your total accumulated browsing time for the day directly on the extension icon.

## Technology Stack

- **Chrome Extension Manifest V3**
- **HTML5 & Vanilla CSS**
- **Vanilla JavaScript**
- **Chrome APIs**: `tabs`, `storage`, `idle`, `alarms`, `windows`

## Folder Structure

```text
TimeTrack/
│
├── manifest.json         # Extension configuration
├── background.js         # Service worker handling tracking state & Chrome events
├── utils.js              # Shared utility functions (time formatting, domain parsing)
│
├── popup.html            # Extension popup UI
├── popup.css             # Popup styling
├── popup.js              # Popup logic (live timer and top 5 websites)
│
├── dashboard.html        # Full dashboard UI
├── dashboard.css         # Dashboard and general settings styling
├── dashboard.js          # Dashboard logic (charts and daily stats)
│
├── options.html          # Settings UI
├── options.js            # Settings logic (exclusions, idle timeout, reset)
│
├── icons/                # Extension icons
└── README.md             # Project documentation
```

## How the Tracking Architecture Works

The tracking logic relies on a robust Service Worker (`background.js`) to guarantee accurate timing without unnecessarily draining system resources.

1. **Event-Driven Tracking**: Instead of running a `setInterval` loop every second (which is inefficient), the extension records a `trackingStartTime` timestamp whenever a valid tab becomes active. 
2. **Tab & Window Management**: Listeners for `tabs.onActivated`, `tabs.onUpdated`, and `windows.onFocusChanged` detect when the user switches contexts. Before a switch occurs, the elapsed time is calculated (`Date.now() - trackingStartTime`) and saved.
3. **Idle Management**: The `chrome.idle.onStateChanged` API detects when the user is inactive (e.g., walked away or screen locked), stopping the timer until they return.
4. **Resiliency**: Since Manifest V3 service workers can be suspended by the browser, `chrome.alarms` is used to periodically sync the ongoing session to storage (checkpointing). State variables like `currentDomain` and `trackingStartTime` are also persisted to `chrome.storage.local` to safely recover from unexpected worker restarts.

## Privacy Explanation

Your privacy is the core principle of TimeTrack. 
- **Zero Network Requests**: The extension makes absolute zero network requests. It does not contain any analytics, crash reporting, or tracking scripts.
- **Local Storage Only**: All data is saved on your hard drive inside Chrome's secure local storage environment.
- **No Third-Party APIs**: Favicons are retrieved using Chrome's native, privacy-preserving `chrome-extension://[id]/_favicon/` API rather than relying on external web services.

## Installation Instructions

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left corner.
5. Select the `TimeTrack` folder you downloaded.
6. The extension is now installed! You can click the puzzle icon in the Chrome toolbar and pin TimeTrack for easy access.

## Testing the Extension

To verify that tracking works correctly:
- **Tab Switching**: Open `youtube.com` and watch the timer in the popup increase. Switch to another tab (e.g., `github.com`); you should see tracking stop for YouTube and start for GitHub.
- **Idle Detection**: Change the idle timeout in Settings to 1 minute, and don't touch your mouse or keyboard for 60 seconds. The tracking should pause.
- **Excluded Websites**: Add `example.com` to the excluded list in Settings, visit the site, and verify the popup shows "Idle / Not tracking".
- **Pause Tracking**: Toggle the Pause switch in Settings, and verify no time is accumulated anywhere.
- **Dashboard Data**: Click "View Full Dashboard" from the popup to see your accumulated data rendered accurately on the charts.
