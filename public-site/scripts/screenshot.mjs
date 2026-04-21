#!/usr/bin/env node
// public-site UI screenshot runner.
// 使い方:
//   npm run screenshot                          # 全画面 × desktop/mobile
//   npm run screenshot:mobile                   # mobile のみ
//   node scripts/screenshot.mjs --url=home      # 特定ページのみ
//   node scripts/screenshot.mjs --headed        # debug (headed browser)
//
// Astro dev server (port 4321) に対して Playwright で主要ページを撮影し、
// screenshots/ に PNG + manifest.json を出力する。
// Content Collection のソース (features/*/reports/*.md) は symlink 経由で
// 実ファイルが render されるため、fixture 化は不要 (symlink 追跡のみで sha 計算)。
// 一部のクライアント fetch (/api/engage/*, /api/visibility/*) は空レスポンスを mock。

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { WATCHED, computeSha } from './compute-source-sha.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITE = resolve(HERE, '..');
const REPO_ROOT = resolve(PUBLIC_SITE, '..');
const DEFAULT_PORT = 4321;

// Date + timezone を固定して決定的に (admin-site と同じ値)
const FROZEN_TIME_ISO = '2026-04-20T10:00:00Z';
const FROZEN_TIMEZONE = 'Asia/Tokyo';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
};

// URL は軽量な待機セレクタで load 完了を判定。main 要素があればレンダリング済みとみなす。
const URLS = [
  { id: 'home', path: '/', waitFor: 'main' },
  { id: 'status', path: '/status/', waitFor: 'main' },
  { id: 'calendar', path: '/calendar/', waitFor: 'main' },
  { id: 'trends', path: '/trends/', waitFor: 'main' },
  { id: 'tags', path: '/tags/', waitFor: 'main' },
  { id: 'rankings', path: '/rankings/', waitFor: 'main' },
  { id: 'feature-listing', path: '/tech-trends/', waitFor: 'main' },
  { id: 'report-detail', path: '/tech-trends/2026-04-19/', waitFor: 'article, main' },
  { id: 'deep-research-index', path: '/deep-research/', waitFor: 'main' },
  { id: 'deep-research-detail', path: '/deep-research/supabase-vs-firebase/', waitFor: 'article, main' },
];

function parseArgs(argv) {
  const args = { viewport: 'all', url: null, headed: false, port: DEFAULT_PORT };
  for (const a of argv.slice(2)) {
    if (a === '--headed') args.headed = true;
    else if (a.startsWith('--viewport=')) args.viewport = a.slice('--viewport='.length);
    else if (a.startsWith('--url=')) args.url = a.slice('--url='.length);
    else if (a.startsWith('--port=')) args.port = Number.parseInt(a.slice('--port='.length), 10);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: screenshot.mjs [options]
  --viewport=desktop|mobile|all  (default: all)
  --url=<id>                     (default: all)
  --headed                       (run non-headless)
  --port=<num>                   (default: 4321)`);
      process.exit(0);
    }
  }
  return args;
}

async function isServerRunning(port) {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function waitForPort(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not start on port ${port} within ${timeoutMs}ms`);
}

async function startDevServer(port) {
  console.log(`[screenshot] Starting Astro dev server on port ${port}...`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: PUBLIC_SITE,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (b) => process.stderr.write(`[dev] ${b}`));
  // Astro dev は初回 content collection のコンパイルで時間がかかるため、
  // デフォルトの admin-site より長めの 60 秒を設定。
  await waitForPort(port, 60_000);
  console.log(`[screenshot] Dev server is ready.`);
  return child;
}

