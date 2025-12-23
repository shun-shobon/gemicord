# Repository Guidelines

## Project Structure & Module Organization
このリポジトリは Discord.js を使ったシンプルなボットです。 主要な実装は `src/index.ts` に集約されています。 設定ファイルはリポジトリ直下にあり、`tsconfig.json`、`eslint.config.js`、`prettier.config.js` が TypeScript と整形・静的解析の基準を定義しています。 依存管理は `pnpm` で、ロックファイルは `pnpm-lock.yaml` です。

## Build, Test, and Development Commands
実行コマンドは `package.json` の scripts に定義されています。 Node の `--strip-types` を使って TypeScript を直接実行します。

```sh
pnpm dev   # 監視モードで起動（ローカル開発向け）
pnpm start # 1 回起動（本番実行や動作確認向け）
pnpm format # フォーマットを適用
pnpm lint # 静的解析
pnpm lint:fix # 静的解析の修正
pnpm typecheck # 型チェック
```

コードの編集を行った場合は、`pnpm typecheck`、`pnpm lint:fix`と`pnpm format`を実行して型チェックと静的解析とフォーマットの修正を行ってください。

## Coding Style & Naming Conventions
ESM (`"type": "module"`) を前提に TypeScript で実装します。 フォーマットは Prettier 設定に従い、既存ファイルはタブインデントです。 変数・関数は `camelCase`、クラスは `PascalCase` を基本にし、追加モジュールは `src/` 配下へ `feature.ts` のような意味のある名前で置いてください。
別のファイルをインポートする場合は、`import { hello } from "./hello.ts"`のように拡張子を含むパスでインポートしてください(拡張子は.tsです！)。
