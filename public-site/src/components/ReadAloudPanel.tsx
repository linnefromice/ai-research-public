/**
 * Text-to-speech reader panel using the Web Speech API.
 *
 * Lets users play the full report or a selected `## H2` section aloud with
 * adjustable speed and voice. Falls back to hiding the panel if
 * SpeechSynthesis is unavailable.
 *
 * Design: docs/plans/2026-04-23-tts-read-aloud-design.md (private repo)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { chunkForSpeech, extractSections } from '../lib/markdown-to-speech';
import { getTtsPrefs, setTtsPrefs } from '../lib/user-prefs';

interface Props {
  markdown: string;
  /** BCP-47 language code, e.g., 'ja-JP' or 'en-US' */
  lang?: string;
}

type Status = 'idle' | 'playing' | 'paused';

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5];

export function ReadAloudPanel({ markdown, lang = 'ja-JP' }: Props) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sections = useMemo(() => extractSections(markdown), [markdown]);

  // sectionIdx: -1 = full text, 0..n-1 = individual section
  const [sectionIdx, setSectionIdx] = useState<number>(-1);
  const [status, setStatus] = useState<Status>('idle');
  const [rate, setRate] = useState<number>(1.0);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');

  const queueRef = useRef<string[]>([]);
  const queueIdxRef = useRef<number>(0);

  // Mobile-first: collapsed by default on narrow screens.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs = getTtsPrefs();
    setRate(prefs.rate);
    setVoiceURI(prefs.voice);
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    setCollapsed(isMobile && prefs.collapsedMobile);
  }, []);

  // Load voices (async in some browsers).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const filtered = all.filter(v => v.lang.startsWith(lang.slice(0, 2)));
      setVoices(filtered.length ? filtered : all);
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported, lang]);

  // Cleanup on unmount or navigation away.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  if (!supported) return null;

  const getTextForSelection = (): string => {
    if (sectionIdx === -1) {
      // Full text: concatenate all sections with pauses between.
      return sections.map(s => s.text).filter(Boolean).join('\n\n');
    }
    return sections[sectionIdx]?.text ?? '';
  };

  const speakQueue = () => {
    const synth = window.speechSynthesis;
    const idx = queueIdxRef.current;
    const queue = queueRef.current;
    if (idx >= queue.length) {
      setStatus('idle');
      setProgress('');
      return;
    }
    const u = new SpeechSynthesisUtterance(queue[idx]);
    u.lang = lang;
    u.rate = rate;
    if (voiceURI) {
      const v = voices.find(v => v.voiceURI === voiceURI);
      if (v) u.voice = v;
    }
    u.onend = () => {
      queueIdxRef.current += 1;
      speakQueue();
    };
    u.onerror = () => {
      setStatus('idle');
      setProgress('読み上げエラーが発生しました');
    };
    setProgress(`${idx + 1} / ${queue.length}`);
    synth.speak(u);
  };

  const handlePlay = () => {
    const synth = window.speechSynthesis;
    if (status === 'paused') {
      synth.resume();
      setStatus('playing');
      return;
    }
    synth.cancel();
    const text = getTextForSelection();
    if (!text.trim()) return;
    queueRef.current = chunkForSpeech(text);
    queueIdxRef.current = 0;
    setStatus('playing');
    speakQueue();
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setStatus('paused');
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    queueRef.current = [];
    queueIdxRef.current = 0;
    setStatus('idle');
    setProgress('');
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseInt(e.target.value, 10);
    setSectionIdx(v);
    if (status !== 'idle') handleStop();
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseFloat(e.target.value);
    setRate(v);
    setTtsPrefs({ rate: v });
    if (status === 'playing') {
      // Restart to apply new rate
      handleStop();
      setTimeout(() => handlePlay(), 50);
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

  return (
    <div class="read-aloud-panel" role="region" aria-label="読み上げ">
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
        {voices.length > 1 && (
          <select
            class="read-aloud-select read-aloud-voice"
            value={voiceURI ?? ''}
            onChange={handleVoiceChange}
            aria-label="音声"
          >
            <option value="">デフォルト</option>
            {voices.map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
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
      {progress && (
        <div class="read-aloud-progress" aria-live="polite">{progress}</div>
      )}
    </div>
  );
}
