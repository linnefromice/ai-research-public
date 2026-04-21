#!/usr/bin/env node
// admin-site UI screenshot runner.
// 使い方:
//   npm run screenshot                          # 全画面 × desktop/mobile
//   npm run screenshot:mobile                   # mobile のみ
//   node scripts/screenshot.mjs --url=events    # events のみ
//   node scripts/screenshot.mjs --headed        # debug (headed browser)
//
// Cloudflare Access で保護された本番 API は叩かず、scripts/screenshot-fixtures.json
// の固定レスポンスを page.route() でモックする。

import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { WATCHED, computeSha } from './compute-source-sha.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_SITE = resolve(HERE, '..');
const REPO_ROOT = resolve(ADMIN_SITE, '..');
const FIXTURES_PATH = join(HERE, 'screenshot-fixtures.json');
const DEFAULT_PORT = 5173;

// ローカルと CI で byte-identical な PNG を出すため、ブラウザの Date と timezone を固定する。
// Date のみ固定してタイムゾーンが異なると toLocaleString の出力が揺れるため、両方セット。
// FROZEN_TIMEZONE は fixtures が JST ベースで書かれているため Asia/Tokyo。
const FROZEN_TIME_ISO = '2026-04-20T10:00:00Z';
const FROZEN_TIMEZONE = 'Asia/Tokyo';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
};

const URLS = [
  { id: 'reports', path: '/', waitFor: '.card' },
  { id: 'trends', path: '/trends', waitFor: '.card' },
  { id: 'events', path: '/events', waitFor: '.table' },
  { id: 'research', path: '/research-requests', waitFor: '[data-testid="research-form-toggle"]' },
  {
    id: 'research-form-open',
    path: '/research-requests',
    waitFor: '[data-testid="research-form-toggle"]',
    afterNav: async (page) => {
      await page.click('[data-testid="research-form-toggle"]');
      await page.waitForSelector('textarea', { timeout: 3000 });
      await page.waitForTimeout(200);
    },
  },
  { id: 'report-detail', path: '/report/tech-trends%2F2026-04-19', waitFor: 'h1' },
  { id: 'research-detail', path: '/report/deep-research%2Fsupabase-vs-firebase', waitFor: 'h1' },
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
  --url=<id>                     (default: all — e.g. reports, events)
  --headed                       (run non-headless for debugging)
  --port=<num>                   (default: 5173)`);
      process.exit(0);
    }
  }
  return args;
}

async function isServerRunning(port) {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1000) });
    return res.ok || res.status === 404; // Vite dev returns 200 at /, but either way the server is up.
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
  console.log(`[screenshot] Starting dev server on port ${port}...`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
    cwd: ADMIN_SITE,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // surface fatal errors early
  child.stderr.on('data', (b) => process.stderr.write(`[dev] ${b}`));
  await waitForPort(port, 30_000);
  console.log(`[screenshot] Dev server is ready.`);
  return child;
}

function makeRouteHandler(fixtures) {
  const fallback = { success: true, data: [], meta: { total: 0, limit: 30, offset: 0 } };

  return async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    // `/report/tech-trends/2026-04-19` のような encoded slash パス
    const tryJson = (obj) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });

    if (path === '/api/reports') return tryJson(fixtures.reports);
    if (path === '/api/trends/tags') return tryJson(fixtures.trends);
    if (path === '/api/research-requests') return tryJson(fixtures.research_requests);
    if (path === '/api/events') return tryJson(fixtures.events);

    // /api/reports/:id/related  ← /tags より前に判定
    if (/^\/api\/reports\/[^/]+\/related$/.test(path)) return tryJson(fixtures.related_reports);
    // /api/reports/:id/tags[/batch]  ← detail レポートより前で分岐
    if (/^\/api\/reports\/[^/]+\/tags(\/batch)?$/.test(path)) {
      return tryJson(fixtures.report_tags ?? { success: true, data: [] });
    }
    // /api/reports/:id  (最後に fallback として detail fixture を返す)
    if (path.startsWith('/api/reports/')) {
      const id = decodeURIComponent(path.slice('/api/reports/'.length));
      if (id.startsWith('deep-research/')) return tryJson(fixtures.reports_detail_deepresearch);
      return tryJson(fixtures.reports_detail_tech);
    }

    return tryJson(fallback);
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fixtures = JSON.parse(await readFile(FIXTURES_PATH, 'utf8'));
  const outDir = join(ADMIN_SITE, 'screenshots');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  // viewport 選択
  const viewportEntries = Object.entries(VIEWPORTS).filter(
    ([name]) => args.viewport === 'all' || args.viewport === name,
  );
  if (viewportEntries.length === 0) {
    console.error(`Invalid --viewport value: ${args.viewport}`);
    process.exit(1);
  }

  // URL 選択
  const urlSet = args.url ? URLS.filter((u) => u.id === args.url) : URLS;
  if (urlSet.length === 0) {
    console.error(`No URL matched --url=${args.url}. Available: ${URLS.map((u) => u.id).join(', ')}`);
    process.exit(1);
  }

  // dev server (既存なら再利用)
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
    const routeHandler = makeRouteHandler(fixtures);
    const failures = [];
    const successes = [];

    for (const [vpName, vp] of viewportEntries) {
      const ctx = await browser.newContext({
        viewport: vp,
        deviceScaleFactor: 1,
        timezoneId: FROZEN_TIMEZONE,
      });
      // ブラウザが起動する前に Date を固定するため addInitScript を使う。
      // new Date() (引数なし) と Date.now() のみ乗っ取り、new Date(string) 等は素通し。
      const frozenMs = new Date(FROZEN_TIME_ISO).getTime();
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
      // `**/api/**` だと /src/api/client.ts のような Vite の module request も巻き込むため、
      // URL pathname の prefix 判定でフィルタする。
      await page.route((url) => new URL(url).pathname.startsWith('/api/'), routeHandler);

      for (const u of urlSet) {
        const out = join(outDir, `${u.id}--${vpName}.png`);
        const url = `http://localhost:${args.port}${u.path}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
          if (u.waitFor) await page.waitForSelector(u.waitFor, { timeout: 5_000 });
          if (u.afterNav) await u.afterNav(page);
          await page.waitForTimeout(200);
          // desktop は overview 重視でページ全体、mobile は実機の "折り目" と
          // 同じ viewport 内のみを撮影する (UX レビュー目的に合わせる)。
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

    // manifest を更新 (部分撮影時は既存 files エントリを保持)
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
  } catch {
    // 初回または壊れている場合は空から開始
  }
  const files = { ...(existing.files ?? {}) };
  for (const name of readdirSync(outDir).filter(n => n.endsWith('.png')).sort()) {
    files[name] = { bytes: statSync(join(outDir, name)).size };
  }
  let commit = 'uncommitted';
  try {
    commit = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    // git が無い環境 (CI の shallow checkout 等) でも動く
  }
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
