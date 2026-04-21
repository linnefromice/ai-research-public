#!/usr/bin/env node
// public-src repo の prebuild step.
// test-fixtures/<feature>/*.md を public-site/src/content/<feature>/ にコピーする。
//
// Private repo (openclaw-automation-ws) での deploy 時は src/content/ が
// features/<feature>/reports/ への symlink として張り直されるので、この script は
// 実行されない (deploy workflow が管理)。Public repo の CI / local dev 専用。

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE = resolve(HERE, '..');
const REPO_ROOT = resolve(PUBLIC_SITE, '..');
const SRC_FIXTURES = join(REPO_ROOT, 'test-fixtures');
const DEST_CONTENT = join(PUBLIC_SITE, 'src', 'content');

if (!existsSync(SRC_FIXTURES)) {
  console.error(`[copy-fixtures] ${SRC_FIXTURES} not found. Skipping.`);
  process.exit(0);
}

// DEST_CONTENT を空に (既存の build artifact やシンボリックリンクを除去)
if (existsSync(DEST_CONTENT)) {
  rmSync(DEST_CONTENT, { recursive: true, force: true });
}
mkdirSync(DEST_CONTENT, { recursive: true });

const features = readdirSync(SRC_FIXTURES).filter(name => {
  const full = join(SRC_FIXTURES, name);
  return statSync(full).isDirectory();
});

for (const feature of features) {
  const src = join(SRC_FIXTURES, feature);
  const dest = join(DEST_CONTENT, feature);
  cpSync(src, dest, { recursive: true });
  const mdCount = readdirSync(dest).filter(n => n.endsWith('.md')).length;
  console.log(`  ✓ ${feature}: ${mdCount} md file(s)`);
}

console.log(`[copy-fixtures] copied ${features.length} feature dir(s) to src/content/`);
