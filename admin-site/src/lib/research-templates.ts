// Deep Research goal templates bundled at build time.
// SoT: features/deep-research/templates/goal-*.md (frontmatter 必須)
// Build: admin-site/scripts/copy-research-templates.mjs がコピー先を生成する。

export type TemplateMeta = {
  id: string;          // filename stem without extension: 'goal-concept'
  label: string;
  emoji: string;
  description: string;
  order: number;
  body: string;        // frontmatter を除いた本文 (textarea に挿入する内容)
  raw: string;         // frontmatter 込みの全文 (完全一致比較用)
};

export const BLANK_DEFAULT = `# Goal

（ここに調査目的を記述）

# Expected Output

（期待する成果物の形式・粒度）

# Keywords

（関連キーワードをカンマ区切り）
`;

const BLANK_TEMPLATE: TemplateMeta = {
  id: 'blank',
  label: 'Blank',
  emoji: '⭕',
  description: '最小雛形 (自分で書く)',
  order: 0,
  body: BLANK_DEFAULT,
  raw: BLANK_DEFAULT,
};

// frontmatter parser — features/deep-research/templates/*.md の冒頭 YAML を読む。
// 仕様: `---\n` で始まり `---\n` で終わる。中身は `key: value` 形式、値はクォートなし想定。
type Frontmatter = {
  label?: string;
  emoji?: string;
  description?: string;
  order?: number;
};

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } | null {
  if (!raw.startsWith('---\n')) return null;
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const fmBlock = raw.slice(4, end);
  const body = raw.slice(end + 5);

  const fm: Frontmatter = {};
  for (const line of fmBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    // strip inline comment (after unquoted value)
    const hash = value.indexOf(' #');
    if (hash !== -1) value = value.slice(0, hash).trim();
    // strip matching quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    switch (key) {
      case 'label': fm.label = value; break;
      case 'emoji': fm.emoji = value; break;
      case 'description': fm.description = value; break;
      case 'order': fm.order = Number.parseInt(value, 10); break;
    }
  }
  return { fm, body };
}

function toMeta(filename: string, raw: string): TemplateMeta | null {
  const parsed = parseFrontmatter(raw);
  if (!parsed) {
    console.warn(`[research-templates] ${filename}: frontmatter missing, skipping`);
    return null;
  }
  const { fm, body } = parsed;
  if (!fm.label || !fm.emoji || !fm.description || fm.order === undefined || Number.isNaN(fm.order)) {
    console.warn(`[research-templates] ${filename}: incomplete frontmatter`, fm);
    return null;
  }
  // filename = '/path/to/goal-concept.md' → id = 'goal-concept'
  const base = filename.split('/').pop() ?? filename;
  const id = base.replace(/\.md$/, '');
  return {
    id,
    label: fm.label,
    emoji: fm.emoji,
    description: fm.description,
    order: fm.order,
    body,
    raw,
  };
}

// Vite が build 時に ../assets/research-templates/*.md を全て bundle する。
// eager: true で同期的に読み込み、アプリ起動時点で配列が確定する。
const modules = import.meta.glob('../assets/research-templates/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const fileTemplates: TemplateMeta[] = Object.entries(modules)
  .map(([path, raw]) => toMeta(path, raw))
  .filter((t): t is TemplateMeta => t !== null);

export const researchTemplates: TemplateMeta[] = [BLANK_TEMPLATE, ...fileTemplates].sort(
  (a, b) => a.order - b.order,
);

export const PLACEHOLDER_REGEX = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

export function extractPlaceholders(content: string): string[] {
  const matches = content.matchAll(PLACEHOLDER_REGEX);
  const seen = new Set<string>();
  for (const m of matches) seen.add(m[1]);
  return Array.from(seen);
}
