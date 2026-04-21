# public-site

OpenClaw の公開サイト (Astro + Cloudflare Pages + BetterAuth + D1)。

設計ドキュメントは [docs/guides/public-site-architecture.md](../docs/guides/public-site-architecture.md) を参照。

## Development

```bash
cd public-site
npm install
npm run dev       # http://localhost:4321
```

## Build

```bash
npm run build     # astro build, dist/ に出力
```

## UI Screenshots (ローカル)

admin-site と同じ仕組みで、Playwright を使って主要画面を自動撮影できる。
PR レビュー時に UI diff を可視化する目的。

### Setup (初回のみ)

```bash
cd public-site
npm install
npx playwright install chromium
```

### 実行

```bash
npm run screenshot                    # 全画面 × desktop/mobile (20 枚)
npm run screenshot:desktop            # desktop のみ (10 枚)
npm run screenshot:mobile             # mobile のみ (10 枚)

# ピンポイント撮影
node scripts/screenshot.mjs --url=home
node scripts/screenshot.mjs --url=home --viewport=mobile

# debug (headed browser)
node scripts/screenshot.mjs --headed
```

### 撮影対象 (10 URL × 2 viewport = 20 PNG)

| id | path | 備考 |
|---|---|---|
| `home` | `/` | 横断ダッシュボード |
| `status` | `/status/` | パイプライン稼働状況 |
| `calendar` | `/calendar/` | カレンダー表示 |
| `trends` | `/trends/` | トレンド |
| `tags` | `/tags/` | タグ一覧 |
| `rankings` | `/rankings/` | ランキング |
| `feature-listing` | `/tech-trends/` | 代表 feature 一覧 |
| `report-detail` | `/tech-trends/2026-04-20/` | 代表 1 日次レポート |
| `deep-research-index` | `/deep-research/` | Deep Research 一覧 |
| `deep-research-detail` | `/deep-research/supabase-vs-firebase/` | Deep Research 詳細 |

Viewport: desktop 1440×900 (fullPage) / mobile 375×812 (viewport-only、実機の折り目)。

`/my/*` は BetterAuth session が必要なため対象外。

### Drift 管理

PNG と `screenshots/manifest.json` は git 管理下。PR review 時に UI 変化を diff で確認できる。

- **ローカル運用**: `public-site/src` を編集したら `npm run screenshot` を実行し、`screenshots/` を commit に含める
- **PR 時 warning**: `.github/workflows/public-screenshots-check.yml` が `source_tree_sha` の乖離を検知したら PR に warning コメント (merge は block しない)
- **main push 後の自動 PR**: `.github/workflows/public-screenshots-refresh.yml` が drift を再撮影して `chore/refresh-public-site-screenshots` ブランチで PR 自動作成
- **daily 自動追従**: 同 workflow が **毎日 03:15 UTC (12:15 JST)** にも走り、content (features/*/reports/) 更新で visual が変わった場合も自動で追従 PR を開く

`source_tree_sha` は `public-site/src/**` + `public-site/package.json` の内容から `scripts/compute-source-sha.mjs` で決定的に計算される。`features/*/reports/` の変更 (symlink target) は hash に含めない (= content 更新では drift にならず、daily cron のみが再生成をトリガー)。

### 決定性

Playwright の Date / timezone を固定 (`2026-04-20T10:00:00Z`, `Asia/Tokyo`) + `/api/engage/*` などクライアント fetch を空レスポンスに mock している。同一環境で再実行すると PNG は byte-identical。

### 既知の制約

- 本番 API の実データは使わない (engage 数やブックマーク数は 0 表示)。実データ確認は Cloudflare Pages preview で別途
- `/my/*` (BetterAuth session が必要) は撮影対象外
- OS 間 (macOS local / Linux CI) のフォント rendering 差で僅かに PNG が変わる可能性あり。頻発したら pixelmatch 等での dedup を別途検討

### Fixtures (API mock)

`scripts/screenshot.mjs` 内に inline で `/api/engage/*` / `/api/visibility/*` / `/api/auth/*` を空レスポンスで返すロジックを持つ。mock data を充実させたい場合はここを修正する。

## Tests

視覚回帰の別アプローチ (Playwright `toHaveScreenshot()` の baseline diff) は `tests/visual.spec.ts` にある。新しい screenshot tool とは並立。
