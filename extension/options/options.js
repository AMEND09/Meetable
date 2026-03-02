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

let currentSettings = { ...DEFAULT_SETTINGS };
let saveDebounceTimer = null;

// ===== UTILITY =====
function debounce(fn, delay) {
  return function (...args) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ===== POPULATE FORM =====
function populateForm(settings) {
  // Profile cards
  document.querySelectorAll('.profile-card').forEach(card => {
    const isSelected = card.dataset.profile === settings.profile;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-checked', String(isSelected));
  });

  // Captions
  setRange('font-size', 'font-size-display', settings.fontSize, v => v + 'px');
  setSelect('font-family', settings.fontFamily);
  setSelect('caption-placement', settings.captionPlacement);
  setRange('bg-opacity', 'bg-opacity-display', settings.captionBgOpacity, v => Math.round(v * 100) + '%');

  setToggle('filter-filler-toggle', settings.filterFillerWords);
  setToggle('filter-profanity-toggle', settings.filterProfanity);

  // Speakers
  setToggle('speaker-labels-toggle', settings.showSpeakerLabels);
  setToggle('persistent-colors-toggle', settings.persistentColors);

  // Overlap
  setToggle('overlap-detection-toggle', settings.overlapDetection);
  setRange('overlap-sensitivity', 'overlap-sensitivity-display', settings.overlapSensitivity, v => Math.round(v * 100) + '%');

  // Face focus
  setToggle('face-focus-toggle', settings.faceFocusMode);

  // Visual alerts
  setToggle('visual-flash-toggle', settings.visualFlashAlerts);

  // Hotkeys
  setInput('hotkey-pause', settings.hotkeys.pauseCaptions);
  setInput('hotkey-lock', settings.hotkeys.lockFace);
  setInput('hotkey-mark', settings.hotkeys.markMoment);
}

function setRange(rangeId, displayId, value, formatter) {
  const el = document.getElementById(rangeId);
  const display = document.getElementById(displayId);
  if (el) el.value = value;
  if (display) display.textContent = formatter(value);
}

function setSelect(selectId, value) {
  const el = document.getElementById(selectId);
  if (el) el.value = value;
}

function setToggle(btnId, value) {
  const el = document.getElementById(btnId);
  if (el) el.setAttribute('aria-checked', String(value));
}

function setInput(inputId, value) {
  const el = document.getElementById(inputId);
  if (el) el.value = value;
}

// ===== SAVE SETTINGS =====
function saveSettings(showFeedback = false) {
  chrome.storage.sync.set(currentSettings, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Meetable] Error saving settings:', chrome.runtime.lastError.message);
      return;
    }
    if (showFeedback) {
      showSaveFeedback();
    }
  });
}

const debouncedSave = debounce(() => saveSettings(false), 300);

function showSaveFeedback() {
  const feedback = document.getElementById('save-feedback');
  if (!feedback) return;
  feedback.textContent = '✓ Saved!';
  feedback.classList.add('visible');
  setTimeout(() => {
    feedback.classList.remove('visible');
    setTimeout(() => { feedback.textContent = ''; }, 200);
  }, 2000);
}

// ===== EVENT BINDING =====
function bindEvents() {
  // Profile cards
  document.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => selectProfile(card.dataset.profile));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectProfile(card.dataset.profile);
      }
    });
  });

  // Caption size
  bindRange('font-size', 'font-size-display', 'fontSize', v => parseInt(v, 10), v => v + 'px');

  // Font family
  bindSelectField('font-family', 'fontFamily');

  // Placement
  bindSelectField('caption-placement', 'captionPlacement');

  // BG opacity
  bindRange('bg-opacity', 'bg-opacity-display', 'captionBgOpacity', v => parseFloat(v), v => Math.round(v * 100) + '%');

  // Toggles
  bindToggle('filter-filler-toggle', 'filterFillerWords');
  bindToggle('filter-profanity-toggle', 'filterProfanity');
  bindToggle('speaker-labels-toggle', 'showSpeakerLabels');
  bindToggle('persistent-colors-toggle', 'persistentColors');
  bindToggle('overlap-detection-toggle', 'overlapDetection');
  bindToggle('face-focus-toggle', 'faceFocusMode');
  bindToggle('visual-flash-toggle', 'visualFlashAlerts');

  // Overlap sensitivity
  bindRange('overlap-sensitivity', 'overlap-sensitivity-display', 'overlapSensitivity', v => parseFloat(v), v => Math.round(v * 100) + '%');

  // Hotkeys
  bindHotkey('hotkey-pause', 'pauseCaptions');
  bindHotkey('hotkey-lock', 'lockFace');
  bindHotkey('hotkey-mark', 'markMoment');

  // Save button
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveSettings(true));
  }

  // Reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleReset);
  }

  // Export button
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }

  // Clear history
  const clearBtn = document.getElementById('clear-history-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', handleClearHistory);
  }
}

