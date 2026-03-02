const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.join(__dirname, '..', 'extension');

test.describe('Meetable Extension - Manifest', () => {
  test('manifest.json is valid', () => {
    const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Meetable');
    expect(manifest.version).toBeDefined();
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('tabs');
    expect(manifest.background).toBeDefined();
    expect(manifest.action).toBeDefined();
  });
});

test.describe('Meetable Extension - Popup', () => {
  test('popup.html exists and has required elements', () => {
    const popupPath = path.join(EXTENSION_PATH, 'popup', 'popup.html');
    expect(fs.existsSync(popupPath)).toBe(true);
    const html = fs.readFileSync(popupPath, 'utf-8');
    expect(html).toContain('main-toggle');
    expect(html).toContain('font-size-slider');
    expect(html).toContain('placement-select');
    expect(html).toContain('profile-select');
    expect(html).toContain('open-settings');
  });
});

test.describe('Meetable Extension - Content Script', () => {
  test('content.js exists and contains required features', () => {
    const contentPath = path.join(EXTENSION_PATH, 'content', 'content.js');
    expect(fs.existsSync(contentPath)).toBe(true);
    const js = fs.readFileSync(contentPath, 'utf-8');
    expect(js).toContain('meetable-caption-overlay');
    expect(js).toContain('SpeechRecognition');
    expect(js).toContain('filterText');
    expect(js).toContain('SPEAKER_COLORS');
    expect(js).toContain('exportTranscript');
    expect(js).toContain('hotkeys');
  });

  test('content.css exists and has required styles', () => {
    const cssPath = path.join(EXTENSION_PATH, 'content', 'content.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('meetable-caption-overlay');
    expect(css).toContain('meetable-caption-block');
    expect(css).toContain('meetable-overlap-warning');
    expect(css).toContain('brand-teal');
  });
});

test.describe('Meetable Extension - Options Page', () => {
  test('options.html exists with required sections', () => {
    const optionsPath = path.join(EXTENSION_PATH, 'options', 'options.html');
    expect(fs.existsSync(optionsPath)).toBe(true);
    const html = fs.readFileSync(optionsPath, 'utf-8');
    expect(html).toContain('section-profiles');
    expect(html).toContain('section-captions');
    expect(html).toContain('section-speakers');
    expect(html).toContain('section-hotkeys');
    expect(html).toContain('save-btn');
    expect(html).toContain('reset-btn');
  });
});

test.describe('Meetable Extension - Utils', () => {
  test('storage.js exists with required functions', () => {
    const storagePath = path.join(EXTENSION_PATH, 'utils', 'storage.js');
    expect(fs.existsSync(storagePath)).toBe(true);
    const js = fs.readFileSync(storagePath, 'utf-8');
    expect(js).toContain('getSettings');
    expect(js).toContain('saveSettings');
    expect(js).toContain('resetSettings');
    expect(js).toContain('DEFAULT_SETTINGS');
  });

  test('speech.js exists with SpeechEngine class', () => {
    const speechPath = path.join(EXTENSION_PATH, 'utils', 'speech.js');
    expect(fs.existsSync(speechPath)).toBe(true);
    const js = fs.readFileSync(speechPath, 'utf-8');
    expect(js).toContain('SpeechEngine');
    expect(js).toContain('start');
    expect(js).toContain('stop');
    expect(js).toContain('pause');
  });

  test('speakers.js exists with SpeakerManager class', () => {
    const speakersPath = path.join(EXTENSION_PATH, 'utils', 'speakers.js');
    expect(fs.existsSync(speakersPath)).toBe(true);
    const js = fs.readFileSync(speakersPath, 'utf-8');
    expect(js).toContain('SpeakerManager');
    expect(js).toContain('SPEAKER_COLORS');
    expect(js).toContain('getSpeaker');
  });
});

test.describe('Meetable Extension - Icons', () => {
  test('all icon PNGs exist', () => {
    [16, 32, 48, 128].forEach(size => {
      const iconPath = path.join(EXTENSION_PATH, 'icons', `icon${size}.png`);
      expect(fs.existsSync(iconPath)).toBe(true);
    });
  });
});

test.describe('Meetable Extension - Design System', () => {
  test('popup.css has all required CSS custom properties', () => {
    const cssPath = path.join(EXTENSION_PATH, 'popup', 'popup.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--surface-base');
    expect(css).toContain('--brand-teal');
    expect(css).toContain('--signal-overlap');
    expect(css).toContain('--text-primary');
  });

  test('popup.css has focus ring styles', () => {
    const cssPath = path.join(EXTENSION_PATH, 'popup', 'popup.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('focus-visible');
    expect(css).toContain('2px solid');
  });

  test('popup.css respects prefers-reduced-motion', () => {
    const cssPath = path.join(EXTENSION_PATH, 'popup', 'popup.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('prefers-reduced-motion');
  });
});

test.describe('Meetable Extension - Background', () => {
  test('background.js exists with required handlers', () => {
    const bgPath = path.join(EXTENSION_PATH, 'background', 'background.js');
    expect(fs.existsSync(bgPath)).toBe(true);
    const js = fs.readFileSync(bgPath, 'utf-8');
    expect(js).toContain('onInstalled');
    expect(js).toContain('DEFAULT_SETTINGS');
    expect(js).toContain('onMessage');
  });
});
