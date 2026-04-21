#!/usr/bin/env node
// admin-site の UI ソースツリーから決定的な 40 文字 hex sha を計算する。
// ローカル screenshot 生成時と CI の drift check で同じ入力から同じ sha が
// 出ることが目的。結果は `screenshots/manifest.json#source_tree_sha` に保存。
//
// watched_paths 内のファイルのうち、
//   - git で追跡されているファイル (`--cached`)
//   - 未追跡だが .gitignore に該当しないファイル (`--others --exclude-standard`)
// を列挙して path\0content\0 を連結 → sha256 → 先頭 40 文字を標準出力に書く。
//
// .gitignore されている生成物 (例: admin-site/src/assets/research-templates/
// に prebuild でコピーされる md) は対象外になるので、ローカル (dev が走って
// 生成済み) と CI (install していない) で sha が揃う。

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_SITE = resolve(HERE, '..');
const REPO_ROOT = resolve(ADMIN_SITE, '..');

// repo root 相対の watched paths。設定変更で sha が変わるよう WATCHED 自体も hash に含める。
const WATCHED = ['admin-site/src', 'admin-site/package.json'];

function collectFiles(pathsRelToRepo) {
  // git ls-files で tracked + untracked-but-not-ignored を列挙。
  // NUL 区切りでパスを取得し、パス中の改行やスペースに対応。
  const args = ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...pathsRelToRepo];
  const out = execFileSync('git', args, { cwd: REPO_ROOT, maxBuffer: 100 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean).sort();
}

function computeSha(pathsRelToRepo) {
  const h = createHash('sha256');
  // WATCHED 自身も hash に含める (監視対象の変更で drift が検知される)
  h.update(JSON.stringify(pathsRelToRepo));
  h.update('\0');
  for (const rel of collectFiles(pathsRelToRepo)) {
    h.update(rel);
    h.update('\0');
    h.update(readFileSync(join(REPO_ROOT, rel)));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 40);
}

// エクスポート (screenshot.mjs から import する場合用)
export { WATCHED, computeSha };

// 直接実行されたら標準出力に sha を書く
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(computeSha(WATCHED) + '\n');
  } catch (err) {
    console.error(`[compute-source-sha] failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