function bindRange(rangeId, displayId, settingKey, parseVal, formatDisplay) {
  const el = document.getElementById(rangeId);
  const display = document.getElementById(displayId);
  if (!el) return;
  el.addEventListener('input', () => {
    const val = parseVal(el.value);
    currentSettings[settingKey] = val;
    if (display) display.textContent = formatDisplay(val);
    debouncedSave();
  });
}

function bindSelectField(selectId, settingKey) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.addEventListener('change', () => {
    currentSettings[settingKey] = el.value;
    debouncedSave();
  });
}

function bindToggle(btnId, settingKey) {
  const el = document.getElementById(btnId);
  if (!el || el.disabled) return;
  el.addEventListener('click', () => {
    const newVal = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(newVal));
    currentSettings[settingKey] = newVal;
    debouncedSave();
  });
}

function bindHotkey(inputId, hotkeyKey) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('change', () => {
    const value = el.value.trim();
    if (validateHotkey(value)) {
      currentSettings.hotkeys[hotkeyKey] = value;
      el.style.borderColor = '';
      debouncedSave();
    } else {
      el.style.borderColor = 'var(--signal-overlap)';
    }
  });
}

function validateHotkey(combo) {
  if (!combo) return false;
  // Valid format: optional modifiers (Alt, Shift, Ctrl) + key, joined by "+"
  return /^(Alt\+|Shift\+|Ctrl\+){1,3}[A-Za-z0-9]$/.test(combo);
}

function selectProfile(profile) {
  currentSettings.profile = profile;
  document.querySelectorAll('.profile-card').forEach(card => {
    const isSelected = card.dataset.profile === profile;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-checked', String(isSelected));
  });
  debouncedSave();
}

// ===== ACTIONS =====
function handleReset() {
  const confirmed = window.confirm('Reset all settings to defaults? This cannot be undone.');
  if (!confirmed) return;
  currentSettings = { ...DEFAULT_SETTINGS };
  chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Meetable] Error resetting settings:', chrome.runtime.lastError.message);
      return;
    }
    populateForm(DEFAULT_SETTINGS);
    showSaveFeedback();
  });
}

function handleExport() {
  chrome.storage.local.get(['transcript'], (data) => {
    if (chrome.runtime.lastError) return;
    const transcript = data.transcript || [];
    const preview = document.getElementById('transcript-preview');

    if (transcript.length === 0) {
      if (preview) {
        preview.innerHTML = '<p class="transcript-empty">No transcript available. Start a meeting to begin capturing captions.</p>';
      }
      return;
    }

    const lines = transcript.map(t => `[${t.time}] ${t.speaker}: ${t.text}`);
    const content = lines.join('\n');

    if (preview) {
      preview.innerHTML = lines.map(l =>
        `<div class="transcript-line">${escapeHtml(l)}</div>`
      ).join('');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meetable-transcript-' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function handleClearHistory() {
  const confirmed = window.confirm('Clear all transcript history? This cannot be undone.');
  if (!confirmed) return;
  chrome.storage.local.remove(['transcript'], () => {
    const preview = document.getElementById('transcript-preview');
    if (preview) {
      preview.innerHTML = '<p class="transcript-empty">Transcript history cleared.</p>';
    }
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== SIDEBAR NAVIGATION =====
function setupSidebarNav() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.getAttribute('href').slice(1);
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Highlight active section on scroll
  const sections = document.querySelectorAll('.section[id]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const sectionKey = id.replace('section-', '');
          navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionKey);
          });
        }
      });
    },
    { threshold: 0.3, rootMargin: '-80px 0px -60% 0px' }
  );

  sections.forEach(section => observer.observe(section));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    if (chrome.runtime.lastError) {
      console.warn('[Meetable] Error loading settings:', chrome.runtime.lastError.message);
    }
    currentSettings = { ...DEFAULT_SETTINGS, ...stored };
    // Ensure hotkeys object is complete
    currentSettings.hotkeys = { ...DEFAULT_SETTINGS.hotkeys, ...(stored.hotkeys || {}) };

    populateForm(currentSettings);
    bindEvents();
    setupSidebarNav();
  });
});
