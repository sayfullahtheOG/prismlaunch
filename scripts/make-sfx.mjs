// Synthesised sound effects for the library: short, dry, and honest about
// what they are. WAV, 44.1 kHz, 16-bit mono. Run: node scripts/make-sfx.mjs
import { writeFileSync } from "node:fs";

const RATE = 44100;

function wav(samples) {
  const peak = Math.max(1e-6, ...samples.map((s) => Math.abs(s)));
  const gain = 0.9 / peak;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Deterministic noise, so the files are reproducible.
let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };

function lowpass(samples, cutoffAt) {
  // One-pole, with a cutoff that can move over time (0..1 of Nyquist-ish).
  let y = 0; const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = Math.min(0.999, Math.max(0.001, cutoffAt(i / samples.length)));
    y += a * (samples[i] - y); out[i] = y;
  }
  return out;
}

const seconds = (s) => Math.round(RATE * s);
const env = (n, attack, release) => (i) => {
  const t = i / n;
  const a = Math.min(1, t / attack);
  const r = t > 1 - release ? (1 - t) / release : 1;
  return a * r;
};

// Whoosh: filtered noise that sweeps up then away. 0.6s.
{
  const n = seconds(0.6);
  const noise = Array.from({ length: n }, rand);
  const swept = lowpass(noise, (t) => 0.02 + 0.5 * Math.sin(Math.PI * t) ** 2);
  const e = env(n, 0.35, 0.45);
  writeFileSync("public/library/audio/whoosh.wav", wav(Array.from(swept, (s, i) => s * e(i))));
}
// Click: a 6ms burst, fast decay. 0.12s.
{
  const n = seconds(0.12);
  const out = Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    return (Math.sin(2 * Math.PI * 1800 * t) + 0.4 * rand()) * Math.exp(-t * 90);
  });
  writeFileSync("public/library/audio/click.wav", wav(out));
}
// Tick: a softer, higher click for UI beats. 0.08s.
{
  const n = seconds(0.08);
  const out = Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    return Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 160);
  });
  writeFileSync("public/library/audio/tick.wav", wav(out));
}
// Impact: a low sine that falls in pitch, with a breath of noise on the hit. 0.9s.
{
  const n = seconds(0.9);
  let phase = 0;
  const out = Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    const f = 40 + 90 * Math.exp(-t * 12);
    phase += (2 * Math.PI * f) / RATE;
    const body = Math.sin(phase) * Math.exp(-t * 4.5);
    const hit = rand() * Math.exp(-t * 60) * 0.5;
    return body + hit;
  });
  writeFileSync("public/library/audio/impact.wav", wav(out));
}
// Rise: noise that opens up over 1.6s and stops, for the beat before a reveal.
{
  const n = seconds(1.6);
  const noise = Array.from({ length: n }, rand);
  const swept = lowpass(noise, (t) => 0.01 + 0.6 * t * t);
  const e = env(n, 0.9, 0.04);
  writeFileSync("public/library/audio/rise.wav", wav(Array.from(swept, (s, i) => s * e(i))));
}
console.log("wrote 5 effects");
