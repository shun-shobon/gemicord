このアプリは、Discord Bot上でGemini CLIが利用できるようにするアプリケーションです。
今はDiscord Botの雛形のみがあるため、Gemini CLIを利用するための機能を追加していきます。

## 要件

- Botにメンション付きでメッセージを送ったら、それがGemini CLIへのプロンプトとして送信され、その結果がDiscordで返信されるようにします。
- Gemini CLIはヘッドレスモードで起動ができるため、それを利用してください。
- ヘッドレスモードの詳細については、Context7を用いて、以下のURLを参照してください。
  https://context7.com/google-gemini/gemini-cli/llms.txt?topic=headless
- Gemini CLIのヘッドレスモードではJSONをストリーミングできます。JSONの内容が全て出力されたら、その内容をパースし、Discordに整形して送信するようにしてください。
- Gemini CLIは`--resume <session_id>`で前回からの続きで実行することができます。そのため、Discordに送信後はその送信したメッセージのIDとセッションIDとの対応を保持しておいてください。 そのメッセージに対して返信がされた場合は、`--resume`を使い、セッションの続きとして処理するようにしてください。
- Gemini CLIを実行するワーキングディレクトリは環境変数から指定できるようにしてください。ただし、未指定の場合はプログラムの実行ディレクトリになるようにしてください。

## 実行例

Gemini CLIのヘッドレスモードは以下のように起動できます。

```
gemini --output-format stream-json --prompt <prompt> --resume <session_id>
```

Gemini CLIは標準出力として、以下のようなJSONLを出力します。

```jsonl
{"type":"init","timestamp":"2025-12-22T23:12:21.385Z","session_id":"26c6651e-444c-42da-94a6-26b6bab096f0","model":"auto-gemini-2.5"}
{"type":"message","timestamp":"2025-12-22T23:12:21.386Z","role":"user","content":"今のディレクトリにどんなファイルが有るかを教えて。"}
{"type":"message","timestamp":"2025-12-22T23:12:21.386Z","role":"assistant","content":"The --prompt (-p) flag has been deprecated and will be removed in a future version. Please use a positional argument for your prompt. See gemini --help for more information.\n","delta":true}
{"type":"tool_use","timestamp":"2025-12-22T23:12:25.514Z","tool_name":"list_directory","tool_id":"list_directory-1766445145513-343f3acdf059e","parameters":{"dir_path":"."}}
{"type":"tool_result","timestamp":"2025-12-22T23:12:25.545Z","tool_id":"list_directory-1766445145513-343f3acdf059e","status":"success","output":"Listed 13 item(s). (2 ignored)"}
{"type":"message","timestamp":"2025-12-22T23:12:26.582Z","role":"assistant","content":"はい","delta":true}
{"type":"message","timestamp":"2025-12-22T23:12:26.685Z","role":"assistant","content":"、現在のディレクトリには以下のファイルとフォルダがあります。\n\n- data (フォルダ)\n- node_","delta":true}
{"type":"message","timestamp":"2025-12-22T23:12:26.761Z","role":"assistant","content":"modules (フォルダ)\n- requirements (フォルダ)\n- src (フォルダ)\n-","delta":true}
{"type":"message","timestamp":"2025-12-22T23:12:26.903Z","role":"assistant","content":" .gitignore\n- eslint.config.js\n- GEMINI.md\n- mise.toml\n- package.json\n- pnpm-lock.yaml\n- p","delta":true}
{"type":"message","timestamp":"2025-12-22T23:12:27.107Z","role":"assistant","content":"npm-workspace.yaml\n- prettier.config.js\n- tsconfig.json\n\nなお、`.git`とその他のいくつかのファイルは表示が省略","delta":true}
{"type":"message","timestamp":"2025-12-22T23:12:27.137Z","role":"assistant","content":"されています。","delta":true}
{"type":"result","timestamp":"2025-12-22T23:12:27.144Z","status":"success","stats":{"total_tokens":13374,"input_tokens":12821,"output_tokens":186,"cached":9598,"input":3223,"duration_ms":5760,"tool_calls":1}}
```

この場合、Discordには以下のようなメッセージを送信するようにしてください。

```
**[tool_use]**: `list_directory`

はい、現在のディレクトリには以下のファイルとフォルダがあります。

- data (フォルダ)
- node_modules (フォルダ)
- requirements (フォルダ)
- src (フォルダ)
- .gitignore
- eslint.config.js
- GEMINI.md
- mise.toml
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- prettier.config.js
- tsconfig.json

なお、`.git`とその他のいくつかのファイルは表示が省略されています。
```

このように、tool_useは使ったツール名とパラメータ、結果をコードブロック形式でわかりやすく表示し、その他のassistantのメッセージはメッセージを結合して表示します。

## 注意点

- メッセージの長さが2000文字を超える場合、Discordの文字数制限に引っかかってしまいます。そのため、メッセージを分割して2000文字以内に収まるようにして送信してください。ただし、メッセージが不自然に分割されないよう、改行のタイミングで分割するようにしてください。
