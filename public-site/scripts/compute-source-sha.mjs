#!/usr/bin/env node
// public-site の UI ソースツリーから決定的な 40 文字 hex sha を計算する。
// ローカル screenshot 生成時と CI の drift check で同じ入力から同じ sha が
// 出ることが目的。結果は `screenshots/manifest.json#source_tree_sha` に保存。
//
// watched_paths 内のファイルのうち、
//   - git で追跡されているファイル (`--cached`)
//   - 未追跡だが .gitignore に該当しないファイル (`--others --exclude-standard`)
// を列挙して path\0content\0 を連結 → sha256 → 先頭 40 文字を標準出力に書く。

import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE = resolve(HERE, '..');
const REPO_ROOT = resolve(PUBLIC_SITE, '..');

// repo root 相対の watched paths。設定変更で sha が変わるよう WATCHED 自体も hash に含める。
const WATCHED = ['public-site/src', 'public-site/package.json'];

function collectFiles(pathsRelToRepo) {
  const args = ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...pathsRelToRepo];
  const out = execFileSync('git', args, { cwd: REPO_ROOT, maxBuffer: 100 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean).sort();
}

function computeSha(pathsRelToRepo) {
  const h = createHash('sha256');
  h.update(JSON.stringify(pathsRelToRepo));
  h.update('\0');
  for (const rel of collectFiles(pathsRelToRepo)) {
    h.update(rel);
    h.update('\0');
    const full = join(REPO_ROOT, rel);
    // git の blob 表現に合わせ、symlink は target path を hash する (follow しない)。
    // public-site/src/content/<feature> は features/*/reports への symlink で、
    // 実ファイルを読むと EISDIR になる + 毎日の content 変更で sha が揺れるため。
    const st = lstatSync(full);
    if (st.isSymbolicLink()) {
      h.update(readlinkSync(full));
    } else {
      h.update(readFileSync(full));
    }
    h.update('\0');
  }
  return h.digest('hex').slice(0, 40);
}

export { WATCHED, computeSha };

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(computeSha(WATCHED) + '\n');
  } catch (err) {
    console.error(`[compute-source-sha] failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
