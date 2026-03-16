'use strict';

const DEFAULT_SETTINGS = {
  enabled: true,
  profile: 'caption-only',
  captionPlacement: 'bottom',
  fontSize: 22,
  fontFamily: 'Inter',
  captionBgOpacity: 0.85,
  filterFillerWords: true,
  filterProfanity: true,
  showSpeakerLabels: true,
  persistentColors: true,
  overlapDetection: true,
  faceFocusMode: false,
  visualFlashAlerts: true,
  hotkeys: { pauseCaptions: 'Alt+P', lockFace: 'Alt+L', markMoment: 'Alt+M' },
  theme: 'dark',
  speakerSensitivity: 0.7,
  overlapSensitivity: 0.7,
  mouthSpeed: 1.0,
  audioAlerts: true,
};

const MEETING_PLATFORMS = {
  'meet.google.com': 'Google Meet',
  'teams.microsoft.com': 'Microsoft Teams',
  'app.slack.com': 'Slack',
  'discord.com': 'Discord',
  'zoom.us': 'Zoom',
};

let currentSettings = { ...DEFAULT_SETTINGS };
let currentTab = null;

// ===== DOM REFS =====
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const platformInfo = document.getElementById('platform-info');
const mainToggle = document.getElementById('main-toggle');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');
const placementSelect = document.getElementById('placement-select');
const profileSelect = document.getElementById('profile-select');
const openSettingsBtn = document.getElementById('open-settings');
const speakerBar = document.getElementById('speaker-bar');
const mouthSpeedSlider = document.getElementById('mouth-speed-slider');
const mouthSpeedValue = document.getElementById('mouth-speed-value');
const audioAlertsToggle = document.getElementById('audio-alerts-toggle');

// ===== PLATFORM DETECTION =====
function detectPlatformFromUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    for (const [domain, name] of Object.entries(MEETING_PLATFORMS)) {
      if (hostname.includes(domain)) return name;
    }
  } catch (_) {}
  return null;
}

function isMeetingUrl(url) {
  return detectPlatformFromUrl(url) !== null;
}

// ===== STATUS UPDATE =====
function updateStatus(enabled, onMeetingPage) {
  if (enabled && onMeetingPage) {
    statusDot.className = 'status-dot live';
    statusText.textContent = 'Live';
  } else if (enabled && !onMeetingPage) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Not on a meeting page';
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Offline';
  }
}

// ===== POPULATE FORM =====
function populateForm(settings) {
  mainToggle.setAttribute('aria-checked', String(settings.enabled));

  fontSizeSlider.value = settings.fontSize;
  fontSizeValue.textContent = settings.fontSize + 'px';

  mouthSpeedSlider.value = settings.mouthSpeed;
  mouthSpeedValue.textContent = settings.mouthSpeed.toFixed(1) + 'x';

  audioAlertsToggle.setAttribute('aria-checked', String(settings.audioAlerts));

  placementSelect.value = settings.captionPlacement;
  profileSelect.value = settings.profile;
}

// ===== SEND MESSAGE TO CONTENT SCRIPT =====
function sendToContent(settings) {
  if (!currentTab || !currentTab.id) return;
  chrome.tabs.sendMessage(currentTab.id, { action: 'updateSettings', settings }, () => {
    if (chrome.runtime.lastError) {
      // Content script not ready or not on a meeting page — safe to ignore
    }
  });
}

// ===== SAVE SETTINGS =====
function saveAndSync(patch) {
  currentSettings = { ...currentSettings, ...patch };
  chrome.storage.sync.set(currentSettings, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Meetable] Error saving settings:', chrome.runtime.lastError.message);
    }
  });
  sendToContent(patch);
}

// ===== SPEAKER BAR =====
function renderSpeakerBar() {
  const SPEAKER_COLORS = ['#2DD4BF', '#60A5FA', '#F472B6', '#A78BFA', '#34D399', '#FBBF24'];
  speakerBar.innerHTML = '';
  // Render a placeholder bar with equal segments for each color
  SPEAKER_COLORS.forEach(color => {
    const seg = document.createElement('div');
    seg.className = 'speaker-bar-segment';
    seg.style.background = color;
    seg.style.flex = '1';
    seg.style.opacity = '0.25';
    speakerBar.appendChild(seg);
  });
}

// ===== EVENT LISTENERS =====

// Main toggle
mainToggle.addEventListener('click', () => {
  const newEnabled = mainToggle.getAttribute('aria-checked') !== 'true';
  mainToggle.setAttribute('aria-checked', String(newEnabled));
  saveAndSync({ enabled: newEnabled });
  updateStatus(newEnabled, currentTab ? isMeetingUrl(currentTab.url) : false);
});

// Font size slider
fontSizeSlider.addEventListener('input', () => {
  const size = parseInt(fontSizeSlider.value, 10);
  fontSizeValue.textContent = size + 'px';
  saveAndSync({ fontSize: size });
});

// Placement select
placementSelect.addEventListener('change', () => {
  saveAndSync({ captionPlacement: placementSelect.value });
});

// Profile select
profileSelect.addEventListener('change', () => {
  const profile = profileSelect.value;
  const patch = { profile };

  if (profile === 'lip-reader') {
    patch.faceFocusMode = true;
    patch.mouthSpeed = 0.5;
    patch.fontSize = 28;
    patch.showSpeakerLabels = true;
  } else if (profile === 'minimal') {
    patch.faceFocusMode = false;
    patch.showSpeakerLabels = false;
    patch.visualFlashAlerts = false;
  } else if (profile === 'caption-only') {
    patch.faceFocusMode = false;
    patch.mouthSpeed = 1.0;
    patch.showSpeakerLabels = true;
  }
  
  saveAndSync(patch);
  populateForm({ ...currentSettings, ...patch });
});

// Mouth speed slider
mouthSpeedSlider.addEventListener('input', () => {
  const speed = parseFloat(mouthSpeedSlider.value);
  mouthSpeedValue.textContent = speed.toFixed(1) + 'x';
  saveAndSync({ mouthSpeed: speed });
});

// Audio alerts toggle
audioAlertsToggle.addEventListener('click', () => {
  const newEnabled = audioAlertsToggle.getAttribute('aria-checked') !== 'true';
  audioAlertsToggle.setAttribute('aria-checked', String(newEnabled));
  saveAndSync({ audioAlerts: newEnabled });
});

// Open settings
openSettingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Load settings
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    if (chrome.runtime.lastError) {
      console.warn('[Meetable] Error loading settings:', chrome.runtime.lastError.message);
    }
    currentSettings = { ...DEFAULT_SETTINGS, ...stored };
    populateForm(currentSettings);
    renderSpeakerBar();

    // Get current tab info
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
          updateStatus(currentSettings.enabled, false);
          return;
        }
        currentTab = tabs[0];
        const platform = detectPlatformFromUrl(currentTab.url);
        const onMeeting = platform !== null;

        if (platform) {
          platformInfo.textContent = platform + ' detected';
        }

        updateStatus(currentSettings.enabled, onMeeting);

        // Query content script for live status
        if (onMeeting) {
          chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' }, (response) => {
            if (chrome.runtime.lastError) return;
            if (response && response.enabled !== undefined) {
              currentSettings.enabled = response.enabled;
              mainToggle.setAttribute('aria-checked', String(response.enabled));
              updateStatus(response.enabled, onMeeting);
            }
          });
        }
      });
    } else {
      updateStatus(currentSettings.enabled, false);
    }
  });
});
