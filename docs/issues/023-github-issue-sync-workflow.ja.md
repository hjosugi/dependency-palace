<!-- i18n: language-switcher -->
[English](023-github-issue-sync-workflow.md) | [日本語](023-github-issue-sync-workflow.ja.md)

# GitHub イシュー同期ワークフロー

ラベル: `github`, `workflow`, `maintenance`, `priority:P2`, `status:ready`

## 問題点

ローカルのMarkdown形式のイシュー ファイルとGitHubのイシューがずれることがある。

## 目的

`docs/issues`からGitHubのイシューを作成または更新できるシンプルな同期ワークフローを作成する。

## 範囲

- タイトルとラベルを持つイシュー ファイルを解析。
- `DP-###`のタイトルプレフィックスを安定したキーとして使用。
- ドライランモードでは作成・更新操作を表示。
- 必要に応じて欠落しているラベルを作成。
- ローカルファイルから欠落しているGitHubイシューを作成。
- オプションでローカルファイルの変更に伴いイシュー本文を更新。

## 受け入れ基準

- `npm run issues:dry-run` でGitHubへの変更内容を一覧表示。
- `npm run issues:sync` で安全に欠落しているイシューを作成。
- 既存のイシューは`DP-###`プレフィックスで一致。
- 既に同期済みのイシューに対して重複作成は行われない。