/**
 * Sentence-level language segmentation for TTS.
 *
 * Splits text into segments of English vs Japanese so that mixed-language
 * passages (common in tech reports) can be spoken with the correct voice
 * per sentence.
 *
 * Simple heuristic: count ASCII letters vs Japanese characters per sentence.
 * If ASCII >= 50% AND sentence is long enough (>= 10 chars), treat as
 * English. Otherwise Japanese.
 *
 * Design: docs/plans/2026-04-23-tts-phase2-improvements-design.md
 */

export interface LangSegment {
  text: string;
  lang: 'ja' | 'en';
}

// Split AFTER each sentence-ending punctuation (whitespace optional). This
// handles `。The` without spaces. Also split after ASCII `.` when followed
// by whitespace + non-whitespace (catches "field. 結論" but not "U.S." or "3.14").
const SENTENCE_BOUNDARY = /(?<=[。．！？!?])\s*|(?<=\.)\s+(?=\S)|\n{2,}/;

/**
 * Split into sentences and label each with language. Consecutive segments
 * with the same lang are merged for smoother utterance chaining.
 */
export function segmentByLang(
  text: string,
  defaultLang: 'ja' | 'en' = 'ja'
): LangSegment[] {
  if (!text.trim()) return [];

  const sentences = text.split(SENTENCE_BOUNDARY).map(s => s.trim()).filter(Boolean);
  const segs: LangSegment[] = [];

  for (const s of sentences) {
    const lang = detectSentenceLang(s, defaultLang);
    const last = segs[segs.length - 1];
    if (last && last.lang === lang) {
      last.text = `${last.text} ${s}`;
    } else {
      segs.push({ text: s, lang });
    }
  }

  return segs;
}

/** Count ASCII letters vs Japanese characters; pick the majority. */
export function detectSentenceLang(
  sentence: string,
  defaultLang: 'ja' | 'en'
): 'ja' | 'en' {
  // Short sentences: fall back to default (a single English word in a
  // Japanese report shouldn't flip the voice).
  if (sentence.length < 10) return defaultLang;

  let ascii = 0;
  let cjk = 0;
  for (const ch of sentence) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      ascii++;
    } else if (
      // Hiragana, Katakana, CJK Unified Ideographs
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff)
    ) {
      cjk++;
    }
  }

  if (ascii + cjk === 0) return defaultLang;
  return ascii >= (ascii + cjk) * 0.5 ? 'en' : 'ja';
}

/**
 * Produce BCP-47 language code for a segment lang.
 */
export function toBCP47(lang: 'ja' | 'en'): string {
  return lang === 'en' ? 'en-US' : 'ja-JP';
}
