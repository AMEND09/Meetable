"""
Clear Meet – desktop overlay + settings panel.
Always-on-top transparent windows + brutalist settings UI built in PyQt6.
"""
import sys, time, os
from PyQt6.QtWidgets import (
    QApplication, QWidget, QLabel, QSlider, QPushButton,
    QVBoxLayout, QHBoxLayout, QFrame, QScrollArea,
    QSizePolicy, QStackedWidget, QListWidget, QListWidgetItem,
    QSystemTrayIcon, QMenu, QGraphicsDropShadowEffect, QComboBox
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QSize, QPoint, QRect, QMargins
from PyQt6.QtGui import QImage, QPixmap, QPainter, QColor, QFont, QPen, QBrush, QIcon, QGuiApplication

# ── Brutalist palette
CREAM    = "#f0efe6"
WHITE    = "#ffffff"
BLACK    = "#202020"
ORANGE   = "#e85d38"
TEAL     = "#0ebfa9"
YELLOW   = "#f8c21c"
MID_GRAY = "#404040"

GLOBAL_CSS = f"""
QWidget {{
    font-family: 'Inter', system-ui, sans-serif;
    color: {BLACK};
}}
QListWidget {{
    background: {CREAM};
    border: none;
    border-right: 3px solid {BLACK};
    outline: none;
}}
QListWidget::item {{
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    color: {BLACK};
    border: 2px solid transparent;
    border-radius: 0;
    margin-bottom: 4px;
}}
QListWidget::item:hover {{
    background: {WHITE};
    border: 2px solid {BLACK};
    color: {TEAL};
}}
QListWidget::item:selected {{
    background: {WHITE};
    border: 2px solid {BLACK};
    color: {ORANGE};
    box-shadow: 4px 4px 0 {BLACK};
}}
QScrollArea {{ border: none; background: {CREAM}; }}
QScrollBar:vertical {{
    background: {CREAM};
    width: 12px;
    border-left: 2px solid {BLACK};
}}
QScrollBar::handle:vertical {{
    background: {TEAL};
    border: 2px solid {BLACK};
    min-height: 20px;
    margin: 1px;
}}
QScrollBar::handle:vertical:hover {{ background: {ORANGE}; }}
QSlider::groove:horizontal {{
    background: {CREAM};
    border: 2px solid {BLACK};
    height: 10px;
}}
QSlider::handle:horizontal {{
    background: {BLACK};
    width: 20px;
    height: 20px;
    margin: -6px 0;
    border-radius: 0;
}}
QSlider::handle:horizontal:hover {{ background: {ORANGE}; }}
QComboBox {{
    border: 3px solid {BLACK};
    padding: 6px 12px;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    text-transform: uppercase;
    background: {WHITE};
}}
QComboBox::drop-down {{ border: none; }}
QPushButton.brutalist {{
    background: {WHITE};
    border: 3px solid {BLACK};
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 10px 20px;
}}
QPushButton.brutalist:hover {{
    background: {TEAL};
    color: {WHITE};
}}
QPushButton.brutalist:pressed {{
    background: {ORANGE};
    color: {WHITE};
}}
"""

class BrutalToggle(QWidget):
    """Brutalist pill toggle switch."""
    toggled = pyqtSignal(bool)
    def __init__(self, initial=False):
        super().__init__()
        self._on = initial
        self.setFixedSize(56, 30)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def is_on(self): return self._on
    def set_on(self, v):
        self._on = bool(v)
        self.update()

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self._on = not self._on
            self.update()
            self.toggled.emit(self._on)

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        bg = TEAL if self._on else WHITE
        p.setBrush(QColor(bg))
        p.setPen(QPen(QColor(BLACK), 3))
        # No rounded corners, just blocky
        p.drawRect(0, 0, self.width()-1, self.height()-1)

        thumb_x = (self.width() - 20 - 4) if self._on else 4
        p.setBrush(QColor(WHITE if self._on else BLACK))
        p.setPen(Qt.PenStyle.NoPen)
        p.drawRect(thumb_x, 5, 20, 20)

def block_shadow():
    eff = QGraphicsDropShadowEffect()
    eff.setBlurRadius(0)
    eff.setColor(QColor(BLACK))
    eff.setOffset(4, 4)
    return eff

# ── Alert Toast
class AlertToast(QWidget):
    def __init__(self):
        super().__init__(None, Qt.WindowType.ToolTip | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)
        self.setFixedSize(360, 72)
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self.hide)
        self._text = ""

        # Use screen
        screen = QGuiApplication.primaryScreen().availableGeometry()
        self.move(screen.right() - 380, screen.top() + 30)

    def show_alert(self, text):
        self._text = text
        self.show()
        self.update()
        self._timer.start(4000)

    def paintEvent(self, e):
        if not self._text: return
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setBrush(QColor(ORANGE))
        p.setPen(QPen(QColor(BLACK), 3))
        p.drawRect(0, 0, self.width()-4, self.height()-4)
        p.setBrush(QColor(BLACK))
        p.drawRect(4, 4, self.width(), self.height()) # inner shadow override
        # Re-draw the box over the shadow to create solid offset block
        p.fillRect(0, 0, self.width()-4, self.height()-4, QColor(YELLOW))
        p.drawRect(0, 0, self.width()-4, self.height()-4)
        
        p.setPen(QColor(BLACK))
        font = QFont("JetBrains Mono", 12)
        font.setWeight(QFont.Weight.Bold)
        p.setFont(font)
        p.drawText(16, 0, self.width()-16, self.height()-4, Qt.AlignmentFlag.AlignVCenter, self._text)


