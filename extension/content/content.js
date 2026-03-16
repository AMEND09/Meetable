(function () {
  'use strict';

  if (window.__meetableLoaded) return;
  window.__meetableLoaded = true;

  // --- CONSTANTS ---
  const SPEAKER_COLORS = ['#2DD4BF', '#60A5FA', '#F472B6', '#A78BFA', '#34D399', '#FBBF24'];
  const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of'];
  const PROFANITY_LIST = ['damn', 'hell', 'crap']; // mild list for demo

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

  // --- STATE ---
  let settings = { ...DEFAULT_SETTINGS };
  let recognition = null;
  let isRecognizing = false;
  let isPaused = false;
  let captionOverlay = null;
  let controlBar = null;
  let flashBorder = null;
  let transcript = [];
  let speakers = {};
  let currentSpeakerIdx = 0;
  let activeSpeechSegments = [];
  let overlapWarning = null;
  let isOverlapping = false;
  let faceFocusLocked = false;
  let meetingNotes = [];
  let isDragging = false;

  // ML models
  let faceLandmarker = null;
  let audioClassifier = null;
  let audioCtx = null;
  let micStream = null;
  let zoomCanvas = null;
  let zoomCtx = null;
  let rafId = null;

  // Mediapipe WASM paths (using unpkg or jsdelivr CDN format, but handled via the global objects injected in manifest)
  function matchesHost(hostname, domain) {
    return hostname === domain || hostname.endsWith('.' + domain);
  }

  function detectPlatform() {
    const host = window.location.hostname;
    if (matchesHost(host, 'meet.google.com')) return 'Google Meet';
    if (matchesHost(host, 'teams.microsoft.com')) return 'Microsoft Teams';
    if (matchesHost(host, 'slack.com')) return 'Slack';
    if (matchesHost(host, 'discord.com')) return 'Discord';
    if (matchesHost(host, 'zoom.us')) return 'Zoom';
    return 'Unknown';
  }

  // --- FONT INJECTION ---
  function injectFonts() {
    if (document.getElementById('meetable-fonts')) return;
    const link = document.createElement('link');
    link.id = 'meetable-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap';
    document.head.appendChild(link);
  }

  // --- SETTINGS ---
  function loadSettings(callback) {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      settings = { ...DEFAULT_SETTINGS, ...stored };
      if (callback) callback();
    });
  }

  // --- SPEAKER MANAGEMENT ---
  function getSpeaker(idx) {
    const key = 'speaker_' + idx;
    if (!speakers[key]) {
      speakers[key] = {
        idx,
        name: 'Speaker ' + (idx + 1),
        color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
        talkTime: 0,
        segments: 0,
      };
    }
    return speakers[key];
  }

  // --- TEXT PROCESSING ---
  function filterText(text) {
    let result = text;
    if (settings.filterFillerWords) {
      FILLER_WORDS.forEach(word => {
        const re = new RegExp('\\b' + word + '\\b', 'gi');
        result = result.replace(re, '');
      });
    }
    if (settings.filterProfanity) {
      PROFANITY_LIST.forEach(word => {
        const re = new RegExp('\\b' + word + '\\b', 'gi');
        result = result.replace(re, '****');
      });
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  function detectIntent(text) {
    const lower = text.toLowerCase().trim();
    if (lower.endsWith('?')) return 'question';
    const actionPhrases = ['we should', 'i will', "let's", 'we need to', 'action item', 'follow up'];
    if (actionPhrases.some(p => lower.startsWith(p))) return 'action';
    return 'normal';
  }

  // --- CAPTION UI ---
  function createCaptionOverlay() {
    if (document.getElementById('meetable-caption-overlay')) {
      captionOverlay = document.getElementById('meetable-caption-overlay');
      return;
    }
    captionOverlay = document.createElement('div');
    captionOverlay.id = 'meetable-caption-overlay';
    captionOverlay.setAttribute('aria-live', 'polite');
    captionOverlay.setAttribute('aria-label', 'Meetable live captions');
    captionOverlay.setAttribute('data-placement', settings.captionPlacement);
    document.body.appendChild(captionOverlay);

    flashBorder = document.createElement('div');
    flashBorder.className = 'meetable-flash-border';
    document.body.appendChild(flashBorder);

    if (settings.captionPlacement === 'floating') {
      setupFloatingDrag(captionOverlay);
    }
  }

  function createOverlapWarning() {
    if (overlapWarning) return;
    overlapWarning = document.createElement('div');
    overlapWarning.className = 'meetable-overlap-warning';
    overlapWarning.setAttribute('aria-live', 'assertive');
    overlapWarning.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F87171" stroke-width="1.75" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>Multiple people speaking</span>`;
    captionOverlay.insertBefore(overlapWarning, captionOverlay.firstChild);
  }

  function removeOverlapWarning() {
    if (overlapWarning && overlapWarning.parentNode) {
      overlapWarning.parentNode.removeChild(overlapWarning);
      overlapWarning = null;
    }
    isOverlapping = false;
  }

  function addCaptionBlock(speaker, text, isFinal) {
    if (!captionOverlay) return;
    const intent = detectIntent(text);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Update existing interim block for same speaker
    const existingInterim = captionOverlay.querySelector('.meetable-caption-block[data-speaker="' + speaker.idx + '"].interim');
    if (!isFinal && existingInterim) {
      existingInterim.querySelector('.meetable-caption-text').textContent = text;
      return;
    }

    const block = document.createElement('div');
    block.className = 'meetable-caption-block' + (!isFinal ? ' interim' : '');
    block.setAttribute('data-speaker', speaker.idx);
    if (intent !== 'normal') block.setAttribute('data-intent', intent);

    let intentIcon = '';
    if (intent === 'question') {
      intentIcon = `<svg class="meetable-intent-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else if (intent === 'action') {
      intentIcon = `<svg class="meetable-intent-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="1.75" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
    }

    const speakerTagHtml = settings.showSpeakerLabels
      ? `<span class="meetable-speaker-tag" style="background:${speaker.color}33;color:${speaker.color};border:1px solid ${speaker.color}66;" data-speaker-idx="${speaker.idx}">${speaker.name}</span>`
      : '';

    block.innerHTML = `
      <div class="meetable-caption-header">
        ${speakerTagHtml}
        <span class="meetable-timestamp">${timestamp}</span>
        ${intentIcon}
      </div>
      <div class="meetable-caption-text" style="font-size:${settings.fontSize}px;">${text}</div>
    `;

    captionOverlay.appendChild(block);

    // Keep max 5 visible blocks
    const allBlocks = captionOverlay.querySelectorAll('.meetable-caption-block');
    if (allBlocks.length > 5) {
      allBlocks[0].remove();
    }

    if (isFinal) {
      transcript.push({ speaker: speaker.name, text, time: timestamp, type: intent });
      if (intent !== 'normal') {
        meetingNotes.push({ speaker: speaker.name, text, time: timestamp, type: intent });
      }

      // Remove interim block now that we have a final
      const interim = captionOverlay.querySelector('.meetable-caption-block[data-speaker="' + speaker.idx + '"].interim');
      if (interim) interim.remove();
    }

    // Speaker tag rename interaction
    const tag = block.querySelector('.meetable-speaker-tag');
    if (tag) {
      tag.style.pointerEvents = 'auto';
      tag.style.cursor = 'pointer';
      tag.addEventListener('click', () => promptRenameSpeaker(speaker.idx));
    }
  }

  function promptRenameSpeaker(idx) {
    const sp = getSpeaker(idx);
    const name = window.prompt('Rename speaker:', sp.name);
    if (name && name.trim()) {
      sp.name = name.trim();
      document.querySelectorAll(`.meetable-speaker-tag[data-speaker-idx="${idx}"]`).forEach(el => {
        el.textContent = sp.name;
      });
    }
  }

  function triggerFlash(color) {
    if (!settings.visualFlashAlerts || !flashBorder) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    flashBorder.style.borderColor = color;
    if (mq.matches) {
      setTimeout(() => { flashBorder.style.borderColor = 'transparent'; }, 1000);
    } else {
      flashBorder.style.transition = 'border-color 400ms ease-in-out';
      setTimeout(() => {
        flashBorder.style.borderColor = 'transparent';
      }, 1400);
    }
  }

  // --- OVERLAP DETECTION ---
  function checkOverlap() {
    if (!settings.overlapDetection) return false;
    const now = Date.now();
    activeSpeechSegments = activeSpeechSegments.filter(s => (now - s.start) < 3000);

    const overlap = activeSpeechSegments.some(
      s => s.speakerIdx !== currentSpeakerIdx && (now - s.start) < 2000
    );

    if (overlap && !isOverlapping) {
      isOverlapping = true;
      createOverlapWarning();
      meetingNotes.push({ type: 'overlap', time: new Date().toLocaleTimeString(), text: 'Missed due to overlap' });
    }
    activeSpeechSegments.push({ start: now, speakerIdx: currentSpeakerIdx });
    return overlap;
  }

  // --- SPEECH RECOGNITION ---
  function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('[Meetable] SpeechRecognition API not available in this browser.');
      return;
    }

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => { isRecognizing = true; };

    recognition.onresult = (event) => {
      if (isPaused || !settings.enabled) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const rawText = result[0].transcript;
        const filtered = filterText(rawText);
        if (!filtered) continue;

        const isFinal = result.isFinal;

        if (isFinal) {
          currentSpeakerIdx = (currentSpeakerIdx + 1) % Math.max(1, Math.min(3, Object.keys(speakers).length));
          const speaker = getSpeaker(currentSpeakerIdx);
          speaker.talkTime++;
          speaker.segments++;
          checkOverlap();
          triggerFlash('#34D399');
          addCaptionBlock(speaker, filtered, true);

          setTimeout(() => {
            if (isOverlapping) removeOverlapWarning();
          }, 2500);
        } else {
          const speaker = getSpeaker(currentSpeakerIdx);
          addCaptionBlock(speaker, filtered, false);
        }
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.warn('[Meetable] Speech recognition error:', e.error);
      }
    };

    recognition.onend = () => {
      isRecognizing = false;
      if (settings.enabled && !isPaused) {
        setTimeout(() => startRecognition(), 300);
      }
    };
  }

  function startRecognition() {
    if (!recognition || isRecognizing || !settings.enabled || isPaused) return;
    try { recognition.start(); } catch (e) { /* already started */ }
  }

  function stopRecognition() {
    if (recognition && isRecognizing) {
      try { recognition.stop(); } catch (e) { /* already stopped */ }
    }
  }

  // --- FACE FOCUS (LIP READING) ---
  // Skin-color face detection + frame-buffer slow-motion playback

  // Smoothed face center (normalized 0–1 within video frame)
  let smoothFaceCX = 0.5;
  let smoothFaceCY = 0.45;
  let faceDetected = false;

  // Analysis canvas for skin detection (tiny, reused)
  let analysisCanvas = null;
  let analysisCtx = null;
  const SAMPLE_W = 80;
  const SAMPLE_H = 60;

  // Frame buffer for slow-motion replay
  const FRAME_BUF_SIZE = 90;            // ~3 seconds at 30fps
  let frameBuf = [];
  let frameWritePos = 0;
  let frameReadPos = 0;
  let lastCaptureTime = 0;
  let lastRenderTime = 0;
  let captureCanvas = null;             // offscreen canvas for grabbing mouth crops
  let captureCtx = null;

  // ---- Skin-color detection (YCbCr, works across skin tones) ----
  function isSkinPixel(r, g, b) {
    const y  =  0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.169 * r - 0.331 * g + 0.500 * b;
    const cr = 128 + 0.500 * r - 0.419 * g - 0.081 * b;
    return y > 40 && cb > 77 && cb < 127 && cr > 133 && cr < 173;
  }

  function detectFaceCentroid(video) {
    if (!analysisCanvas) {
      analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = SAMPLE_W;
      analysisCanvas.height = SAMPLE_H;
      analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
    }
    try {
      analysisCtx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    } catch (e) { return; }

    const data = analysisCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
    let sumX = 0, sumY = 0, count = 0;

    for (let y = 0; y < SAMPLE_H; y++) {
      for (let x = 0; x < SAMPLE_W; x++) {
        const i = (y * SAMPLE_W + x) * 4;
        if (isSkinPixel(data[i], data[i + 1], data[i + 2])) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count > 40) {
      const cx = sumX / count / SAMPLE_W;  // normalised 0-1
      const cy = sumY / count / SAMPLE_H;
      // Smooth lerp
      const a = faceDetected ? 0.15 : 0.5;
      smoothFaceCX += (cx - smoothFaceCX) * a;
      smoothFaceCY += (cy - smoothFaceCY) * a;
      faceDetected = true;
    }
    // If no skin detected, keep previous position (don't reset)
  }

  // ---- Mouth crop coordinates from face centroid ----
  function getMouthCrop(video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Face centroid → mouth is ~18% below centroid, same X
    const mouthCX = smoothFaceCX * vw;
    const mouthCY = (smoothFaceCY + 0.18) * vh;

    const cropW = vw * 0.38;
    const cropH = cropW * (140 / 320);

    return {
      sx: Math.max(0, Math.min(mouthCX - cropW / 2, vw - cropW)),
      sy: Math.max(0, Math.min(mouthCY - cropH / 2, vh - cropH)),
      sw: cropW,
      sh: cropH,
    };
  }

  // ---- Setup ----
  function setupZoomCanvas() {
    if (zoomCanvas) return;
    zoomCanvas = document.createElement('canvas');
    zoomCanvas.id = 'meetable-lip-zoom';
    zoomCanvas.width = 320;
    zoomCanvas.height = 140;
    zoomCanvas.style.cssText = `
      position: fixed;
      bottom: 160px;
      right: 20px;
      width: 320px;
      height: 140px;
      border: 3px solid #60A5FA;
      border-radius: 14px;
      z-index: 999999;
      pointer-events: none;
      background: #000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      display: none;
    `;
    const label = document.createElement('div');
    label.id = 'meetable-lip-label';
    label.style.cssText = `
      position: fixed;
      bottom: 304px;
      right: 20px;
      background: rgba(96,165,250,0.95);
      color: #000;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 6px 6px 0 0;
      z-index: 999999;
      pointer-events: none;
      display: none;
    `;
    label.textContent = '👄 Lip Focus';
    document.body.appendChild(label);
    document.body.appendChild(zoomCanvas);
    zoomCtx = zoomCanvas.getContext('2d');
    window._meetableLipLabel = label;

    // Offscreen canvas to capture mouth crops for the frame buffer
    captureCanvas = document.createElement('canvas');
    captureCanvas.width = 320;
    captureCanvas.height = 140;
    captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  }

  // ---- Main render loop ----
  let _detectSkip = 0;  // run skin detection every N frames to save CPU

  function loopFaceFocus() {
    if (!settings.enabled || !settings.faceFocusMode) {
      if (zoomCanvas) {
        zoomCanvas.style.display = 'none';
        if (window._meetableLipLabel) window._meetableLipLabel.style.display = 'none';
      }
      rafId = null;
      return;
    }

    const videos = Array.from(document.querySelectorAll('video'))
      .filter(v => !v.paused && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0);
    const activeVideo = videos.reduce((best, v) => {
      if (!best) return v;
      const br = best.getBoundingClientRect(), vr = v.getBoundingClientRect();
      return vr.width * vr.height > br.width * br.height ? v : best;
    }, null);

    if (activeVideo) {
      zoomCanvas.style.display = 'block';
      if (window._meetableLipLabel) window._meetableLipLabel.style.display = 'block';

      // Run skin detection every 3 frames (~10 fps) to save CPU
      _detectSkip++;
      if (_detectSkip >= 3) {
        _detectSkip = 0;
        detectFaceCentroid(activeVideo);
      }

      const { sx, sy, sw, sh } = getMouthCrop(activeVideo);
      const now = performance.now();
      const speed = settings.mouthSpeed || 1.0;

      if (speed >= 0.95) {
        // At normal speed just draw live
        zoomCtx.clearRect(0, 0, 320, 140);
        try { zoomCtx.drawImage(activeVideo, sx, sy, sw, sh, 0, 0, 320, 140); } catch (e) {}
      } else {
        // ---- Frame-buffer slow motion ----
        // Capture at ~30 fps into ring buffer
        const captureGap = 33; // ms (~30fps)
        if (now - lastCaptureTime >= captureGap) {
          lastCaptureTime = now;
          try {
            captureCtx.clearRect(0, 0, 320, 140);
            captureCtx.drawImage(activeVideo, sx, sy, sw, sh, 0, 0, 320, 140);
            frameBuf[frameWritePos % FRAME_BUF_SIZE] = captureCtx.getImageData(0, 0, 320, 140);
            frameWritePos++;
          } catch (e) {}
        }

        // Read back at slower rate
        const renderGap = captureGap / speed;  // e.g. 33/0.5 = 66ms between renders
        if (now - lastRenderTime >= renderGap && frameReadPos < frameWritePos) {
          lastRenderTime = now;
          const frame = frameBuf[frameReadPos % FRAME_BUF_SIZE];
          if (frame) {
            zoomCtx.putImageData(frame, 0, 0);
          }
          frameReadPos++;
        }
      }
    } else {
      zoomCanvas.style.display = 'none';
      if (window._meetableLipLabel) window._meetableLipLabel.style.display = 'none';
    }

    rafId = requestAnimationFrame(loopFaceFocus);
  }

  function applyFaceFocus() {
    const videos = document.querySelectorAll('video');
    videos.forEach((v, i) => {
      if (i === currentSpeakerIdx % Math.max(1, videos.length)) {
        v.style.filter = 'contrast(1.15) saturate(1.1)';
        v.style.transition = 'filter 300ms ease-in-out';
      } else if (!faceFocusLocked) {
        v.style.filter = '';
      }
    });

    if (settings.faceFocusMode) {
      setupZoomCanvas();
      // Reset frame buffer
      frameBuf = [];
      frameWritePos = 0;
      frameReadPos = 0;
      lastCaptureTime = 0;
      lastRenderTime = 0;
      if (!rafId) loopFaceFocus();
    }
  }

  function clearFaceFocus() {
    document.querySelectorAll('video').forEach(v => {
      v.style.filter = '';
    });
    faceDetected = false;
    smoothFaceCX = 0.5;
    smoothFaceCY = 0.45;
    frameBuf = [];
    frameWritePos = 0;
    frameReadPos = 0;
    if (zoomCanvas) zoomCanvas.style.display = 'none';
    if (window._meetableLipLabel) window._meetableLipLabel.style.display = 'none';
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // --- AUDIO ALERTS (browser-native energy detection, no ML needed) ---
  // Detects sudden loud transient sounds (claps, knocks, alarms) via
  // AnalyserNode RMS energy threshold — works 100% on-device.

  const SOUND_CATEGORIES = [
    { label: '🚨 Alarm / Siren', test: (rms) => rms > 0.25 },
    { label: '📢 Loud Noise',    test: (rms) => rms > 0.18 },
    { label: '👏 Clap / Knock',  test: (rms) => rms > 0.12 },
  ];

  let analyserNode = null;
  let audioMicStream = null;
  let audioDetectInterval = null;
  let lastAlertTime = 0;

  async function startAudioClassification() {
    if (!settings.audioAlerts || audioDetectInterval) return;

    // Must be triggered by a user gesture — we attach a one-time listener
    const startCtx = async () => {
      if (audioDetectInterval) return;
      try {
        audioMicStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        const source = audioCtx.createMediaStreamSource(audioMicStream);
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.4;
        source.connect(analyserNode);

        const buf = new Float32Array(analyserNode.fftSize);
        audioDetectInterval = setInterval(() => {
          if (!settings.audioAlerts) return;
          analyserNode.getFloatTimeDomainData(buf);
          // RMS energy
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);

          const now = Date.now();
          if (now - lastAlertTime < 4000) return; // debounce: 4s between alerts

          for (const cat of SOUND_CATEGORIES) {
            if (cat.test(rms)) {
              lastAlertTime = now;
              showVisualAlert(cat.label);
              break;
            }
          }
        }, 250);

        console.log('[Meetable] Audio energy monitor started');
      } catch (err) {
        console.warn('[Meetable] Mic access denied for audio alerts:', err);
      }
    };

    // Try to start after the next user click/key on the page
    document.addEventListener('click', startCtx, { once: true });
    document.addEventListener('keydown', startCtx, { once: true });
  }

  function stopAudioClassification() {
    if (audioDetectInterval) {
      clearInterval(audioDetectInterval);
      audioDetectInterval = null;
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close();
      audioCtx = null;
    }
    if (audioMicStream) {
      audioMicStream.getTracks().forEach(t => t.stop());
      audioMicStream = null;
    }
    analyserNode = null;
  }

  let alertContainer = null;
  function showVisualAlert(soundName) {
    if (!alertContainer) {
      alertContainer = document.createElement('div');
      alertContainer.id = 'meetable-audio-alerts';
      alertContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 999999;
        pointer-events: none;
      `;
      document.body.appendChild(alertContainer);
    }

    // Debounce duplicate alerts
    const existing = alertContainer.querySelectorAll('.mtb-alert-box');
    for (let i = 0; i < existing.length; i++) {
      if (existing[i].dataset.sound === soundName) return;
    }

    const box = document.createElement('div');
    box.className = 'mtb-alert-box';
    box.dataset.sound = soundName;
    box.style.cssText = `
      background: linear-gradient(135deg, rgba(244,63,94,0.95), rgba(220,38,38,0.95));
      color: white;
      padding: 12px 18px;
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: mtbslideIn 0.3s cubic-bezier(.22,1,.36,1) forwards, mtbfadeOut 0.4s ease forwards 4.2s;
    `;
    box.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
      <span>${soundName} detected</span>
    `;

    if (!document.getElementById('mtb-anim-styles')) {
      const s = document.createElement('style');
      s.id = 'mtb-anim-styles';
      s.textContent = `
        @keyframes mtbslideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes mtbfadeOut { from { opacity: 1; } to { opacity: 0; transform: scale(0.9) translateY(-6px); } }
      `;
      document.head.appendChild(s);
    }

    alertContainer.appendChild(box);
    triggerFlash('#F43F5E');

    setTimeout(() => { if (box.parentNode) box.remove(); }, 4700);
  }

  // --- FLOATING DRAG ---
  function setupFloatingDrag(el) {
    let startX, startY, startLeft, startTop;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.meetable-ctrl-btn') || e.target.closest('.meetable-speaker-tag')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = (startLeft + dx) + 'px';
      el.style.top = (startTop + dy) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      if (el) el.style.cursor = 'grab';
    });
  }

  // --- CONTROL BAR ---
  function createControlBar() {
    if (document.getElementById('meetable-control-bar')) {
      controlBar = document.getElementById('meetable-control-bar');
      return;
    }
    controlBar = document.createElement('div');
    controlBar.id = 'meetable-control-bar';
    controlBar.setAttribute('role', 'toolbar');
    controlBar.setAttribute('aria-label', 'Meetable controls');

    const buttons = [
      {
        id: 'meetable-btn-pause',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`,
        label: 'Pause captions',
        action: togglePause,
      },
      {
        id: 'meetable-btn-mark',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        label: 'Mark moment',
        action: markMoment,
      },
      {
        id: 'meetable-btn-export',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        label: 'Export transcript',
        action: exportTranscript,
      },
      {
        id: 'meetable-btn-settings',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        label: 'Open settings',
        action: () => chrome.runtime.sendMessage({ action: 'openOptions' }),
      },
    ];

    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.id = b.id;
      btn.className = 'meetable-ctrl-btn';
      btn.setAttribute('aria-label', b.label);
      btn.title = b.label;
      btn.innerHTML = b.icon;
      btn.addEventListener('click', b.action);
      controlBar.appendChild(btn);
    });

    document.body.appendChild(controlBar);
  }

  // --- ACTIONS ---
  function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('meetable-btn-pause');
    if (btn) {
      if (isPaused) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`;
        btn.setAttribute('aria-label', 'Resume captions');
        btn.title = 'Resume captions';
      } else {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`;
        btn.setAttribute('aria-label', 'Pause captions');
        btn.title = 'Pause captions';
        startRecognition();
      }
    }
  }

  function markMoment() {
    const time = new Date().toLocaleTimeString();
    transcript.push({ speaker: 'System', text: '⭐ Marked moment', time, type: 'bookmark' });
    triggerFlash('#2DD4BF');
  }

  function exportTranscript() {
    const lines = transcript.map(t => `[${t.time}] ${t.speaker}: ${t.text}`).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meetable-transcript-' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- HOTKEYS ---
  function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      const parts = [];
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.ctrlKey) parts.push('Ctrl');
      parts.push(e.key.toUpperCase());
      const key = parts.join('+');

      const hk = settings.hotkeys;
      if (hk.pauseCaptions && key === hk.pauseCaptions.toUpperCase()) {
        e.preventDefault();
        togglePause();
      }
      if (hk.lockFace && key === hk.lockFace.toUpperCase()) {
        e.preventDefault();
        faceFocusLocked = !faceFocusLocked;
        if (!faceFocusLocked) clearFaceFocus();
        else applyFaceFocus();
      }
      if (hk.markMoment && key === hk.markMoment.toUpperCase()) {
        e.preventDefault();
        markMoment();
      }
    });
  }

  // --- MESSAGE HANDLER ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'updateSettings') {
      const oldEnabled = settings.enabled;
      const oldAlerts = settings.audioAlerts;
      settings = { ...settings, ...msg.settings };

      if (captionOverlay) {
        captionOverlay.setAttribute('data-placement', settings.captionPlacement);
      }
      document.querySelectorAll('.meetable-caption-text').forEach(el => {
        el.style.fontSize = settings.fontSize + 'px';
      });

      // Toggle Yamnet
      if (settings.enabled && settings.audioAlerts && !oldAlerts) {
          startAudioClassification();
      } else if (!settings.enabled || !settings.audioAlerts) {
          stopAudioClassification();
      }

      // Handle face focus updates
      if (settings.faceFocusMode) {
          applyFaceFocus();
      } else {
          clearFaceFocus();
      }

      if (settings.enabled && !oldEnabled) {
        createCaptionOverlay();
        createControlBar();
        startRecognition();
      }
      if (!settings.enabled && oldEnabled) {
        stopRecognition();
      }
    }

    if (msg.action === 'getStatus') {
      sendResponse({
        enabled: settings.enabled,
        platform: detectPlatform(),
        transcriptLength: transcript.length,
      });
    }

    return true;
  });

  // --- INIT ---
  function init() {
    loadSettings(() => {
      injectFonts();
      getSpeaker(0);
      initSpeechRecognition();

      if (settings.enabled) {
        createCaptionOverlay();
        createControlBar();
        startRecognition();

        // Start face focus if previously enabled
        if (settings.faceFocusMode) {
          applyFaceFocus();
        }

        // Start audio monitoring if previously enabled
        if (settings.audioAlerts) {
          startAudioClassification();
        }
      }
      setupHotkeys();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
