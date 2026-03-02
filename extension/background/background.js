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
};

const activeTabs = new Set();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set(DEFAULT_SETTINGS);
  }

  // Create context menu on install/update
  chrome.contextMenus.create({
    id: 'meetable-toggle',
    title: 'Toggle Meetable Captions',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://meet.google.com/*',
      'https://teams.microsoft.com/*',
      'https://app.slack.com/*',
      'https://discord.com/*',
      'https://zoom.us/*',
    ],
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }

  if (msg.action === 'tabActive' && sender.tab) {
    activeTabs.add(sender.tab.id);
    updateIcon(sender.tab.id, true);
  }

  if (msg.action === 'tabInactive' && sender.tab) {
    activeTabs.delete(sender.tab.id);
    updateIcon(sender.tab.id, false);
  }

  if (msg.action === 'getActiveTabs') {
    sendResponse({ tabs: [...activeTabs] });
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

function updateIcon(tabId, active) {
  // Use same icons but set badge to indicate active/inactive state
  chrome.action.setIcon({
    tabId,
    path: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
  }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: active ? 'ON' : '' }).catch(() => {});
  if (active) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#2DD4BF' }).catch(() => {});
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'meetable-toggle') {
    chrome.storage.sync.get(['enabled'], (data) => {
      const newEnabled = !data.enabled;
      chrome.storage.sync.set({ enabled: newEnabled });
      chrome.tabs.sendMessage(tab.id, { action: 'updateSettings', settings: { enabled: newEnabled } }).catch(() => {});
    });
  }
});
