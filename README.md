# openclaw-public-src

OpenClaw 自動化で使用するパブリックリソース。GitHub Actions によるソースリスト管理を行う。

## Structure

| ディレクトリ | 内容 |
|-------------|------|
| `tech-trends/sources.json` | 技術トレンド収集対象のソースリスト |
| `life-hacks/sources.json` | ワークライフバランス・ライフハック情報のソースリスト |
| `finance-markets/sources.json` | 国際金融市場のソースリスト |
| `invest-japan/sources.json` | 国内投資情報のソースリスト |
| `invest-global/sources.json` | 海外投資情報のソースリスト |

## sources.json Format

各エントリは以下のフィールドを持つ JSON 配列:

```json
{
  "name": "サイト名",
  "url": "https://example.com",
  "feed": "https://example.com/rss" or null,
  "category": "カテゴリ名"
}
```

- `feed` が `null` の場合、AI がウェブアクセスで記事を取得する
- `feed` がある場合、シェルスクリプトが RSS を事前取得し AI に渡す

## GitHub Actions

各 Feature に対応するワークフローが週1回（月曜）自動実行され、Claude Code がソースリストを精査・更新する PR を作成する。
