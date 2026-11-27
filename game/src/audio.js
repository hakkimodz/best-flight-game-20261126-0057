// Merapi Ridge Run — sound. Everything is synthesised with WebAudio, no
// audio files: an engine hum that follows the throttle, a chime for a ring,
// a thud for a landing and a burst of noise for a crash. Sound starts only
// after the player's first gesture, and M mutes it.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      this.engine = osc;
      this.engineGain = gain;
      this.engineFilter = filter;
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle, speed, flying) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    const target = this.muted || !flying ? 0 : 0.02 + throttle * 0.05 + Math.min(0.03, speed * 0.0004);
    this.engineGain.gain.setTargetAtTime(target, t, 0.15);
    this.engine.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.35, t, 0.2);
    this.engineFilter.frequency.setTargetAtTime(240 + throttle * 500, t, 0.2);
  }

  tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  ring() {
    this.tone(880, 0.35);
    this.tone(1318, 0.5, 'sine', 0.1, 0.09);
  }

  checkpoint() {
    this.tone(659, 0.3);
    this.tone(988, 0.45, 'sine', 0.1, 0.08);
  }

  land() {
    this.tone(180, 0.25, 'triangle', 0.18);
    this.tone(90, 0.4, 'sine', 0.2, 0.05);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const dur = 0.7;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  click() {
    this.tone(1200, 0.06, 'square', 0.05);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.1, i * 0.12));
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
