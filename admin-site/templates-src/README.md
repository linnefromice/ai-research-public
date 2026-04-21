# Deep Research Goal Templates

Deep Research 実行時の goal file テンプレート集。
ユーザーや外部コントリビューターからの投稿を歓迎します。

## 利用可能なテンプレート

| ファイル | 用途 | admin UI | 例 |
|---------|------|:-:|-----|
| [goal-concept.md](goal-concept.md) | 概念調査 (What / Why / When) | ✅ | 「Event Sourcing とは何か」 |
| [goal-howto.md](goal-howto.md) | How to use (使い方・落とし穴) | ✅ | 「Playwright を Monorepo で使う」 |
| [goal-comparison.md](goal-comparison.md) | 比較系テンプレ | ✅ | 「Bun vs Node.js 22 の技術選定比較」 |
| [goal-postmortem.md](goal-postmortem.md) | インシデント postmortem | ✅ | 「axios RAT 攻撃の経緯と対策」 |
| [goal-minimal.md](goal-minimal.md) | 最小テンプレ (CLI 専用) | — | 「pnpm の特徴を調査」 |
| [goal-standard.md](goal-standard.md) | 標準テンプレ (CLI 専用) | — | 「Kubernetes の GitOps ベストプラクティス」 |
| [enhance-template.md](enhance-template.md) | 既存レポートの追補 | — | Bun workspaces 観点を追加 |

"admin UI" 列が ✅ のテンプレは、admin-site の Research Requests フォームから 1 クリックで投入できる (ビルド時に bundle 済み)。

## 利用方法

```bash
# テンプレートから goal を起こす
cp features/deep-research/templates/goal-comparison.md features/deep-research/goals/my-topic.md
# {{TOPIC_A}}, {{TOPIC_B}} 等を編集
vi features/deep-research/goals/my-topic.md
# 実行
./manage.sh research run features/deep-research/goals/my-topic.md
```

## 新しいテンプレートを投稿する

PR を通じて、新しい目的別テンプレート (例: security-audit, vendor-evaluation,
migration-plan 等) を追加できます。

### 投稿ガイド

1. ファイル名: `goal-<purpose>.md`
2. 必須セクション: `## Scope`, `## Expected Output`, `## Research Hints`
3. プレースホルダ: `{{VARIABLE_NAME}}` 形式で置換可能箇所を示す (大文字 + 数字 + アンダースコア)
4. このファイル (README.md) の表に追加
5. PR のタイトルは `docs(research-templates): add <purpose> template`

### admin UI に表示する場合

ファイル先頭に以下の YAML frontmatter を追加する:

```yaml
---
label: 概念調査             # UI pill のラベル (日本語可)
emoji: 📖                   # pill 先頭の絵文字
description: 1 行説明        # pill 下に表示される
order: 5                   # 表示順 (整数、昇順)
---
```

frontmatter を持つファイルは admin-site のビルド時に自動コピーされて UI 選択肢に現れる。frontmatter が無いテンプレは CLI 専用となる。

## 将来の計画 (#126)

コミュニティ投稿の受付を容易にするため、以下を検討中:
- テンプレート投稿の Issue テンプレート化
- public-site に template gallery ページを追加
- テンプレート利用回数の統計 (D1 連携)
