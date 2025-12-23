## コードベース概要

- 主要実装は `src/index.ts` に集約され、Discord.js の `Client` と `messageCreate` を使った最小ボット構成。
- 追加機能は `src/` に集約する方針。ESMで`.ts`拡張子付きimportが必須。
- 依存は `discord.js` のみ。CLI実行や永続化はNode標準ライブラリで対応が必要。

## 参照ドキュメント（Gemini CLI headless）

- Context7 `/google-gemini/gemini-cli` を確認。
- `--output-format stream-json` でJSONLストリームを取得可能。イベントをリアルタイムに扱える。`--output-format json` は単発JSON。
- headlessは非対話で利用でき、`--prompt` で直渡しも可能（ただしCLI側で廃止警告が出る可能性があるため、位置引数形式の検討余地あり）。

## 変更対象になりそうなファイル

- `src/index.ts`（メッセージ検知、Gemini CLI起動、ストリーム解析、Discord送信、2000文字分割、メッセージID↔セッションID保存）
- `src/` 配下に補助モジュール追加の可能性（例: `src/gemini.ts`, `src/session-store.ts`, `src/format.ts` など）
- 保存用JSONファイル（例: `data/sessions.json` など。保存先は要合意）

## 実装パターン・制約

- 既存は `messageCreate` のみ利用。メンション付きメッセージだけをトリガーにする判定が必要（`message.mentions`/`message.mentions.has(client.user)`）。
- CLI実行は `child_process.spawn` で `gemini` を起動し、`stdout` を行単位でJSONLパース。
- JSONLの `type` に応じて、
  - `tool_use` / `tool_result` をコードブロックで整形
  - `message` の `role: assistant` の `content` を `delta:true` で結合
  - 最後の `result` で完了判定
- 2000文字制限対応: `\n` を境に分割して送信。
- メッセージID↔セッションIDは「セッションIDがキー、メッセージIDが値」のJSONファイルで保存（再起動後も利用）。
- `--resume <session_id>` を使い、Discord返信の `message.reference` を辿ってセッションIDを復元。
- Gemini CLIの作業ディレクトリは環境変数指定。未指定時は実行ディレクトリ（`process.cwd()`）。

## 類似機能・参照実装

- 既存に類似機能なし（最小構成のみ）。

## 利用できなかった/存在しないツール

- `mcp__RepoPrompt__get_file_tree` / `mcp__RepoPrompt__search` / `mcp__RepoPrompt__set_selection` / `read_selected_files` は未提供のため未使用。
