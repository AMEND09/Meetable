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
  transcript: [],
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
      resolve({ ...DEFAULT_SETTINGS, ...data });
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

async function resetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set(DEFAULT_SETTINGS, resolve);
  });
}

async function migrateSettings() {
  const current = await getSettings();
  // v1.0.0: no migration needed
  return current;
}

// Export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = { DEFAULT_SETTINGS, getSettings, saveSettings, resetSettings, migrateSettings };
}
