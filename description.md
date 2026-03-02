## **Core Product: Meeting Equalizer Pro**
## **Name: Meetable**

**Goal:** Make video meetings truly accessible for Deaf / Hard-of-Hearing users and lip readers.

---

## **1\) Live Captions Engine**

**Baseline accessibility layer**

* Real-time speech-to-text (low latency)  
* High accuracy (noise \+ accents handling)  
* Punctuation \+ sentence formatting  
* Profanity / filler word filtering  
* Caption styling:  
  * Font size  
  * Font type  
  * Color / contrast  
  * Background opacity  
* Caption placement:  
  * Bottom overlay  
  * Side panel  
  * Floating draggable window  
* Caption history:  
  * Scrollback  
  * Search  
  * Export to TXT / PDF

---

## **2\) Speaker Labeling**

**Who is speaking, clearly and consistently**

* Automatic speaker diarization  
* Assign names to voices (“Speaker 1 → John”)  
* Persistent speaker colors  
* Visual speaker tags next to captions  
* Speaker activity bar (who’s talking most)  
* Speaker timeline view  
* Confidence score (when unsure who spoke)

---

## **3\) Talk-Over Detection (Overlapping Speech)**

**Critical for accessibility**

* Detect when multiple people speak at once  
* Visual warnings:  
  * “2 people talking”  
  * Red highlight on captions  
* Identify overlapping speakers  
* Timestamp conflicts  
* Meeting summary section:  
  * “Missed due to overlap: 2:13–2:27”  
* Optional auto-mute suggestion:  
  * “Ask participants to speak one at a time”

---

## **4\) Face Focus (Lip-Reading Mode)**

**Key differentiator**

* Detect all faces in video feed  
* Auto-zoom on current speaker’s face  
* Lip-reading enhancement:  
  * Sharpening  
  * Contrast boost  
  * Slow-motion replay  
* Manual override:  
  * Click face to lock focus  
* Picture-in-picture:  
  * Focused speaker large  
  * Others small  
* Multi-speaker mode:  
  * Side-by-side lips when overlap detected

---

## **5\) Visual Alerts & Accessibility Signals**

* Flash alert when:  
  * Someone starts talking  
  * Name is called  
  * Speaker changes  
* Color-coded speaker borders  
* Vibration alerts (trackpad / connected devices)  
* Caption emphasis on:  
  * Keywords  
  * Questions  
  * Action items

---

## **6\) Meeting Intelligence Layer**

* Real-time:  
  * Keyword highlights  
  * Questions detection  
  * Action item detection  
* Post-meeting:  
  * Clean transcript  
  * Speaker-attributed transcript  
  * Overlap summary  
  * Missed sections  
  * Key takeaways  
* Searchable meeting archive

---

## **7\) Privacy & Reliability**

* On-device transcription (optional)  
* Offline mode (limited)  
* No raw audio stored  
* End-to-end encrypted transcripts  
* User-controlled data retention

---

## **8\) Customization & Profiles**

* Accessibility profiles:  
  * Lip-reader mode  
  * Caption-only mode  
  * Minimal mode  
* Sensitivity tuning:  
  * Overlap detection  
  * Speaker switching  
* Hotkeys:  
  * Pause captions  
  * Lock face  
  * Mark important moment

---

## **9\) Implementation**

* Chrome/Firefox Extension:  
  * Focused on Google Meets but should support most web meeting softwares like Microsoft Teams, Slack, Discord, etc.
* Design Guidelines: specified in style_guide.md
---

