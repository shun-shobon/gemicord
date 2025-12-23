# 要件定義: Gemini CLI 対応Discord Bot

## 問題文 / 目的

Discord上でBotにメンション付きメッセージを送ると、その内容をGemini CLIに渡し、結果を整形してDiscordへ返信できるようにする。現状は雛形のみのため、Gemini CLIヘッドレスモードとセッション継続、出力整形、2000文字制限対応、セッション永続化を実装する。

## ソリューション概要

- Discordのメンション付きメッセージをトリガーにGemini CLIをヘッドレスで実行。
- `--output-format stream-json` のJSONLストリームを読み取り、イベントタイプに応じた整形結果を生成。
- 返信はDiscordの2000文字制限に合わせ、改行区切りで分割送信。
- Gemini CLIの`session_id`とDiscordメッセージIDをJSONファイルに保存し、返信スレッドでは `--resume` を利用して継続。

## 機能要件

1. **トリガー条件**
   - Botへの「メンション付きメッセージ」のみ処理対象。
   - Bot自身・他Botのメッセージは無視。
   - 対象は参加している全ギルド/チャンネル。
   - DMは対象外。

2. **Gemini CLI 実行**
   - `gemini --output-format stream-json --prompt <prompt> [--resume <session_id>]` で起動。
   - 可能であれば `--prompt` の非推奨警告を考慮し、位置引数形式も検討する。
   - 作業ディレクトリは環境変数で指定可能。未指定時は `process.cwd()`。

3. **JSONLストリーム処理**
   - `type`ごとの処理:
     - `tool_use`: ツール名とパラメータをコードブロックで表示。
     - `tool_result`: 成功/失敗と出力をコードブロックで表示。
     - `message` (role: assistant, delta: true): contentを順次結合。
     - `result`: 完了トリガー。
   - `tool_use` / `tool_result` は明示的にわかりやすく整形し、それ以外のassistantメッセージは結合して送信。

4. **Discordメッセージ分割**
   - 1メッセージ2000文字以内。
   - 改行を境に自然に分割。

5. **セッション継続**
   - 返信元メッセージが `sessions.json` に存在する場合のみ `--resume` を使用。
   - `session_id` をキー、DiscordメッセージIDを値として保存。
   - セッション情報は簡易JSONファイルで永続化し、再起動後も復元。

## 技術要件 / 実装方針

- 主要変更: `src/index.ts`。
- 追加候補:
  - `src/session-store.ts`: JSON永続化の読み書き。
  - `src/gemini.ts`: CLI起動とJSONL解析。
  - `src/format.ts`: tool_use/tool_result/assistant結合結果の整形と2000文字分割。
- セッションファイル:
  - `data/sessions.json` を既定保存先とする。
  - ディレクトリが無い場合は作成。
- Node標準ライブラリ（`child_process`, `fs/promises`, `path`, `readline` 等）を使用。
- ESM/TypeScriptルール準拠（`.ts`拡張子import、タブインデント）。

## 受け入れ条件

- メンション付きメッセージに対し、Gemini CLIの出力が整形されてDiscordに返信される。
- 2000文字制限を超える場合、改行で分割して送信される。
- `tool_use`/`tool_result` はコードブロックで明示され、assistantメッセージは結合される。
- 返信メッセージIDとセッションIDが `data/sessions.json` に保存される。
- 返信スレッドで `--resume` が利用され、セッションが継続される。
- Gemini CLIの作業ディレクトリは環境変数未指定時に `process.cwd()` を使用。

## 未確定事項と前提

- 同時実行数の制御は行わない（デフォルトNo）。
- 永続化はJSONファイルのみ（DBなし）。
- 仕様にないDM対応はしない。
