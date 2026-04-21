# openclaw-public-src

OpenClaw 自動化のパブリックリソース。2 つの役割を持つ:

1. **RSS ソースリスト管理** (`<feature>/sources.json`) — 各 Feature のレポート生成に使う RSS フィード URL を一元管理し、GitHub Actions で定期精査する
2. **Web UI コード** (`admin-site/`, `public-site/`) — 管理 UI と公開サイトのソース (source of truth)。このリポジトリで lint/typecheck/screenshot CI を回し、実デプロイは private 側 [`openclaw-automation-ws`](https://github.com/linnefromice/openclaw-automation-ws) が本 repo を clone して Cloudflare Pages / Workers にデプロイする

## ディレクトリ構成

```
openclaw-public-src/
├── <feature>/sources.json             RSS ソース定義
├── admin-site/                        React (Vite) 管理 UI
│   ├── templates-src/                 Deep Research テンプレ (SoT)
│   ├── scripts/screenshot.mjs         Playwright 自動撮影
│   └── scripts/copy-research-templates.mjs
├── public-site/                       Astro 公開サイト
│   ├── scripts/copy-fixtures-to-content.mjs  (prebuild: test-fixtures → src/content)
│   └── scripts/screenshot.mjs         Playwright 自動撮影
├── test-fixtures/                     Public CI 用のサンプル content (各 feature × 1 件)
└── .github/workflows/
    ├── update-*-sources.yml           RSS ソース自動精査 (既存)
    ├── ui-ci.yml                      admin-site / public-site の lint+build smoke
    ├── admin-screenshots-{check,refresh}.yml
    └── public-screenshots-{check,refresh}.yml
```

## Web UI 開発フロー

```bash
cd admin-site
npm install
npx playwright install chromium  # 初回のみ
npm run dev                       # http://localhost:5173
npm run screenshot                # 全 14 枚 (desktop/mobile × 7 画面)
```

```bash
cd public-site
npm install
npx playwright install chromium   # 初回のみ
npm run dev                       # http://localhost:4321 (test-fixtures が自動で src/content に展開される)
npm run screenshot                # 全 20 枚 (desktop/mobile × 10 画面)
```

`public-site` は `test-fixtures/<feature>/*.md` を prebuild で `src/content/<feature>/` にコピーして動作する。デプロイ時 (private repo) は代わりに features/<feature>/reports への symlink が張られる。

## RSS ソースリスト管理

## Feature 一覧

| ディレクトリ | 内容 | ソース数 |
|-------------|------|---------|
| `tech-trends/` | 技術トレンド（AI/LLM、開発ツール、クラウド、セキュリティ） | 14 |
| `finance-markets/` | 国際金融市場（マクロ経済、金融政策、フィンテック） | 12 |
| `invest-japan/` | 国内投資（日経平均、国内株式、円相場、J-REIT） | 11 |
| `invest-global/` | 海外投資（米国株、為替、コモディティ、暗号資産） | 11 |
| `life-hacks/` | ワークライフバランス・ライフハック | 10 |

## sources.json フォーマット

各エントリは以下のフィールドを持つ JSON 配列:

```json
{
  "name": "サイト名",
  "url": "https://example.com",
  "feed": "https://example.com/rss",
  "category": "カテゴリ名",
  "sessions": ["open", "mid", "close", "daily"]
}
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | Yes | ソースの表示名 |
| `url` | Yes | サイトの URL |
| `feed` | Yes | RSS フィード URL（`null` の場合は AI が Web アクセスで取得） |
| `category` | Yes | ソースのカテゴリ（Feature ごとに異なる） |
| `sessions` | No | ソースを使用するレポートセッション（後述） |

### sessions フィールド

`invest-japan` と `invest-global` は 1日複数回のセッションレポートに対応しており、`sessions` フィールドでソースの使用タイミングを制御する。

| セッション | 説明 |
|-----------|------|
| `daily` | 1日1回の経済状況まとめレポート |
| `open` | 市場オープン直後のスナップショット |
| `mid` | 前引け / 市場中盤のスナップショット |
| `close` | 大引け / 市場クローズ後のスナップショット |

**設計方針:**
- セッションレポート (open/mid/close) は **RSS ありのソースのみ** に限定（安定性・速度重視）
- 日次レポート (daily) は RSS なしのソースも含む（網羅性重視、AI の Web アクセスで取得）
- `sessions` フィールドがないソースは全セッションで使用される（後方互換）

### invest-japan セッションスケジュール (JST, 平日のみ)

| セッション | 時刻 | ソース数 | 内容 |
|-----------|------|---------|------|
| open | 08:45 | 3 | 寄り付き・前日米国おさらい |
| mid | 11:45 | 3 | 前引け・業種別動向 |
| close | 16:00 | 4 | 大引け・決算速報 |
| daily | 10:00 | 11 | 国内経済・市場の1日まとめ |

### invest-global セッションスケジュール (JST, 夏時間基準)

| セッション | 時刻 | ソース数 | 内容 |
|-----------|------|---------|------|
| open | 22:45 | 6 | 米国寄り付き・経済指標 |
| mid | 02:15 | 5 | 米国中盤・FOMC等 |
| close | 05:45 | 4 | 米国大引け・決算速報 |
| daily | 09:40 | 9 | 世界経済・市場の1日まとめ |

## GitHub Actions

各 Feature に対応するワークフローが週1回（月曜）自動実行され、Claude Code がソースリストを精査・更新する PR を作成する。

| ワークフロー | 対象 |
|-------------|------|
| `update-tech-trends-whitelist.yml` | tech-trends |
| `update-finance-markets-sources.yml` | finance-markets |
| `update-invest-japan-sources.yml` | invest-japan |
| `update-invest-global-sources.yml` | invest-global |
| `update-life-hacks-sources.yml` | life-hacks |

## 連携リポジトリ

- **openclaw-automation-ws** (プライベート) — レポート生成パイプライン、launchd 定期実行、Astro サイト
  - `public-src/` ディレクトリにこのリポジトリをクローンして使用
  - パイプライン実行時に `git pull` で最新のソースリストを取得
