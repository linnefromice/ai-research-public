/**
 * レポートのサマリー抜粋を取得する共通ユーティリティ。
 * D1 サマリーを優先し、なければ本文からパースする。
 *
 * D1 に保存されたサマリーも本文から切り出されたままの Markdown 記法を含むため
 * (例: `**bold**`)、表示前に必ず `stripMarkdown` で plain text 化する。
 */

interface D1Report {
  summary: string | null;
}

/**
 * Card excerpt 表示に最低限必要な markdown 記法を除去する。
 * 完全な markdown → text 変換を目指していない (renderer ではないので
 * 行頭インデントや list/blockquote の意味は復元しない)。あくまで「表示時に
 * 文字としてゴミに見える記号」を消すのが目的。
 */
function stripMarkdown(text: string): string {
  return text
    // images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // inline code: `code` → code
    .replace(/`([^`]+)`/g, '$1')
    // strong: **bold** / __bold__ → bold
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // emphasis: *em* / _em_ → em (前後が単語境界の時のみ。アンスコ名の URL 等は触らない)
    .replace(/(^|[\s\(])\*([^*\n]+)\*(?=[\s\),.!?:;]|$)/g, '$1$2')
    .replace(/(^|[\s\(])_([^_\n]+)_(?=[\s\),.!?:;]|$)/g, '$1$2')
    // headers: ##+ space → 削除して見出し本文だけ残す
    .replace(/^#{1,6}\s+/gm, '')
    // blockquote: 行頭 > → 削除
    .replace(/^>\s?/gm, '')
    // list bullets: 行頭 -, *, +, 1. → 削除
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // 連続 newline → 1 つの空白
    .replace(/\n+/g, ' ')
    // 連続スペースを 1 つに
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getExcerpt(
  meta: D1Report | undefined,
  body: string,
  maxLength: number = 200
): string {
  // D1 サマリーを優先 (markdown 記法を含むので strip してから返す)
  if (meta?.summary) {
    const text = stripMarkdown(meta.summary);
    return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
  }

  // 本文からパース:
  //   - Daily report: Today's Highlights / 今日のハイライト / xxx サマリー
  //   - Deep Research: Executive Summary
  // 多言語 feature の JA 翻訳版は見出しもローカライズされるため、英語版に
  // 加えて日本語の定型見出しも許容する。
  const match = body.match(
    /## (?:Today's Highlights|今日のハイライト|Executive Summary|.+サマリー)\s*\n+([\s\S]*?)(?=\n## |\n---|\n\n## )/
  );
  if (!match) return '';

  const text = stripMarkdown(match[1]);
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}
