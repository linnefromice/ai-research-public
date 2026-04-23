/**
 * Estimate remaining TTS playback time from character count.
 *
 * Heuristic speech rates at rate=1.0:
 *   Japanese: ~400 chars/min (~6.7 chars/sec)
 *   English:  ~800 chars/min (~13.3 chars/sec)
 *
 * Simple model; doesn't account for speaker voice, pauses, etc. Good
 * enough for a progress indicator.
 *
 * Design: docs/plans/2026-04-23-tts-phase2-improvements-design.md
 */

const JA_CHARS_PER_SEC = 400 / 60;
const EN_CHARS_PER_SEC = 800 / 60;

export function estimateSeconds(text: string, rate = 1.0, lang: 'ja' | 'en' = 'ja'): number {
  if (!text) return 0;
  const baseRate = lang === 'en' ? EN_CHARS_PER_SEC : JA_CHARS_PER_SEC;
  return text.length / (baseRate * rate);
}

/**
 * Format seconds as M:SS (or 0:00 for zero/negative).
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.ceil(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
