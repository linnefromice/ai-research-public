# openclaw-public-src

RSS フィードソースリストを管理するパブリックリポジトリ。

## 目的

- 各 Feature のレポート生成で使用する RSS フィードの URL を一元管理
- GitHub Actions + Claude Code で定期的にソースリストを精査・更新
- パブリックリポジトリにすることで、人間によるレビューを経てマージする運用

## プロジェクト構成

```
<feature-name>/
  sources.json          # ソースリスト
.github/workflows/
  update-<feature>.yml  # 週次ソース精査ワークフロー
```

## sources.json の編集ルール

### フィールド定義

```json
{
  "name": "サイト名",
  "url": "https://example.com",
  "feed": "https://example.com/rss",
  "category": "カテゴリ名",
  "sessions": ["open", "mid", "close", "daily"]
}
```

### 必須チェック

- `feed` は実在する RSS URL を指定する。`curl -sf <feed>` で 200 が返ることを確認
- `feed` が取得できない場合は `null` にする（AI の Web アクセスで代替）
- `category` は Feature ごとに定義されたカテゴリから選択する

### sessions フィールド（invest-japan / invest-global のみ）

セッションレポート対応 Feature では `sessions` でソースの使用タイミングを制御する。

**設計方針:**
- `open` / `mid` / `close` には **RSS ありのソースのみ** を割り当てる
- `daily` には RSS なしのソースも含めてよい
- `sessions` フィールドを省略したソースは全セッションで使用される

### ソース選定の基準

- **速報性**: RSS の更新頻度が高いこと（1日数回以上の更新）
- **信頼性**: 主要メディアまたは専門メディアであること
- **重複回避**: 同じカテゴリで役割が重複するソースは1つに絞る
- **RSS 優先**: RSS ありのソースを優先し、なしのソースは最小限に

### ソース追加時の手順

1. `curl -sf <feed_url>` で RSS フィードの取得を確認
2. `category` を既存のカテゴリから選択（または新規カテゴリを提案）
3. `sessions` を適切に設定（セッション対応 Feature の場合）
4. PR を作成し、レビューを経てマージ

### ソース削除の判断基準

- RSS フィードが恒常的に 404/403 を返す
- 内容が他のソースと大幅に重複している
- 更新頻度が極端に低い（月1回未満）

## Feature 別カテゴリ

### tech-trends
AI/LLM, Development Tools, Cloud/Infrastructure, Security, Open Source, Programming

### finance-markets
markets, economy, fintech

### invest-japan
stocks, index, fx-jpy, reit, analysis

### invest-global
us-stocks, global-index, forex, commodities, crypto, analysis

### life-hacks
productivity, work-life-balance, parenting, health, home

## 連携リポジトリ

- **openclaw-automation-ws** (プライベート) — レポート生成パイプライン
  - `public-src/` にこのリポジトリをクローン
  - `shared/lib/fetch-feeds.sh` が `sources.json` を読み込み RSS をフェッチ
  - `SCHEDULE_SESSION` 環境変数で `sessions` フィールドによるフィルタリングが有効化
