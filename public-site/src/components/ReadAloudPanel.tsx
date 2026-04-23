/**
 * Text-to-speech reader panel (Web Speech API) — Phase 2.
 *
 * Features on top of Phase 1:
 *  - MediaSession API (lock screen / Bluetooth headphone control)
 *  - Resume playback (24h, localStorage)
 *  - Keyboard shortcuts (Space/Esc/Arrows)
 *  - Estimated remaining time
 *  - Sticky panel during playback
 *  - Section highlight + auto-scroll
 *  - Reading dictionary (AI → エーアイ etc.)
 *  - Auto voice switching for English sentences (in ja mode)
 *
 * Design: docs/plans/2026-04-23-tts-phase2-improvements-design.md (private)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chunkForSpeech, extractSections } from '../lib/markdown-to-speech';
import { applyReadingDict } from '../lib/tts-reading-dict';
import { segmentByLang, toBCP47, type LangSegment } from '../lib/tts-segment';
import { getResume, setResume, clearResume } from '../lib/tts-resume';
import { estimateSeconds, formatDuration } from '../lib/tts-estimate';
import { getTtsPrefs, setTtsPrefs } from '../lib/user-prefs';

interface Props {
  markdown: string;
  /** BCP-47 language code: 'ja-JP' | 'en-US' */
  lang?: string;
  /** Stable ID for localStorage (e.g., feature/slug) */
  reportId?: string;
  /** Human-readable title for MediaSession */
  reportTitle?: string;
  /** Feature label for MediaSession (shown as artist) */
  featureLabel?: string;
}

type Status = 'idle' | 'playing' | 'paused';

/** Single utterance in the speech queue. */
interface QueueItem {
  text: string;
  /** Owning H2 section index, or -1 for pre-section content. */
  sectionIdx: number;
  /** Language for voice / utterance.lang. */
  lang: 'ja' | 'en';
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5];