# ── Caption Bar
class CaptionBar(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        screen = QGuiApplication.primaryScreen().availableGeometry()
        self.setGeometry(int(screen.width()*0.1), screen.bottom() - 140, int(screen.width()*0.8), 120)

        self._lines = []
        self._drag = None
        self.font_size = 28

    def add_line(self, text):
        if not text: return
        words = text.split()
        m = 16
        while len(words) > m:
            self._lines.append(" ".join(words[:m]))
            words = words[m:]
        self._lines.append(" ".join(words))
        if len(self._lines) > 3:
            self._lines = self._lines[-3:]
        self.update()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        # solid background with opacity
        p.fillRect(0, 0, self.width(), self.height(), QColor(20, 20, 20, 215))
        p.setPen(QPen(QColor(BLACK), 4))
        p.drawRect(0, 0, self.width(), self.height())
        # Left accent
        p.fillRect(0, 0, 8, self.height(), QColor(TEAL))

        if self._lines:
            font = QFont("Inter", self.font_size)
            font.setWeight(QFont.Weight.Black)
            p.setFont(font)
            lh = self.height() // 3
            for i, line in enumerate(self._lines):
                alpha = 255 if i == len(self._lines)-1 else 160
                p.setPen(QColor(255, 255, 255, alpha))
                p.drawText(24, int(i*lh + lh*0.2), self.width()-48, lh, Qt.AlignmentFlag.AlignVCenter, line)

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self._drag = e.globalPosition().toPoint() - self.frameGeometry().topLeft()
    def mouseMoveEvent(self, e):
        if e.buttons() & Qt.MouseButton.LeftButton and self._drag:
            self.move(e.globalPosition().toPoint() - self._drag)
    def mouseReleaseEvent(self, e): self._drag = None


# ── Lip Overlay
class LipOverlay(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(360, 200)

        screen = QGuiApplication.primaryScreen().availableGeometry()
        self.move(screen.right() - 400, screen.bottom() - 300)

        self._pixmap = None
        self._drag = None

    def set_frame(self, rgba):
        import numpy as np
        h, w, ch = rgba.shape
        img = QImage(rgba.tobytes(), w, h, w*ch, QImage.Format.Format_RGBA8888)
        self._pixmap = QPixmap.fromImage(img)
        self.update()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Solid shadow block
        p.fillRect(6, 6, self.width()-6, self.height()-6, QColor(BLACK))
        
        # Main body
        r = QRect(0, 0, self.width()-6, self.height()-6)
        p.fillRect(r, QColor(WHITE))
        p.setPen(QPen(QColor(BLACK), 3))
        p.drawRect(r)

        # Header
        p.fillRect(0, 0, r.width(), 36, QColor(YELLOW))
        p.setPen(QPen(QColor(BLACK), 3))
        p.drawLine(0, 36, r.width(), 36)
        
        font = QFont("JetBrains Mono", 12)
        font.setWeight(QFont.Weight.Bold)
        p.setFont(font)
        p.drawText(12, 0, r.width(), 36, Qt.AlignmentFlag.AlignVCenter, "👄 MOUTH FOCUS")

        # Frame
        if self._pixmap:
            p.drawPixmap(16, 48, 320, 140, self._pixmap)
        else:
            p.setPen(QColor(MID_GRAY))
            p.drawText(16, 48, 320, 140, Qt.AlignmentFlag.AlignCenter, "TRACKING FACE...")
        p.setPen(QPen(QColor(BLACK), 3))
        p.drawRect(16, 48, 320, 140)

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self._drag = e.globalPosition().toPoint() - self.frameGeometry().topLeft()
    def mouseMoveEvent(self, e):
        if e.buttons() & Qt.MouseButton.LeftButton and self._drag:
            self.move(e.globalPosition().toPoint() - self._drag)
    def mouseReleaseEvent(self, e): self._drag = None


# ── Settings UI (1:1 with Extension options.html)

class SettingsWindow(QWidget):
    def __init__(self, ctrl):
        super().__init__()
        self.ctrl = ctrl
        self.setWindowTitle("Clear Meet - Settings")
        self.resize(800, 650)
        self.setStyleSheet(GLOBAL_CSS)
        
        # Overall layout identical to extension
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        layout.setSpacing(0)

        # Sidebar
        self.sidebar = QListWidget()
        self.sidebar.setFixedWidth(220)
        layout.addWidget(self.sidebar)

        # Stack
        self.stack = QStackedWidget()
        self.stack.setStyleSheet(f"background: {CREAM};")
        layout.addWidget(self.stack, 1)

        # Pages
        self.pages = {
            "PROFILES": self._build_profiles(),
            "CAPTIONS": self._build_captions(),
            "SPEAKER SETTINGS": self._build_speakers(),
            "FACE FOCUS": self._build_face(),
            "VISUAL ALERTS": self._build_alerts(),
        }
        for name, w in self.pages.items():
            self.sidebar.addItem(name)
            self.stack.addWidget(w)
            
        self.sidebar.currentRowChanged.connect(self.stack.setCurrentIndex)
        self.sidebar.setCurrentRow(1) # Start on captions

    def _page_wrapper(self, title, subtitle):
        w = QWidget()
        l = QVBoxLayout(w)
        l.setContentsMargins(40, 40, 40, 40)
        t = QLabel(title)
        t.setStyleSheet("font-size: 28px; font-weight: 900; letter-spacing: -1px;")
        s = QLabel(subtitle)
        s.setStyleSheet(f"font-size: 14px; color: {MID_GRAY}; margin-bottom: 24px;")
        l.addWidget(t)
        l.addWidget(s)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        content.setStyleSheet("background: transparent;")
        content.setLayout(QVBoxLayout())
        content.layout().setContentsMargins(0,0,0,0)
        content.layout().setSpacing(20)
        scroll.setWidget(content)
        l.addWidget(scroll)
        
        return w, content.layout()

    def _form_group(self, widget_list):
        f = QFrame()
        f.setStyleSheet(f"background: {WHITE}; border: 3px solid {BLACK}; padding: 16px;")
        f.setGraphicsEffect(block_shadow())
        l = QVBoxLayout(f)
        l.setContentsMargins(0,0,0,0)
        l.setSpacing(12)
        for w in widget_list: l.addWidget(w)
        return f

    def _lbl(self, text):
        l = QLabel(text.upper())
        l.setStyleSheet(f"font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 12px; background: {YELLOW}; border: 2px solid {BLACK}; padding: 4px 8px;")
        l.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        return l
        
    def _desc(self, text):
        l = QLabel(text)
        l.setStyleSheet(f"color: {MID_GRAY}; font-size: 13px; border: none; background: transparent;")
        l.setWordWrap(True)
        return l

    def _build_profiles(self):
        w, l = self._page_wrapper("Profiles", "Choose an accessibility profile.")
        t = QLabel("LIP-READER (Enabled)")
        t.setStyleSheet("font-weight: 800; font-size: 16px;")
        l.addWidget(self._form_group([t, self._desc("Face focus, large text, audio visualizer.")]))
        l.addStretch()
        return w

    def _build_captions(self):
        w, lay = self._page_wrapper("Captions", "Customize typography and visibility.")
        
        # Toggle
        t = BrutalToggle(self.ctrl.captions_enabled)
        t.toggled.connect(self.ctrl.set_captions)
        row1 = QHBoxLayout()
        v = QVBoxLayout()
        v.addWidget(self._lbl("Live Captions"))
        v.addWidget(self._desc("Speech-to-text overlay using Vosk"))
        row1.addLayout(v)
        row1.addWidget(t)
        wg1 = QWidget(); wg1.setLayout(row1)

        # Size
        row2 = QHBoxLayout()
        v2 = QVBoxLayout()
        v2.addWidget(self._lbl("Caption Size"))
        slide = QSlider(Qt.Orientation.Horizontal)
        slide.setRange(14, 48)
        slide.setValue(self.ctrl.font_size)
        v2.addWidget(slide)
        row2.addLayout(v2)
        val = QLabel(f"{self.ctrl.font_size}px")
        val.setStyleSheet(f"font-weight: bold; font-family: 'JetBrains Mono'; font-size: 16px; border: none;")
        slide.valueChanged.connect(lambda v: (val.setText(f"{v}px") or self.ctrl.set_font_size(v)))
        row2.addWidget(val)
        wg2 = QWidget(); wg2.setLayout(row2)

        # Placement
        row3 = QVBoxLayout()
        row3.addWidget(self._lbl("Placement"))
        cb = QComboBox()
        cb.addItems(["Bottom Overlay", "Floating Window"])
        row3.addWidget(cb)
        wg3 = QWidget(); wg3.setLayout(row3)
        
        lay.addWidget(self._form_group([wg1]))
        lay.addWidget(self._form_group([wg2]))
        lay.addWidget(self._form_group([wg3]))
        lay.addStretch()
        return w

    def _build_speakers(self):
        w, lay = self._page_wrapper("Speaker Settings", "Settings for speaker labels.")
        lay.addWidget(self._form_group([self._lbl("Speaker Labels"), self._desc("Vosk does not strictly separate speakers offline yet. Labels will appear as general text.")]))
        lay.addStretch()
        return w

    def _build_face(self):
        w, lay = self._page_wrapper("Face Focus", "Focus tightly on the speaker's mouth.")
        
        # Toggle
        t = BrutalToggle(self.ctrl.lip_mode)
        t.toggled.connect(self.ctrl.set_lip_mode)
        row1 = QHBoxLayout()
        v = QVBoxLayout()
        v.addWidget(self._lbl("Mouth Zoom Overlay"))
        v.addWidget(self._desc("Haar Cascade Face Tracking Window"))
        row1.addLayout(v)
        row1.addWidget(t)
        wg1 = QWidget(); wg1.setLayout(row1)

        # Monitor dropdown
        row2 = QVBoxLayout()
        row2.addWidget(self._lbl("Capture Monitor"))
        cb = QComboBox()
        try:
            import mss
            with mss.mss() as sct:
                for i in range(1, len(sct.monitors)):
                    cb.addItem(f"Monitor {i}", i)
        except Exception:
            cb.addItem("Monitor 1", 1)
        cb.currentIndexChanged.connect(lambda idx: self.ctrl.set_monitor(cb.itemData(idx)))
        row2.addWidget(cb)
        wg2 = QWidget(); wg2.setLayout(row2)

        lay.addWidget(self._form_group([wg1]))
        lay.addWidget(self._form_group([wg2]))
        lay.addStretch()
        return w

    def _build_alerts(self):
        w, lay = self._page_wrapper("Visual Alerts", "Environmental audio classification using YAMNet ONNX.")
        
        # Toggle
        t = BrutalToggle(self.ctrl.audio_alerts)
        t.toggled.connect(self.ctrl.set_audio_alerts)
        row1 = QHBoxLayout()
        v = QVBoxLayout()
        v.addWidget(self._lbl("YAMNet Alerts"))
        v.addWidget(self._desc("Translates sounds (sirens, claps, dogs) to visual toasts."))
        row1.addLayout(v)
        row1.addWidget(t)
        wg1 = QWidget(); wg1.setLayout(row1)

        lay.addWidget(self._form_group([wg1]))
        lay.addStretch()
        return w


# ── App Controller
class AppController:
    def __init__(self, app):
        self.app = app
        self.captions_enabled = True
        self.lip_mode = True
        self.audio_alerts = True
        self.font_size = 28
        self.monitor_idx = 1

        self.ft = None
        self.ce = None
        self.ae = None

        self.settings = SettingsWindow(self)
        self.lip_overlay = LipOverlay()
        self.caption_bar = CaptionBar()
        self.alert_toast = AlertToast()

        self._tick = QTimer()
        self._tick.timeout.connect(self.update)
        self._tick.start(33)

        self._setup_engines()

    def _setup_engines(self):
        try:
            from core.face_tracker import FaceTracker
            self.ft = FaceTracker()
            self.ft.monitor_idx = self.monitor_idx
            if self.lip_mode: self.ft.start()
        except: pass

        try:
            from core.audio_engine import CaptionEngine, AudioAlertEngine
            self.ce = CaptionEngine(lambda t: self.caption_bar.add_line(t))
            self.ae = AudioAlertEngine(lambda l: self.alert_toast.show_alert(l))
            if self.captions_enabled: self.ce.start()
            if self.audio_alerts: self.ae.start()
        except Exception as e:
            print("[Engines]", e)

    def set_captions(self, v):
        self.captions_enabled = v
        if v:
            self.caption_bar.show()
            if self.ce: self.ce.start()
        else:
            self.caption_bar.hide()
            if self.ce: self.ce.stop()

    def set_font_size(self, v):
        self.font_size = v
        self.caption_bar.font_size = v
        self.caption_bar.update()

    def set_lip_mode(self, v):
        self.lip_mode = v
        if v:
            self.lip_overlay.show()
            if self.ft: self.ft.start()
        else:
            self.lip_overlay.hide()
            if self.ft: self.ft.stop()

    def set_monitor(self, idx):
        self.monitor_idx = idx
        if self.ft: self.ft.monitor_idx = idx

    def set_audio_alerts(self, v):
        self.audio_alerts = v
        if v:
            if self.ae: self.ae.start()
        else:
            if self.ae: self.ae.stop()

    def update(self):
        if self.ft and self.lip_mode:
            fr = self.ft.get_mouth_frame()
            if fr is not None:
                self.lip_overlay.set_frame(fr)
        if self.ce: self.ce.poll()
        if self.ae: self.ae.poll()

    def run(self):
        self.settings.show()
        if self.captions_enabled: self.caption_bar.show()
        if self.lip_mode: self.lip_overlay.show()
        sys.exit(self.app.exec())

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName("Clear Meet")
    ctrl = AppController(app)
    ctrl.run()
