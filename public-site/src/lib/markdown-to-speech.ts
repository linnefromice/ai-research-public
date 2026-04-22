/**
 * Markdown → speech-ready plain text converter.
 *
 * Strips markdown syntax for text-to-speech (Web Speech API), removes
 * headings/code blocks and keeps only prose.
 *
 * Design: docs/plans/2026-04-23-tts-read-aloud-design.md (private repo)
 */

export interface Section {
  /** H2 heading text (sanitized of markdown) */
  title: string;
  /** Plain text body between this H2 and the next H2 */
  text: string;
}

/**
 * Split markdown by `## H2` headings. Returns one entry per section.
 * Content before the first H2 is discarded (typically frontmatter remnants).
 */
export function extractSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  let current: { title: string; bodyLines: string[] } | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+?)\s*$/);
    if (h2Match) {
      if (current) {
        sections.push({
          title: current.title,
          text: stripMarkdown(current.bodyLines.join('\n')),
        });
      }
      current = { title: stripMarkdown(h2Match[1]).trim(), bodyLines: [] };
      continue;
    }
    if (current) current.bodyLines.push(line);
  }

  if (current) {
    sections.push({
      title: current.title,
      text: stripMarkdown(current.bodyLines.join('\n')),
    });
  }

  return sections;
}

/**
 * Convert markdown to speech-ready plain text. Removes:
 * - Heading markers (full line for H1-H6)
 * - Code blocks (fenced ``` and ~~~), completely skipped
 * - List markers (-, *, +, 1.)
 * - Emphasis markers (**, __, *, _)
 * - Inline code backticks
 * - Link brackets: [text](url) → text
 * - Image syntax: ![alt](url) → alt
 * - HTML tags
 * - Table separators (|, ---|---)
 */
export function stripMarkdown(md: string): string {
  let text = md;

  // Remove fenced code blocks (```...``` or ~~~...~~~)
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/~~~[\s\S]*?~~~/g, '');

  // Remove entire heading lines (H1-H6)
  text = text.replace(/^#{1,6}\s+.*$/gm, '');

  // Remove reference link definitions: [id]: url "title"
  text = text.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '');

  // Table separator rows: | --- | --- |
  // Use [ \t] instead of \s to avoid consuming newlines across lines.
  text = text.replace(/^[ \t]*\|?[ \t]*[:\-| ]+[ \t]*\|?[ \t]*$/gm, '');

  // Table content rows: replace pipes with spaces
  text = text.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, inner: string) =>
    inner.split('|').map(c => c.trim()).filter(Boolean).join('、')
  );

  // Images: ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Links: [text](url) or [text][ref] → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // Inline code: `code` → code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Bold / italic: **text**, __text__, *text*, _text_ → text
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '$1');
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1');

  // Strikethrough: ~~text~~ → text
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // List markers at line start
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // Blockquote markers
  text = text.replace(/^\s*>+\s?/gm, '');

  // HTML tags (defensive)
  text = text.replace(/<[^>]+>/g, '');

  // Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Split long text into speech-friendly chunks.
 *
 * Chrome has a known bug where `speechSynthesis.speak()` stops after ~200
 * characters. We split by sentence/paragraph boundaries and batch the
 * utterances, targeting chunks of ~150 chars.
 */
export function chunkForSpeech(text: string, targetLen = 150): string[] {
  if (!text.trim()) return [];

  // Split on sentence/paragraph boundaries.
  const raw = text.split(/(?<=[。．！？!?])\s+|\n{2,}/);
  const chunks: string[] = [];
  let buffer = '';

  for (const piece of raw) {
    const p = piece.trim();
    if (!p) continue;

    if (buffer.length + p.length + 1 > targetLen && buffer) {
      chunks.push(buffer);
      buffer = p;
    } else {
      buffer = buffer ? `${buffer} ${p}` : p;
    }

    // If a single piece is already longer than target, emit directly.
    if (buffer.length >= targetLen) {
      chunks.push(buffer);
      buffer = '';
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}