export function ReadAloudPanel({
  markdown,
  lang: defaultLangTag = 'ja-JP',
  reportId,
  reportTitle,
  featureLabel,
}: Props) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const sections = useMemo(() => extractSections(markdown), [markdown]);
  const baseLang: 'ja' | 'en' = defaultLangTag.startsWith('en') ? 'en' : 'ja';

  // -1 = full text, 0..n-1 = individual section
  const [sectionIdx, setSectionIdx] = useState<number>(-1);
  const [status, setStatus] = useState<Status>('idle');
  const [rate, setRate] = useState<number>(1.0);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [currentSectionForHighlight, setCurrentSectionForHighlight] = useState<number>(-1);
  const [resumeAvailable, setResumeAvailable] = useState<boolean>(false);

  const queueRef = useRef<QueueItem[]>([]);
  const queueIdxRef = useRef<number>(0);
  const rateRef = useRef<number>(1.0);
  const voiceURIRef = useRef<string | null>(null);
  const sectionIdxRef = useRef<number>(-1);
  const statusRef = useRef<Status>('idle');

  // Keep refs in sync for handlers that live inside useEffect closures.
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { voiceURIRef.current = voiceURI; }, [voiceURI]);
  useEffect(() => { sectionIdxRef.current = sectionIdx; }, [sectionIdx]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Load prefs and check for resume entry.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs = getTtsPrefs();
    setRate(prefs.rate);
    setVoiceURI(prefs.voice);
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    setCollapsed(isMobile && prefs.collapsedMobile);

    if (reportId) {
      const r = getResume(reportId);
      if (r) setResumeAvailable(true);
    }
  }, [reportId]);

  // Load voices (async in some browsers).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      setVoices(all);
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  // Cleanup + persist position on unmount / page unload.
  useEffect(() => {
    if (!supported) return;
    const onUnload = () => {
      if (reportId && statusRef.current !== 'idle' && queueRef.current.length > 0) {
        setResume(reportId, {
          sectionIdx: queueRef.current[queueIdxRef.current]?.sectionIdx ?? -1,
          chunkIdx: queueIdxRef.current,
          total: queueRef.current.length,
        });
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
      window.speechSynthesis.cancel();
      clearHighlights();
    };
  }, [supported, reportId]);

  // ── Highlight helpers ────────────────────────────────────────────
  const clearHighlights = () => {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.tts-reading').forEach(el => el.classList.remove('tts-reading'));
  };

  const highlightSection = useCallback((idx: number) => {
    if (typeof document === 'undefined') return;
    clearHighlights();
    if (idx < 0) return;
    const article = document.querySelector('.report-content');
    if (!article) return;
    const h2s = article.querySelectorAll('h2');
    const target = h2s[idx];
    if (!target) return;
    // Highlight the H2 itself; scroll into view.
    target.classList.add('tts-reading');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Language-pick voice ──────────────────────────────────────────
  const pickVoice = (forLang: 'ja' | 'en'): SpeechSynthesisVoice | null => {
    // 1. User-selected voice (if it matches the segment lang).
    if (voiceURIRef.current) {
      const v = voices.find(v => v.voiceURI === voiceURIRef.current);
      if (v && v.lang.toLowerCase().startsWith(forLang)) return v;
    }
    // 2. First voice matching lang.
    const match = voices.find(v => v.lang.toLowerCase().startsWith(forLang));
    if (match) return match;
    // 3. null → OS default.
    return null;
  };

  // ── Queue building ───────────────────────────────────────────────
  const buildQueue = useCallback((selIdx: number): QueueItem[] => {
    const selection = selIdx === -1
      ? sections
      : sections[selIdx] ? [sections[selIdx]] : [];

    const queue: QueueItem[] = [];
    for (let i = 0; i < selection.length; i++) {
      const sec = selection[i];
      if (!sec.text.trim()) continue;
      const actualIdx = selIdx === -1 ? i : selIdx;

      // Segment by language, then apply dict to ja segments.
      const segs: LangSegment[] = segmentByLang(sec.text, baseLang);
      for (const seg of segs) {
        const processed = seg.lang === 'ja' ? applyReadingDict(seg.text) : seg.text;
        const chunks = chunkForSpeech(processed);
        for (const chunk of chunks) {
          queue.push({ text: chunk, sectionIdx: actualIdx, lang: seg.lang });
        }
      }
    }
    return queue;
  }, [sections, baseLang]);

  // ── Remaining time update ────────────────────────────────────────
  const updateRemaining = useCallback(() => {
    const q = queueRef.current;
    const i = queueIdxRef.current;
    let total = 0;
    for (let j = i; j < q.length; j++) {
      total += estimateSeconds(q[j].text, rateRef.current, q[j].lang);
    }
    setRemainingSec(total);
  }, []);

  // ── Speak next ───────────────────────────────────────────────────
  const speakNext = useCallback(() => {
    const synth = window.speechSynthesis;
    const queue = queueRef.current;
    const idx = queueIdxRef.current;

    if (idx >= queue.length) {
      setStatus('idle');
      setProgress('');
      setRemainingSec(0);
      setCurrentSectionForHighlight(-1);
      clearHighlights();
      if (reportId) clearResume(reportId);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
      return;
    }

    const item = queue[idx];
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = toBCP47(item.lang);
    u.rate = rateRef.current;
    const v = pickVoice(item.lang);
    if (v) u.voice = v;

    u.onend = () => {
      queueIdxRef.current += 1;
      // Persist after each chunk.
      if (reportId) {
        setResume(reportId, {
          sectionIdx: item.sectionIdx,
          chunkIdx: queueIdxRef.current,
          total: queue.length,
        });
      }
      speakNext();
    };
    u.onerror = () => {
      setStatus('idle');
      setProgress('読み上げエラーが発生しました');
      setCurrentSectionForHighlight(-1);
      clearHighlights();
    };

    setProgress(`${idx + 1} / ${queue.length}`);

    // Highlight + auto-scroll only when playing the full text.
    if (sectionIdxRef.current === -1 && item.sectionIdx !== currentSectionForHighlight) {
      setCurrentSectionForHighlight(item.sectionIdx);
      highlightSection(item.sectionIdx);
    }

    updateRemaining();
    synth.speak(u);
  }, [highlightSection, updateRemaining, voices, reportId, currentSectionForHighlight]);

  // ── Play / Pause / Stop ──────────────────────────────────────────
  const handlePlay = useCallback(() => {
    const synth = window.speechSynthesis;
    if (statusRef.current === 'paused') {
      synth.resume();
      setStatus('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      return;
    }
    synth.cancel();
    const queue = buildQueue(sectionIdxRef.current);
    if (queue.length === 0) return;
    queueRef.current = queue;
    queueIdxRef.current = 0;
    setResumeAvailable(false);
    setStatus('playing');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    speakNext();
  }, [buildQueue, speakNext]);

  const handleResume = useCallback(() => {
    if (!reportId) return;
    const r = getResume(reportId);
    if (!r) return;
    const queue = buildQueue(sectionIdxRef.current === -1 ? -1 : sectionIdxRef.current);
    if (queue.length === 0) return;
    queueRef.current = queue;
    queueIdxRef.current = Math.min(r.chunkIdx, queue.length - 1);
    setResumeAvailable(false);
    setStatus('playing');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    speakNext();
  }, [buildQueue, speakNext, reportId]);

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause();
    setStatus('paused');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    queueRef.current = [];
    queueIdxRef.current = 0;
    setStatus('idle');
    setProgress('');
    setRemainingSec(0);
    setCurrentSectionForHighlight(-1);
    clearHighlights();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    if (reportId) clearResume(reportId);
  }, [reportId]);

  // Jump between sections (when playing full text).
  const jumpSection = useCallback((delta: -1 | 1) => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const currentSec = q[queueIdxRef.current]?.sectionIdx ?? 0;
    const targetSec = currentSec + delta;
    let newIdx = queueIdxRef.current;
    if (delta === 1) {
      newIdx = q.findIndex((item, i) => i > queueIdxRef.current && item.sectionIdx >= targetSec);
    } else {
      // Previous section start
      for (let i = queueIdxRef.current - 1; i >= 0; i--) {
        if (q[i].sectionIdx < currentSec) {
          newIdx = q.findIndex(item => item.sectionIdx === q[i].sectionIdx);
          break;
        }
        if (i === 0) newIdx = 0;
      }
    }
    if (newIdx < 0 || newIdx >= q.length) return;

    window.speechSynthesis.cancel();
    queueIdxRef.current = newIdx;
    setTimeout(() => speakNext(), 30);
  }, [speakNext]);

  // ── MediaSession API ─────────────────────────────────────────────
  useEffect(() => {
    if (!supported || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: reportTitle ?? 'Report',
      artist: featureLabel ?? 'OpenClaw',
      album: 'Auto Research',
    });

    const handlers: [MediaSessionAction, () => void][] = [
      ['play', handlePlay],
      ['pause', handlePause],
      ['stop', handleStop],
      ['previoustrack', () => jumpSection(-1)],
      ['nexttrack', () => jumpSection(1)],
    ];
    for (const [action, h] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, h); } catch { /* not supported */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
      }
    };
  }, [supported, reportTitle, featureLabel, handlePlay, handlePause, handleStop, jumpSection]);

  // ── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    if (!supported) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;

      switch (e.key) {
        case ' ': // Space
          if (statusRef.current === 'idle') return; // allow scroll
          e.preventDefault();
          if (statusRef.current === 'playing') handlePause();
          else handlePlay();
          break;
        case 'Escape':
          if (statusRef.current !== 'idle') {
            e.preventDefault();
            handleStop();
          }
          break;
        case 'ArrowLeft':
          if (statusRef.current !== 'idle') {
            e.preventDefault();
            jumpSection(-1);
          }
          break;
        case 'ArrowRight':
          if (statusRef.current !== 'idle') {
            e.preventDefault();
            jumpSection(1);
          }
          break;
        case 'ArrowUp':
          if (statusRef.current !== 'idle') {
            e.preventDefault();
            const next = Math.min(1.5, rateRef.current + 0.25);
            setRate(next);
            setTtsPrefs({ rate: next });
          }
          break;
        case 'ArrowDown':
          if (statusRef.current !== 'idle') {
            e.preventDefault();
            const next = Math.max(0.75, rateRef.current - 0.25);
            setRate(next);
            setTtsPrefs({ rate: next });
          }
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [supported, handlePlay, handlePause, handleStop, jumpSection]);

  if (!supported) return null;

  // ── Handlers ─────────────────────────────────────────────────────
  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseInt(e.target.value, 10);
    setSectionIdx(v);
    if (statusRef.current !== 'idle') handleStop();
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseFloat(e.target.value);
    setRate(v);
    setTtsPrefs({ rate: v });
    if (statusRef.current === 'playing') {
      // Restart current chunk to apply new rate.
      window.speechSynthesis.cancel();
      setTimeout(() => speakNext(), 30);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value || null;
    setVoiceURI(v);
    setTtsPrefs({ voice: v });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setTtsPrefs({ collapsedMobile: next });
  };

  if (collapsed) {
    return (
      <div class="read-aloud-panel read-aloud-collapsed">
        <button
          type="button"
          class="read-aloud-toggle"
          onClick={toggleCollapsed}
          aria-label="読み上げパネルを開く"
        >
          🔊 読み上げ
        </button>
      </div>
    );
  }

  // Voice selector: show voices matching baseLang + English (for en segments).
  const displayVoices = voices.filter(v => {
    const vl = v.lang.toLowerCase();
    return vl.startsWith(baseLang) || vl.startsWith('en');
  });

  const isPlayingOrPaused = status !== 'idle';

  return (
    <div
      class={`read-aloud-panel ${isPlayingOrPaused ? 'read-aloud-sticky' : ''}`}
      role="region"
      aria-label="読み上げ"
    >
      <div class="read-aloud-row">
        <span class="read-aloud-icon" aria-hidden="true">🔊</span>
        <select
          class="read-aloud-select"
          value={sectionIdx}
          onChange={handleSectionChange}
          aria-label="読み上げ対象"
        >
          <option value={-1}>全文</option>
          {sections.map((s, i) => (
            <option key={i} value={i}>{s.title || `Section ${i + 1}`}</option>
          ))}
        </select>
        {status === 'playing' ? (
          <button type="button" class="read-aloud-btn" onClick={handlePause} aria-label="一時停止">
            ⏸
          </button>
        ) : (
          <button
            type="button"
            class="read-aloud-btn read-aloud-play"
            onClick={handlePlay}
            aria-label={status === 'paused' ? '再開' : '再生'}
          >
            ▶
          </button>
        )}
        {status !== 'idle' && (
          <button type="button" class="read-aloud-btn" onClick={handleStop} aria-label="停止">
            ⏹
          </button>
        )}
        {resumeAvailable && status === 'idle' && (
          <button
            type="button"
            class="read-aloud-btn read-aloud-resume"
            onClick={handleResume}
            aria-label="前回の続きから再生"
            title="前回の続きから再生"
          >
            ⏯ 続き
          </button>
        )}
        <select
          class="read-aloud-select read-aloud-speed"
          value={rate}
          onChange={handleRateChange}
          aria-label="速度"
        >
          {SPEED_OPTIONS.map(r => (
            <option key={r} value={r}>{r}x</option>
          ))}
        </select>
        {displayVoices.length > 1 && (
          <select
            class="read-aloud-select read-aloud-voice"
            value={voiceURI ?? ''}
            onChange={handleVoiceChange}
            aria-label="音声"
          >
            <option value="">デフォルト</option>
            {displayVoices.map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))}
          </select>
        )}
        <button
          type="button"
          class="read-aloud-close"
          onClick={toggleCollapsed}
          aria-label="パネルを閉じる"
        >
          ×
        </button>
      </div>
      {(progress || remainingSec > 0) && (
        <div class="read-aloud-progress" aria-live="polite">
          {progress && <span>{progress}</span>}
          {remainingSec > 0 && <span class="read-aloud-remaining">残り {formatDuration(remainingSec)}</span>}
        </div>
      )}
    </div>
  );
}
