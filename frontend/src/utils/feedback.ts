/** Retroalimentación no visual: tonos breves (Web Audio) y vibración. */

type Cue = 'capture' | 'success' | 'error';

const PATTERNS: Record<Cue, { tones: [number, number][]; vibrate: number[] }> = {
  capture: { tones: [[880, 0.08]], vibrate: [40] },
  success: { tones: [[660, 0.1], [990, 0.16]], vibrate: [60, 60, 60] },
  error: { tones: [[330, 0.18], [220, 0.24]], vibrate: [200, 80, 200] },
};

let ctx: AudioContext | null = null;

export function playCue(cue: Cue, enabled = true) {
  if (!enabled) return;
  const { tones, vibrate } = PATTERNS[cue];
  try {
    navigator.vibrate?.(vibrate);
  } catch {
    /* vibración no soportada */
  }
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    let t = ctx.currentTime;
    for (const [freq, dur] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch {
    /* audio no disponible */
  }
}
