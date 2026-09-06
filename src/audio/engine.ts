import * as Tone from "tone";

// One synth per part, plus its own gain/pan and mute state.
type PartVoice = {
  synth: Tone.PolySynth;
  gain: Tone.Gain;
  panner: Tone.Panner;
  muted: boolean;
};

// Keyed by Part.id (model/score.ts) — generalized, so this works for any
// part count, not just SATB.
export const partVoices = new Map<string, PartVoice>();

let soloPartId: string | null = null;

/**
 * Solo overrides mute globally; without a solo, mute applies.
 */
export function isAudible(partId: string): boolean {
  const voice = partVoices.get(partId);
  if (!voice) return false;
  return soloPartId ? soloPartId === partId : !voice.muted;
}

/**
 * (Re)builds one synth per part, panned evenly across the stereo field.
 * Idempotent — safe to call again after the part list changes.
 */
export function initVoices(partIds: string[]): void {
  disposeVoices();
  const n = partIds.length;
  partIds.forEach((id, i) => {
    const gain = new Tone.Gain(0.7);
    const panner = new Tone.Panner(n === 1 ? 0 : -0.6 + (1.2 * i) / (n - 1));
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.4 },
    });
    synth.maxPolyphony = 16;
    synth.chain(gain, panner, Tone.getDestination());
    partVoices.set(id, { synth, gain, panner, muted: false });
  });
}

export function disposeVoices(): void {
  partVoices.forEach((voice) => {
    voice.synth.dispose();
    voice.gain.dispose();
    voice.panner.dispose();
  });
  partVoices.clear();
}

export function setMuted(partId: string, muted: boolean): void {
  const voice = partVoices.get(partId);
  if (voice) voice.muted = muted;
}

export function setSolo(partId: string | null): void {
  soloPartId = partId;
}
