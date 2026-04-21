---
label: Postmortem
emoji: 🔥
description: インシデント・障害・セキュリティ事故の事後調査
order: 4
---
# Goal: {{INCIDENT_NAME}}

## Scope

{{INCIDENT_NAME}} (インシデント/障害/セキュリティ事故) の事後調査。

## Expected Output

- タイムライン (発生〜検知〜対処〜復旧)
- 根本原因 (技術的要因 + 組織的要因)
- 影響範囲 (ユーザー影響、データ損失、経済損失)
- 公式対応 (ベンダー声明、パッチ、mitigations)
- 類似事例との比較
- 今後の対策・提言

## Research Hints

- 公式 post-mortem / incident report
- Status page の過去ログ
- 関連 CVE / security advisory
- 主要メディアの報道 (TechCrunch, The Register, Hacker News)
- X / Mastodon の当事者エンジニアの発言

## Audience

SRE / インシデントレスポンス担当 / セキュリティエンジニア向け。再発防止に役立つ情報を整理する。

## Key Questions

1. 何が起きたか (事実ベース)
2. 検知までの時間と検知経路
3. 根本原因と再発防止策
4. 他社が学ぶべき教訓
