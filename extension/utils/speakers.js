'use strict';

const SPEAKER_COLORS = ['#2DD4BF', '#60A5FA', '#F472B6', '#A78BFA', '#34D399', '#FBBF24'];
const MAX_SPEAKERS = 6;

class SpeakerManager {
  constructor() {
    this._speakers = {};
    this._nextIdx = 0;
  }

  getSpeaker(idx) {
    const key = 'speaker_' + idx;
    if (!this._speakers[key]) {
      this._speakers[key] = {
        idx,
        name: 'Speaker ' + (idx + 1),
        color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
        talkTime: 0,
        segments: 0,
        firstSeen: Date.now(),
      };
    }
    return this._speakers[key];
  }

  getOrCreateNext() {
    const idx = this._nextIdx % MAX_SPEAKERS;
    this._nextIdx++;
    return this.getSpeaker(idx);
  }

  renameSpeaker(idx, name) {
    const sp = this.getSpeaker(idx);
    sp.name = name.trim();
    return sp;
  }

  recordTalkTime(idx, durationMs) {
    const sp = this.getSpeaker(idx);
    sp.talkTime += durationMs;
    sp.segments++;
  }

  getStats() {
    return Object.values(this._speakers).map(s => ({
      ...s,
      talkTimeFormatted: this._formatTime(s.talkTime),
    }));
  }

  _formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  reset() {
    this._speakers = {};
    this._nextIdx = 0;
  }

  get count() { return Object.keys(this._speakers).length; }
}

if (typeof module !== 'undefined') {
  module.exports = { SpeakerManager, SPEAKER_COLORS, MAX_SPEAKERS };
}
