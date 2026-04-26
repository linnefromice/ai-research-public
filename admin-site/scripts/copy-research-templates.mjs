#!/usr/bin/env node
// admin-site prebuild: admin-site/templates-src/ から YAML frontmatter を持つ
// goal-*.md を admin-site/src/assets/research-templates/ にコピーする。
// frontmatter 未搭載のファイル (goal-minimal/standard, enhance-template) はスキップ。
// SoT は admin-site/templates-src/。コピー先は .gitignore で除外する。
//
// 注: private repo (ai-research-pipeline) 側の features/deep-research/templates/ と
// 内容を定期的に同期する必要がある (2 箇所管理)。詳細は ../README.md 参照。

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, '../templates-src');
const DEST_DIR = resolve(HERE, '../src/assets/research-templates');

function hasFrontmatter(content) {
  return content.startsWith('---\n');
}

async function main() {
  const entries = await readdir(SRC_DIR);
  const candidates = entries.filter(name => name.startsWith('goal-') && name.endsWith('.md'));

  // コピー先を空にしてから再生成 (古いファイルが残らないように)
  await rm(DEST_DIR, { recursive: true, force: true });
  await mkdir(DEST_DIR, { recursive: true });

  const copied = [];
  const skipped = [];

  for (const name of candidates) {
    const srcPath = join(SRC_DIR, name);
    const content = await readFile(srcPath, 'utf8');
    if (!hasFrontmatter(content)) {
      skipped.push(name);
      continue;
    }
    const destPath = join(DEST_DIR, name);
    await writeFile(destPath, content, 'utf8');
    copied.push(name);
  }

  console.log(`[copy-research-templates] copied ${copied.length} file(s) to admin-site/src/assets/research-templates/`);
  for (const n of copied) console.log(`  ✓ ${n}`);
  if (skipped.length > 0) {
    console.log(`[copy-research-templates] skipped ${skipped.length} file(s) without frontmatter (CLI-only):`);
    for (const n of skipped) console.log(`  - ${n}`);
  }

  if (copied.length === 0) {
    console.error('[copy-research-templates] ERROR: no templates with frontmatter found. admin UI will be empty.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[copy-research-templates] failed:', err);
  process.exit(1);
});
