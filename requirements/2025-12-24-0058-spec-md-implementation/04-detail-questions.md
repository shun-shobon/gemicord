## Q6: 永続化ファイルはリポジトリ直下の `data/sessions.json` に保存してよいですか？

**Default if unknown:** Yes（簡易永続化で、実行時に書き込み可能な場所として `data/` が分かりやすいため）
**Reasoning:** 小規模なJSON永続化に適し、コード側もパス管理が単純になります。

## Q7: セッション保存ロジックは `src/session-store.ts` に切り出して、`src/index.ts` から呼ぶ形でよいですか？

**Default if unknown:** Yes（責務分離により `src/index.ts` の肥大化を避けるため）
**Reasoning:** 将来的な保存方式変更（DB化など）にも対応しやすくなります。

## Q8: `src/index.ts` ではボット自身や他ボットのメッセージを無視してよいですか？

**Default if unknown:** Yes（ループ防止の一般的なベストプラクティスのため）
**Reasoning:** 応答の連鎖を防ぎ、予期しない大量実行を回避できます。

## Q9: 返信スレッドの継続判定は「`message.reference.messageId` が `sessions.json` に存在する場合のみ `--resume`」でよいですか？

**Default if unknown:** Yes（誤って別セッションに紐づくことを防ぐため）
**Reasoning:** 参照先が不明な場合は新規セッション扱いが安全です。

## Q10: DM(ダイレクトメッセージ)は対象外としてよいですか？

**Default if unknown:** Yes（現在のIntentsがGuildメッセージ中心で、仕様にもDM要件がないため）
**Reasoning:** 対象範囲を明確にし、運用リスクを下げられます。
