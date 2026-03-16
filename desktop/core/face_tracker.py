"""
Face / mouth tracker using screen capture + OpenCV Haar cascade face detection.
No mediapipe or external model download required — the Haar cascade XMLs ship
bundled inside opencv-python.

Pipeline:
  mss grabs the screen (or one monitor) → resize to analysis resolution →
  Haar cascade detects frontal faces → pick the largest face →
  derive mouth bounding box from lower-third of face →
  (optionally) apply slow-motion via ring-buffer →
  expose the 320×140 RGBA crop via get_mouth_frame()
"""

import threading
import time
import numpy as np

try:
    import mss
    MSS_OK = True
except ImportError:
    MSS_OK = False

try:
    import cv2
    CV_OK = True
except ImportError:
    CV_OK = False


class FaceTracker:
    # ── Tuning knobs ──────────────────────────────────────────────────────────
    ANALYSIS_W   = 640          # width to resize to before detection (speed vs accuracy)
    ANALYSIS_H   = 360
    DETECT_EVERY = 5            # run Haar every N captured frames (saves CPU)
    LERP_ALPHA   = 0.2          # smoothing between face bounding boxes

    # Mouth sits in the lower portion of the face bounding box
    MOUTH_Y_START = 0.60        # 60 % down the face box
    MOUTH_Y_END   = 0.92        # 92 % down
    MOUTH_X_PAD   = 0.10        # 10 % horizontal padding each side

    OUTPUT_W = 320
    OUTPUT_H = 140

    FRAME_BUF_SIZE = 90         # ring buffer for slow-motion (~3 s at 30 fps)

    def __init__(self):
        self._frame     = None           # current output frame (RGBA numpy)
        self._lock      = threading.Lock()
        self._running   = False
        self._thread    = None

        # Smoothed face box in *analysis* pixel coords
        self._fx = self._fy = self._fw = self._fh = None

        self.speed       = 1.0           # 0.1 – 1.0
        self.monitor_idx = 1             # mss monitor index (1 = primary)

        # Frame-buffer slow-motion state
        self._buf        = []
        self._write_pos  = 0
        self._read_pos   = 0
        self._last_cap_t = 0.0
        self._last_rnd_t = 0.0

        # Haar cascade (loaded once)
        self._cascade = None

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread  = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None

    def get_mouth_frame(self):
        """Return the latest 320×140 RGBA numpy array, or None."""
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _load_cascade(self):
        if self._cascade is not None:
            return True
        if not CV_OK:
            return False
        path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self._cascade = cv2.CascadeClassifier(path)
        return not self._cascade.empty()

    def _detect_face(self, gray_small):
        """
        Run Haar cascade on a grayscale analysis-res image.
        Returns (x, y, w, h) of the largest face in analysis coords, or None.
        """
        faces = self._cascade.detectMultiScale(
            gray_small,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(40, 40),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )
        if len(faces) == 0:
            return None
        # Pick largest face by area
        faces = sorted(faces, key=lambda r: r[2] * r[3], reverse=True)
        return faces[0]          # (x, y, w, h) in analysis coords

    def _update_face_box(self, new_box, scale_x, scale_y):
        """
        Lerp smoothing between detection frames.
        All internal coords are in *full-res* screen pixels.
        """
        nx, ny, nw, nh = (
            new_box[0] * scale_x,
            new_box[1] * scale_y,
            new_box[2] * scale_x,
            new_box[3] * scale_y,
        )
        if self._fx is None:
            self._fx, self._fy, self._fw, self._fh = nx, ny, nw, nh
        else:
            a = self.LERP_ALPHA
            self._fx += (nx - self._fx) * a
            self._fy += (ny - self._fy) * a
            self._fw += (nw - self._fw) * a
            self._fh += (nh - self._fh) * a

    def _get_mouth_crop(self, bgr_full):
        """
        Return the mouth-region BGR crop from the full-res screen frame.
        Uses the smoothed face box if a face has been detected; otherwise
        falls back to the centre-bottom of the frame.
        """
        H, W = bgr_full.shape[:2]

        if self._fx is not None:
            fx, fy, fw, fh = self._fx, self._fy, self._fw, self._fh
            # Mouth rect within the face box
            mx1 = int(max(0, fx + fw * self.MOUTH_X_PAD))
            mx2 = int(min(W,  fx + fw * (1 - self.MOUTH_X_PAD)))
            my1 = int(max(0,  fy + fh * self.MOUTH_Y_START))
            my2 = int(min(H,  fy + fh * self.MOUTH_Y_END))
        else:
            # Geometric fallback — dead-centre bottom third
            crop_w = int(W * 0.40)
            crop_h = int(crop_w * (self.OUTPUT_H / self.OUTPUT_W))
            mx1 = max(0, W // 2 - crop_w // 2)
            mx2 = min(W, mx1 + crop_w)
            my1 = max(0, int(H * 0.60))
            my2 = min(H, my1 + crop_h)

        if mx2 <= mx1 or my2 <= my1:
            return None
        return bgr_full[my1:my2, mx1:mx2]

    def _push_frame(self, crop_bgr):
        """Resize crop to output dims, convert to RGBA, apply slow-mo buffer."""
        crop_resized = cv2.resize(crop_bgr, (self.OUTPUT_W, self.OUTPUT_H))
        now   = time.perf_counter()
        speed = max(0.1, min(1.0, self.speed))

        if speed >= 0.95:
            rgba = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGBA)
            with self._lock:
                self._frame = rgba
            return

        # ── Frame-buffer slow-motion ──────────────────────────────────────
        CAP_GAP = 1.0 / 30         # capture at 30 fps
        if now - self._last_cap_t >= CAP_GAP:
            self._last_cap_t = now
            rgba = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2RGBA)
            idx  = self._write_pos % self.FRAME_BUF_SIZE
            if len(self._buf) <= idx:
                self._buf.append(rgba)
            else:
                self._buf[idx] = rgba
            self._write_pos += 1

        render_gap = CAP_GAP / speed
        if (now - self._last_rnd_t >= render_gap and
                self._read_pos < self._write_pos):
            self._last_rnd_t = now
            ridx = self._read_pos % self.FRAME_BUF_SIZE
            if ridx < len(self._buf):
                with self._lock:
                    self._frame = self._buf[ridx]
            self._read_pos += 1

    def _loop(self):
        if not MSS_OK or not CV_OK:
            print("[FaceTracker] mss or opencv not available")
            return
        if not self._load_cascade():
            print("[FaceTracker] Haar cascade failed to load")
            return

        detect_tick = 0

        with mss.mss() as sct:
            monitors = sct.monitors
            mon = monitors[min(self.monitor_idx, len(monitors) - 1)]

            while self._running:
                t0 = time.perf_counter()

                # ── Grab screen ───────────────────────────────────────────
                try:
                    raw = sct.grab(mon)
                except Exception:
                    time.sleep(0.05)
                    continue

                bgr_full = np.frombuffer(raw.bgra, dtype=np.uint8)
                bgr_full = bgr_full.reshape((raw.height, raw.width, 4))
                bgr_full = cv2.cvtColor(bgr_full, cv2.COLOR_BGRA2BGR)

                # ── Face detection (throttled) ────────────────────────────
                detect_tick += 1
                if detect_tick >= self.DETECT_EVERY:
                    detect_tick = 0
                    small  = cv2.resize(bgr_full, (self.ANALYSIS_W, self.ANALYSIS_H))
                    gray   = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                    cv2.equalizeHist(gray, gray)        # improve low-contrast frames

                    scale_x = raw.width  / self.ANALYSIS_W
                    scale_y = raw.height / self.ANALYSIS_H

                    face_box = self._detect_face(gray)
                    if face_box is not None:
                        self._update_face_box(face_box, scale_x, scale_y)

                # ── Mouth crop → output ───────────────────────────────────
                crop = self._get_mouth_crop(bgr_full)
                if crop is not None:
                    self._push_frame(crop)

                # Cap main loop at 30 fps
                elapsed = time.perf_counter() - t0
                time.sleep(max(0.0, (1 / 30) - elapsed))
