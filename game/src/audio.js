// Synthesised sound: every effect is built with the Web Audio API, so
// the game ships no audio files and makes no network request. The
// context is created lazily on the first user gesture (the play button),
// and every call is a no-op until then, so headless captures stay
// silent and the game never blocks on audio.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  return {
    unlock,
    // A rifle crack: a short noise burst plus a low thump. The pistol
    // is shorter and brighter; both stay well under the master gain.
    shot(auto) {
      if (auto) { noise(0.09, 0.5, 2400); tone(110, 0.09, 'sine', 0.5, 0, 55); }
      else { noise(0.06, 0.4, 3400); tone(150, 0.06, 'sine', 0.4, 0, 70); }
    },
    dry() { tone(1800, 0.03, 'square', 0.12); },
    // Hit confirm: a bright tick. A kill adds a higher second note.
    hit() { tone(1250, 0.05, 'sine', 0.3); },
    kill() { tone(880, 0.07, 'sine', 0.3); tone(1318, 0.12, 'sine', 0.3, 0.07); },
    hurt() { tone(220, 0.12, 'sawtooth', 0.18, 0, 140); },
    reload() { tone(900, 0.04, 'square', 0.14); tone(620, 0.04, 'square', 0.14, 0.16); tone(1100, 0.04, 'square', 0.14, 0.55); },
    // Plant: one beep per second of the hold is driven by the caller;
    // the planted charge gets three rising beeps.
    plantTick() { tone(880, 0.07, 'sine', 0.22); },
    planted() { tone(880, 0.09, 'sine', 0.25); tone(1174, 0.09, 'sine', 0.25, 0.1); tone(1568, 0.16, 'sine', 0.25, 0.2); },
    boom() { noise(0.7, 0.7, 500); tone(60, 0.6, 'sine', 0.6, 0, 32); },
    roundWin() { tone(523, 0.12, 'triangle', 0.3); tone(659, 0.12, 'triangle', 0.3, 0.12); tone(784, 0.22, 'triangle', 0.3, 0.24); },
    roundLose() { tone(392, 0.14, 'triangle', 0.28); tone(330, 0.14, 'triangle', 0.28, 0.14); tone(262, 0.26, 'triangle', 0.28, 0.28); },
  };
}
