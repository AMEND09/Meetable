"""
Audio engine — two independent components:

1. AudioAlertEngine  — captures microphone audio, runs YAMNet ONNX model
   on ~1 second chunks to classify environmental sounds.
   Exactly mirrors the behaviour and model of the browser extension.

2. CaptionEngine  — records microphone via sounddevice, uses offline
   Vosk speech recognition for continuous, high-quality, lag-free captions.
"""

import threading
import queue
import time
import os
import csv
import json
import numpy as np

try:
    import sounddevice as sd
    SD_OK = True
except Exception:
    SD_OK = False

try:
    import onnxruntime as ort
    ORT_OK = True
except ImportError:
    ORT_OK = False

try:
    from vosk import Model, KaldiRecognizer
    VOSK_OK = True
except ImportError:
    VOSK_OK = False


# ─────────────────────────────────────────────────────────────────────────────
# Audio Alert Engine (YAMNet via ONNX)
# ─────────────────────────────────────────────────────────────────────────────

class AudioAlertEngine:
    """
    Classifies 0.975-second audio blocks using the YAMNet ONNX model.
    Triggers UI alerts for alarms, glass, claps, and general loud acoustic events.
    """

    SAMPLE_RATE  = 16_000
    BLOCK_SIZE   = 15600     # exactly 0.975s for YAMNet input
    DEBOUNCE_SEC = 2.5       # min seconds between identical alerts

    def __init__(self, on_alert):
        self._on_alert = on_alert
        self._running  = False
        self._stream   = None
        self._q        = queue.Queue()
        self._last_labels = {}

        self._sess = None
        self._class_names = []

    def _load_model(self):
        if not ORT_OK or self._sess is not None:
            return
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "yamnet.onnx")
        csv_path   = os.path.join(base_dir, "yamnet_class_map.csv")

        if not os.path.exists(model_path) or not os.path.exists(csv_path):
            print("[AlertEngine] YAMNet model files missing")
            return

        # Load classes
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader) # skip header
            self._class_names = [row[2] for row in reader]

        # Load ONNX Runtime session
        self._sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

    def start(self):
        if not SD_OK or self._running:
            return
        self._load_model()
        if self._sess is None:
            return

        self._running = True
        self._stream  = sd.InputStream(
            samplerate=self.SAMPLE_RATE,
            blocksize=self.BLOCK_SIZE,
            channels=1,
            dtype="float32",
            callback=self._cb,
        )
        self._stream.start()

    def stop(self):
        self._running = False
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception: pass
            self._stream = None

    def poll(self):
        while not self._q.empty():
            self._on_alert(self._q.get_nowait())

    def _cb(self, indata, frames, time_info, status):
        # YAMNet expects float32 values in [-1.0, 1.0]
        waveform = indata[:, 0].copy()

        # Skip near-silence to save CPU
        rms = float(np.sqrt(np.mean(waveform ** 2)))
        if rms < 0.02:
            return

        # Inference
        out = self._sess.run(None, {"waveform": waveform})
        scores = out[0][0]          # (1, 521) -> (521,)
        top_idx = int(np.argmax(scores))
        conf = float(scores[top_idx])
        top_class = self._class_names[top_idx]

        # Filter and map labels like the extension
        label = self._map_yamnet_class(top_class, conf, rms)
        if label:
            now = time.perf_counter()
            last = self._last_labels.get(label, 0.0)
            if now - last >= self.DEBOUNCE_SEC:
                self._last_labels[label] = now
                self._q.put(label)

    def _map_yamnet_class(self, cls_name, conf, rms):
        """Map raw YAMNet 521 classes to friendly UI alerts with confidence thresholds."""
        if conf < 0.4:  # requires decent confidence
            return None

        cls = cls_name.lower()
        if "alarm" in cls or "siren" in cls or "smoke detector" in cls or "beeping" in cls:
            return f"🚨 {cls_name} detected"
        if "glass" in cls or "crash" in cls or "shatter" in cls:
            return f"🔔 {cls_name} detected"
        if "clap" in cls or "knock" in cls or "door" in cls:
            return f"👏 {cls_name} detected"
        if "dog" in cls or "bark" in cls:
            return f"🐕 {cls_name} detected"
        if "baby" in cls or "cry" in cls:
            return f"👶 {cls_name} detected"
        # generic fallback for unmapped loud things that aren't speech/music
        if rms > 0.25 and "speech" not in cls and "music" not in cls:
            return f"🔊 Loud {cls_name}"

        return None


# ─────────────────────────────────────────────────────────────────────────────
# Caption Engine (Vosk offline)
# ─────────────────────────────────────────────────────────────────────────────

class CaptionEngine:
    """
    Offline, continuous speech-to-text using Vosk.
    Incredibly fast, no internet required.
    """

    SAMPLE_RATE = 16_000
    BLOCK_SIZE = 4000      # 250 ms chunks

    def __init__(self, on_caption):
        self._on_caption = on_caption
        self._running    = False
        self._stream     = None
        self._q          = queue.Queue()

        self._model = None
        self._rec   = None

    def _load_model(self):
        if not VOSK_OK or self._model is not None:
            return
        # Vosk expects model inside 'vosk-model/model' relative to project root
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(os.path.dirname(base_dir), "vosk-model", "model")

        if not os.path.exists(model_path):
            print("[CaptionEngine] Vosk model missing")
            return

        self._model = Model(model_path)
        self._rec   = KaldiRecognizer(self._model, self.SAMPLE_RATE)
        self._rec.SetWords(False)

    def start(self):
        if not SD_OK or self._running:
            return
        self._load_model()
        if self._rec is None:
            return

        self._running = True
        self._stream = sd.RawInputStream(
            samplerate=self.SAMPLE_RATE,
            blocksize=self.BLOCK_SIZE,
            channels=1,
            dtype="int16",
            callback=self._cb,
        )
        self._stream.start()

    def stop(self):
        self._running = False
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception: pass
            self._stream = None

    def poll(self):
        while not self._q.empty():
            self._on_caption(self._q.get_nowait())

    def _cb(self, indata, frames, time_info, status):
        # Pass raw PCM bytes to Vosk
        if self._rec.AcceptWaveform(bytes(indata)):
            res = json.loads(self._rec.Result())
            text = res.get("text", "").strip()
            if text:
                self._q.put(text)
        else:
            # Partial results for continuous visual feedback
            partial = json.loads(self._rec.PartialResult())
            text = partial.get("partial", "").strip()
            # Only push substantial partials to avoid jitter, or just wait for complete
            # We'll just wait for complete lines to mirror extension behavior, but
            # if we wanted live typing we could emit it here.
