/**
 * Persist TTS playback position across page reloads / revisits.
 *
 * localStorage shape:
 *   openclaw_tts_resume = {
 *     [reportId]: { sectionIdx, chunkIdx, total, timestamp }
 *   }
 *
 * Entries expire after 24h. On component mount, a "続きから" button can
 * be shown if a valid entry exists.
 *
 * Design: docs/plans/2026-04-23-tts-phase2-improvements-design.md
 */

const KEY = 'openclaw_tts_resume';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 50;

export interface ResumePosition {
  sectionIdx: number;
  chunkIdx: number;
  total: number;
  timestamp: number;
}

type ResumeStore = Record<string, ResumePosition>;

function load(): ResumeStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResumeStore) : {};
  } catch {
    return {};
  }
}

function save(store: ResumeStore): void {
  try {
    // Drop expired, keep MAX_ENTRIES most recent
    const now = Date.now();
    const cleaned = Object.entries(store)
      .filter(([, v]) => now - v.timestamp < MAX_AGE_MS)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, MAX_ENTRIES);
    const compact: ResumeStore = {};
    for (const [k, v] of cleaned) compact[k] = v;
    localStorage.setItem(KEY, JSON.stringify(compact));
  } catch {
    // ignore storage errors (quota, private mode, etc.)
  }
}

export function getResume(reportId: string): ResumePosition | null {
  const store = load();
  const entry = store[reportId];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) return null;
  return entry;
}

export function setResume(reportId: string, pos: Omit<ResumePosition, 'timestamp'>): void {
  const store = load();
  store[reportId] = { ...pos, timestamp: Date.now() };
  save(store);
}

export function clearResume(reportId: string): void {
  const store = load();
  delete store[reportId];
  save(store);
}