// クライアント fetch を受ける endpoint は空レスポンスで mock する。
function makeRouteHandler() {
  const empty = (arr = []) => ({ success: true, data: arr, meta: { total: 0, limit: 30, offset: 0 } });

  return async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const tryJson = (obj) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });

    if (path.startsWith('/api/engage/')) return tryJson(empty());
    if (path.startsWith('/api/visibility/')) return tryJson({ success: true, unpublished: [] });
    if (path.startsWith('/api/auth/')) return tryJson(empty());

    return route.continue();
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = join(PUBLIC_SITE, 'screenshots');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const viewportEntries = Object.entries(VIEWPORTS).filter(
    ([name]) => args.viewport === 'all' || args.viewport === name,
  );
  if (viewportEntries.length === 0) {
    console.error(`Invalid --viewport value: ${args.viewport}`);
    process.exit(1);
  }

  const urlSet = args.url ? URLS.filter((u) => u.id === args.url) : URLS;
  if (urlSet.length === 0) {
    console.error(`No URL matched --url=${args.url}. Available: ${URLS.map((u) => u.id).join(', ')}`);
    process.exit(1);
  }

  let devChild = null;
  const cleanup = () => {
    if (devChild) {
      console.log('[screenshot] Stopping dev server...');
      devChild.kill('SIGTERM');
      devChild = null;
    }
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    if (!(await isServerRunning(args.port))) {
      devChild = await startDevServer(args.port);
    } else {
      console.log(`[screenshot] Using existing dev server on port ${args.port}`);
    }

    const browser = await chromium.launch({ headless: !args.headed });
    const routeHandler = makeRouteHandler();
    const failures = [];
    const successes = [];

    const frozenMs = new Date(FROZEN_TIME_ISO).getTime();

    for (const [vpName, vp] of viewportEntries) {
      const ctx = await browser.newContext({
        viewport: vp,
        deviceScaleFactor: 1,
        timezoneId: FROZEN_TIMEZONE,
      });
      await ctx.addInitScript(`(() => {
        const FROZEN = ${frozenMs};
        const OriginalDate = Date;
        const DateProxy = new Proxy(OriginalDate, {
          construct(target, args) {
            return args.length === 0 ? new target(FROZEN) : new target(...args);
          },
        });
        Object.defineProperty(globalThis, 'Date', { value: DateProxy, writable: true, configurable: true });
        Date.now = () => FROZEN;
      })();`);
      const page = await ctx.newPage();
      await page.route((url) => new URL(url).pathname.startsWith('/api/'), routeHandler);

      for (const u of urlSet) {
        const out = join(outDir, `${u.id}--${vpName}.png`);
        const url = `http://localhost:${args.port}${u.path}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
          if (u.waitFor) await page.waitForSelector(u.waitFor, { timeout: 10_000 });
          if (u.afterNav) await u.afterNav(page);
          await page.waitForTimeout(300);
          const fullPage = vpName !== 'mobile';
          await page.screenshot({ path: out, fullPage });
          successes.push(out);
          console.log(`  ✓ ${vpName}/${u.id}`);
        } catch (err) {
          failures.push({ id: u.id, viewport: vpName, error: err instanceof Error ? err.message : String(err) });
          console.log(`  ✗ ${vpName}/${u.id}: ${err instanceof Error ? err.message : err}`);
        }
      }

      await ctx.close();
    }

    await browser.close();

    if (successes.length > 0) {
      await writeManifest(outDir);
    }

    console.log('');
    console.log(`[screenshot] Done. ${successes.length} captured, ${failures.length} failed.`);
    if (failures.length > 0) {
      for (const f of failures) console.log(`  FAIL ${f.viewport}/${f.id}: ${f.error}`);
      process.exitCode = 1;
    }
  } finally {
    cleanup();
  }
}

async function writeManifest(outDir) {
  const manifestPath = join(outDir, 'manifest.json');
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {}
  const files = { ...(existing.files ?? {}) };
  for (const name of readdirSync(outDir).filter(n => n.endsWith('.png')).sort()) {
    files[name] = { bytes: statSync(join(outDir, name)).size };
  }
  let commit = 'uncommitted';
  try {
    commit = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {}
  const manifest = {
    generated_at: new Date().toISOString(),
    generated_commit: commit,
    watched_paths: WATCHED,
    source_tree_sha: computeSha(WATCHED),
    files,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`  ✓ manifest.json (source_tree_sha: ${manifest.source_tree_sha})`);
}

main().catch((err) => {
  console.error('[screenshot] Fatal:', err);
  process.exit(1);
});
