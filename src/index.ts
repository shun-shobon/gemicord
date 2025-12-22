import { Client } from "discord.js";
import { runGemini } from "./gemini.ts";
import { createSessionStore } from "./session-store.ts";

const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent"],
});

const sessionStore = await createSessionStore();
const maxDiscordMessageLength = 2000;

client.on("clientReady", () => {
	console.log(`Logged in as ${client.user?.tag}`);
});

client.on("messageCreate", async (message) => {
	if (message.author.bot || message.webhookId) {
		return;
	}
	if (!message.inGuild()) {
		return;
	}

	const botUser = client.user;
	if (!botUser) {
		return;
	}

	const referencedMessageId = message.reference?.messageId;
	const resumeSessionId = referencedMessageId
		? sessionStore.getSessionIdByMessageId(referencedMessageId)
		: undefined;
	const isMentioned = message.mentions.has(botUser, {
		ignoreEveryone: true,
		ignoreRoles: true,
	});

	if (!resumeSessionId && !isMentioned) {
		if (referencedMessageId) {
			try {
				const referenced = await message.fetchReference();
				if (referenced.author.id === botUser.id) {
					await message.reply(
						"この返信に対応するセッションが見つかりませんでした。Botへのメンションから新規に開始してください。",
					);
				}
			} catch {
				// ignore lookup failures to avoid noisy responses
			}
		}
		return;
	}

	const prompt = stripBotMention(message.content, botUser.id).trim();
	if (!prompt) {
		await message.reply(
			"プロンプトが空です。Botへのメンションに続けて内容を送ってください。",
		);
		return;
	}

	try {
		const result = await runGemini({
			prompt,
			resumeSessionId,
		});
		const sessionIdToStore = result.sessionId ?? resumeSessionId;
		const fullResponse = appendToolLog(result.responseText, result.toolLogText);
		const chunks = splitMessage(fullResponse, maxDiscordMessageLength);
		const sentMessages = [];

		for (const chunk of chunks) {
			const sent = await message.reply(chunk);
			sentMessages.push(sent);
		}

		if (sessionIdToStore) {
			const latestMessage = sentMessages.at(-1);
			if (latestMessage) {
				await sessionStore.setLatestMessageId(
					sessionIdToStore,
					latestMessage.id,
				);
			}
		}
	} catch (error) {
		console.error(
			`Gemini CLI error: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		);
		await message.reply(
			"Gemini CLIの実行に失敗しました。しばらくしてから再度お試しください。",
		);
	}
});

client.login(process.env["DISCORD_BOT_TOKEN"]);

function stripBotMention(content: string, botId: string): string {
	const mentionPattern = new RegExp(`<@!?${botId}>`, "g");
	return content.replace(mentionPattern, " ");
}

function splitMessage(text: string, limit: number): string[] {
	if (text.length <= limit) {
		return [text];
	}

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > limit) {
		let splitIndex = remaining.lastIndexOf("\n", limit);
		if (splitIndex <= 0) {
			splitIndex = limit;
		}
		chunks.push(remaining.slice(0, splitIndex));
		remaining = remaining.slice(splitIndex).trimStart();
	}

	if (remaining.length > 0) {
		chunks.push(remaining);
	}

	return chunks;
}

function appendToolLog(responseText: string, toolLogText?: string): string {
	if (!toolLogText) {
		return responseText;
	}
	return `${responseText}\n\n---\nTool Use Log:\n\`\`\`jsonl\n${toolLogText}\n\`\`\``;
}
