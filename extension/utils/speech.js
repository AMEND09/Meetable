'use strict';

class SpeechEngine {
  constructor(options = {}) {
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.filterFillerWords = options.filterFillerWords !== false;
    this.filterProfanity = options.filterProfanity !== false;

    this.FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of'];
    this.PROFANITY_LIST = ['damn', 'hell', 'crap'];

    this._recognition = null;
    this._isRunning = false;
    this._isPaused = false;
    this._shouldRestart = false;

    this._init();
  }

  _init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('[Meetable] SpeechRecognition not available');
      return;
    }

    this._recognition = new SR();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = 'en-US';

    this._recognition.onstart = () => { this._isRunning = true; };
    this._recognition.onresult = (e) => this._handleResult(e);
    this._recognition.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        this.onError(e.error);
      }
    };
    this._recognition.onend = () => {
      this._isRunning = false;
      this.onEnd();
      if (this._shouldRestart && !this._isPaused) {
        setTimeout(() => this.start(), 300);
      }
    };
  }

  _handleResult(event) {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      let text = result[0].transcript;
      const confidence = result[0].confidence;
      text = this._filter(text);
      if (!text) continue;
      this.onResult({ text, isFinal: result.isFinal, confidence });
    }
  }

  _filter(text) {
    let out = text;
    if (this.filterFillerWords) {
      this.FILLER_WORDS.forEach(w => {
        out = out.replace(new RegExp('\\b' + w + '\\b', 'gi'), '');
      });
    }
    if (this.filterProfanity) {
      this.PROFANITY_LIST.forEach(w => {
        out = out.replace(new RegExp('\\b' + w + '\\b', 'gi'), '****');
      });
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  start() {
    if (!this._recognition || this._isRunning || this._isPaused) return;
    this._shouldRestart = true;
    try { this._recognition.start(); } catch (e) { /* already started */ }
  }

  stop() {
    this._shouldRestart = false;
    if (this._recognition && this._isRunning) {
      try { this._recognition.stop(); } catch (e) { /* already stopped */ }
    }
  }

  pause() {
    this._isPaused = true;
    this.stop();
  }

  resume() {
    this._isPaused = false;
    this.start();
  }

  get isRunning() { return this._isRunning; }
  get isPaused() { return this._isPaused; }
}

if (typeof module !== 'undefined') {
  module.exports = { SpeechEngine };
}
