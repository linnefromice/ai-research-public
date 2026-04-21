# admin-site

OpenClaw の管理画面 (Vite + React)。Cloudflare Pages にデプロイされ、Cloudflare Access で保護されている。

## Development

```bash
cd admin-site
npm install
npm run dev       # http://localhost:5173
```

`npm run dev` は事前に `scripts/copy-research-templates.mjs` を実行し、
`features/deep-research/templates/goal-*.md` を `src/assets/research-templates/` に
コピーする (Research テンプレ pill UI のバンドル用)。

## Build

```bash
npm run build     # tsc -b && vite build, dist/ に出力
```

## UI Screenshots (ローカル)

UI 改善のイテレーションを高速化するため、Playwright で主要画面を自動撮影できる。
Cloudflare Access で保護された本番 API は叩かず、`scripts/screenshot-fixtures.json`
の固定レスポンスをモックして local dev server に対して撮影する。

### Setup (初回のみ)

```bash
cd admin-site
npm install
npx playwright install chromium
```

### 実行

```bash
npm run screenshot                    # 全画面 × desktop/mobile (14 枚)
npm run screenshot:desktop            # desktop のみ (7 枚)
npm run screenshot:mobile             # mobile のみ (7 枚)

# ピンポイント撮影
node scripts/screenshot.mjs --url=events
node scripts/screenshot.mjs --url=events --viewport=mobile

# debug (headed browser)
node scripts/screenshot.mjs --headed
```

### 出力

`admin-site/screenshots/{page-id}--{viewport}.png` に PNG が出る。`screenshots/`
配下は git 管理下にあり、PR の diff で UI 変化を確認できる。

`screenshots/manifest.json` には生成時刻 / commit / `source_tree_sha` (UI ソースの
決定的ハッシュ) / 各 PNG の bytes が記録される。鮮度判定は後述の drift 管理で使う。

Claude Code で UI 改善を相談する際は、撮影後にパスを渡せば Read tool で画像を
読み込ませられる。

### 撮影対象

| id | path | 備考 |
|---|---|---|
| `reports` | `/` | Dashboard |
| `trends` | `/trends` | タグランキング (other は UI で除外) |
| `events` | `/events` | パイプラインイベント、ページング含む |
| `research` | `/research-requests` | Research 一覧 (フォーム閉) |
| `research-form-open` | `/research-requests` | フォーム展開 (テンプレ pill 表示) |
| `report-detail` | `/report/tech-trends/2026-04-19` | 日次レポート詳細 |
| `research-detail` | `/report/deep-research/supabase-vs-firebase` | Deep Research レポート詳細 |

### Fixtures の更新

`scripts/screenshot-fixtures.json` を直接編集する。API 型は `src/api/client.ts` の
interface に合わせること。fixture に無いエンドポイントはすべて
`{success: true, data: [], meta: {total: 0, ...}}` にフォールバックする。

### Drift 管理 (screenshot 鮮度の自動追従)

PNG と manifest は commit 対象。UI を更新したら screenshots も一緒に更新するのが
原則だが、更新忘れは CI でフォローする。

- **ローカル運用**: `admin-site/src` を編集したら `npm run screenshot` を実行し、
  `screenshots/` 配下 (PNG + manifest.json) を commit に含める
- **PR 時 warning**: `.github/workflows/admin-screenshots-check.yml` が
  `manifest.source_tree_sha` と現在の tree sha を比較し、ズレがあれば PR に
  warning コメントを投稿する (merge は block しない)
- **main push 後の自動 PR**: `.github/workflows/admin-screenshots-refresh.yml` が
  main push 時に drift を検出、Playwright で再撮影して
  `chore/refresh-admin-screenshots` ブランチで PR を自動作成する

`source_tree_sha` は `admin-site/src/**` + `admin-site/package.json` の内容から
`scripts/compute-source-sha.mjs` で決定的に計算される。`fixtures` や `README`
の変更では drift にならない。

### 既知の制約

- 本番 API の実データは取得しない (fixtures ベース)。実データでの UI 確認が必要な
  場合は、Cloudflare Access の session cookie を手動でセットするか、service token を
  使う別モードを追加する必要がある
- `research-form-open` はテンプレ pill の aria-expanded 属性に依存する。HTML 構造を
  変更した場合は `scripts/screenshot.mjs` の `afterNav` を更新する
