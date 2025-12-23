const mentionPattern = (botId: string): RegExp =>
	new RegExp(`<@!?${botId}>`, "gu");

export function stripBotMention(content: string, botId: string): string {
	return content.replace(mentionPattern(botId), "").trim();
}

export function splitDiscordMessage(text: string, limit = 2000): string[] {
	const lines = text.split("\n");
	const chunks: string[] = [];
	let buffer = "";

	const flush = () => {
		if (buffer.length > 0) {
			chunks.push(buffer);
			buffer = "";
		}
	};

	for (const line of lines) {
		const lineWithNewline = buffer.length === 0 ? line : `\n${line}`;
		if (buffer.length + lineWithNewline.length <= limit) {
			buffer += lineWithNewline;
			continue;
		}

		flush();

		if (line.length <= limit) {
			buffer = line;
			continue;
		}

		let remaining = line;
		while (remaining.length > limit) {
			chunks.push(remaining.slice(0, limit));
			remaining = remaining.slice(limit);
		}
		buffer = remaining;
	}

	flush();

	return chunks;
}

export function formatToolResult(
	toolName: string | undefined,
	status: string | undefined,
	toolId: string | undefined,
): string {
	const label = toolName ?? toolId ?? "unknown";
	const normalizedStatus = status ?? "unknown";
	return `**[tool_use]**: \`${label}\` (${normalizedStatus})`;
}
