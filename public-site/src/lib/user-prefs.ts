/**
 * ユーザー設定（localStorage ベース）
 * - ブックマーク
 * - 既読管理
 * - 表示カスタマイズ
 */

const BOOKMARKS_KEY = 'openclaw_bookmarks';
const READ_KEY = 'openclaw_read';
const PREFS_KEY = 'openclaw_prefs';

// ── ブックマーク ──

export function getBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function toggleBookmark(reportId: string): boolean {
  const bookmarks = getBookmarks();
  const isBookmarked = bookmarks.has(reportId);
  if (isBookmarked) {
    bookmarks.delete(reportId);
  } else {
    bookmarks.add(reportId);
  }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]));
  return !isBookmarked;
}

export function isBookmarked(reportId: string): boolean {
  return getBookmarks().has(reportId);
}

// ── 既読管理 ──

export function getReadReports(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function markAsRead(reportId: string): void {
  const read = getReadReports();
  read.add(reportId);
  // 最大500件に制限（古いものから削除）
  const arr = [...read];
  if (arr.length > 500) arr.splice(0, arr.length - 500);
  localStorage.setItem(READ_KEY, JSON.stringify(arr));
}

export function isRead(reportId: string): boolean {
  return getReadReports().has(reportId);
}

// ── TTS (読み上げ) 設定 ──

const TTS_KEY = 'openclaw_tts';

export interface TtsPrefs {
  rate: number;       // 0.75 / 1.0 / 1.25 / 1.5
  voice: string | null; // voiceURI or null (default)
  collapsedMobile: boolean;
}

const DEFAULT_TTS: TtsPrefs = { rate: 1.0, voice: null, collapsedMobile: true };

export function getTtsPrefs(): TtsPrefs {
  try {
    const raw = localStorage.getItem(TTS_KEY);
    return raw ? { ...DEFAULT_TTS, ...JSON.parse(raw) } : DEFAULT_TTS;
  } catch { return DEFAULT_TTS; }
}

export function setTtsPrefs(prefs: Partial<TtsPrefs>): void {
  const current = getTtsPrefs();
  localStorage.setItem(TTS_KEY, JSON.stringify({ ...current, ...prefs }));
}

// ── 表示設定 ──

export interface DisplayPrefs {
  density: 'compact' | 'normal';
  defaultSort: 'date' | 'feature';
  defaultFilter: 'all' | 'daily' | 'session';
}

const DEFAULT_PREFS: DisplayPrefs = {
  density: 'normal',
  defaultSort: 'date',
  defaultFilter: 'all',
};

export function getDisplayPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

export function setDisplayPrefs(prefs: Partial<DisplayPrefs>): void {
  const current = getDisplayPrefs();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}
