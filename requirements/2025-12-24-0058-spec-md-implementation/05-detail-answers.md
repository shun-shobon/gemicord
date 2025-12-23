## Q6: 永続化ファイルはリポジトリ直下の `data/sessions.json` に保存してよいですか？

**Answer:** Yes（デフォルト採用）

## Q7: セッション保存ロジックは `src/session-store.ts` に切り出して、`src/index.ts` から呼ぶ形でよいですか？

**Answer:** Yes（デフォルト採用）

## Q8: `src/index.ts` ではボット自身や他ボットのメッセージを無視してよいですか？

**Answer:** Yes（デフォルト採用）

## Q9: 返信スレッドの継続判定は「`message.reference.messageId` が `sessions.json` に存在する場合のみ `--resume`」でよいですか？

**Answer:** Yes（デフォルト採用）

## Q10: DM(ダイレクトメッセージ)は対象外としてよいですか？

**Answer:** Yes（デフォルト採用）
