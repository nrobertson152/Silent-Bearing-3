// Procedurally synthesised sound effects (no audio files).

export class Sfx {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  private ambSrc: AudioBufferSourceNode | null = null;
  volume = 0.7;
  ambience = 0.5;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ac.destination);
    this.sfx = this.ac.createGain();
    this.sfx.gain.value = this.volume;
    this.sfx.connect(this.master);
    this.amb = this.ac.createGain();
    this.amb.gain.value = this.ambience * 0.25;
    this.amb.connect(this.master);
    const len = this.ac.sampleRate * 2;
    this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * white;
      d[i] = white * 0.6 + b * 2.2;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ac) this.sfx.gain.value = v;
  }

  setAmbience(v: number) {
    this.ambience = v;
    if (this.ac) this.amb.gain.value = v * 0.25;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ac) this.master.gain.value = m ? 0 : 1;
  }

  private ok(key: string, gap: number): boolean {
    if (!this.ac || this.muted) return false;
    const now = this.ac.currentTime;
    const t = this.last.get(key) ?? -1;
    if (now - t < gap) return false;
    this.last.set(key, now);
    return true;
  }

  private noiseBurst(vol: number, freq: number, q: number, attack: number, decay: number, type: BiquadFilterType = 'lowpass', pan = 0, detune = 0) {
    const ac = this.ac!;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    if (detune) src.detune.value = detune;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f).connect(g).connect(p).connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.1);
  }

  private tone(vol: number, f0: number, f1: number, dur: number, type: OscillatorType = 'sine', pan = 0, delay = 0) {
    const ac = this.ac!;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g).connect(p).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  gun(cal: number, vol: number, pan: number) {
    if (vol < 0.02 || !this.ok('gun' + (cal > 200 ? 'h' : 'l'), cal > 200 ? 0.07 : 0.04)) return;
    const big = Math.min(1, cal / 460);
    this.noiseBurst(vol * (0.35 + big * 0.5), 1400 - big * 1100, 0.7, 0.004, 0.25 + big * 1.1, 'lowpass', pan);
    this.tone(vol * (0.2 + big * 0.5), 110 - big * 60, 35, 0.3 + big * 0.9, 'sine', pan);
  }

  boom(size: number, vol: number, pan: number) {
    if (vol < 0.02 || !this.ok('boom', 0.06)) return;
    const s = Math.min(1, size / 6);
    this.noiseBurst(vol * (0.5 + s * 0.5), 500 - s * 300, 0.6, 0.01, 1.2 + s * 2.4, 'lowpass', pan);
    this.tone(vol * (0.4 + s * 0.6), 70, 25, 1 + s * 2, 'sine', pan);
    this.noiseBurst(vol * 0.25, 2500, 0.5, 0.002, 0.15, 'highpass', pan);
  }

  splash(cal: number, vol: number, pan: number) {
    if (vol < 0.03 || !this.ok('splash', 0.05)) return;
    this.noiseBurst(vol * 0.22, 900 + Math.random() * 600, 0.9, 0.01, 0.35 + cal / 800, 'bandpass', pan);
  }

  hit(cal: number, vol: number, pan: number) {
    if (vol < 0.03 || !this.ok('hit', 0.05)) return;
    this.noiseBurst(vol * 0.5, 1800, 0.6, 0.002, 0.25 + cal / 900, 'lowpass', pan);
    this.tone(vol * 0.3, 160, 50, 0.4, 'triangle', pan);
  }

  torpedo(vol: number, pan: number) {
    if (!this.ok('torp', 0.3)) return;
    const ac = this.ac!;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.9);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.sfx);
    src.start(t);
    src.stop(t + 1.1);
  }

  ping(vol: number) {
    if (!this.ok('ping', 1.2)) return;
    this.tone(vol * 0.18, 1180, 1150, 1.3, 'sine');
    this.tone(vol * 0.06, 1180, 1150, 0.9, 'sine', 0, 0.45);
    this.tone(vol * 0.025, 1180, 1150, 0.7, 'sine', 0, 0.9);
  }

  depthCharge(vol: number, pan: number) {
    if (vol < 0.02 || !this.ok('dc', 0.12)) return;
    this.tone(vol * 0.6, 55, 28, 1.6, 'sine', pan);
    this.noiseBurst(vol * 0.4, 220, 0.8, 0.02, 1.4, 'lowpass', pan);
  }

  flak(vol: number, pan: number) {
    if (vol < 0.02 || !this.ok('flak', 0.09)) return;
    this.noiseBurst(vol * 0.18, 1500, 1.2, 0.002, 0.12, 'bandpass', pan);
  }

  planeDown(vol: number, pan: number) {
    if (vol < 0.03 || !this.ok('plane', 0.4)) return;
    this.tone(vol * 0.12, 900, 180, 1.4, 'sawtooth', pan);
  }

  alarm() {
    if (!this.ok('alarm', 4)) return;
    for (let i = 0; i < 3; i++) this.tone(0.12, 520, 500, 0.22, 'square', 0, i * 0.3);
  }

  klaxon() {
    if (!this.ok('klaxon', 5)) return;
    for (let i = 0; i < 2; i++) this.tone(0.14, 300, 280, 0.55, 'sawtooth', 0, i * 0.7);
  }

  click() {
    if (!this.ok('click', 0.03)) return;
    this.tone(0.06, 2400, 1800, 0.04, 'square');
  }

  radio() {
    if (!this.ok('radio', 0.6)) return;
    this.noiseBurst(0.05, 2600, 1.5, 0.005, 0.18, 'bandpass');
    this.tone(0.03, 1400, 1400, 0.08, 'sine', 0, 0.05);
  }

  victory() {
    if (!this.ac) return;
    const notes = [392, 523, 659, 784];
    notes.forEach((f, i) => this.tone(0.1, f, f, 0.9, 'triangle', 0, i * 0.18));
  }

  defeat() {
    if (!this.ac) return;
    const notes = [392, 349, 311, 262];
    notes.forEach((f, i) => this.tone(0.1, f, f * 0.98, 1.1, 'triangle', 0, i * 0.3));
  }

  startAmbience(stormy: boolean) {
    if (!this.ac || this.ambSrc) return;
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.5;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = stormy ? 700 : 420;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = ac.createGain();
    lg.gain.value = stormy ? 260 : 140;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
    src.connect(f).connect(this.amb);
    src.start();
    this.ambSrc = src;
  }

  stopAmbience() {
    if (this.ambSrc) {
      try {
        this.ambSrc.stop();
      } catch {
        /* already stopped */
      }
      this.ambSrc = null;
    }
  }
}

export const sfx = new Sfx();
