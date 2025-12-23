import path from "node:path";

import type { Message } from "discord.js";
import { Client } from "discord.js";

import { splitDiscordMessage, stripBotMention } from "./format.ts";
import { runGemini } from "./gemini.ts";
import { SessionStore } from "./session-store.ts";

const sessionStorePath = path.resolve("data", "sessions.json");
const sessionStore = new SessionStore(sessionStorePath);
await sessionStore.load();

const geminiWorkingDirectory =
	process.env["GEMINI_CLI_WORKDIR"] ?? process.cwd();

const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent"],
});

client.on("clientReady", () => {
	console.warn(`Logged in as ${client.user?.tag ?? "unknown"}`);
});

const getResumeSessionId = (message: Message<true>): string | undefined => {
	const referencedMessageId = message.reference?.messageId;
	if (!referencedMessageId) {
		return undefined;
	}
	return sessionStore.findSessionIdByMessageId(referencedMessageId);
};

const getPrompt = (
	message: Message<true>,
	botId: string,
	isMention: boolean,
): string | undefined => {
	const rawPrompt = isMention
		? stripBotMention(message.content, botId)
		: message.content;
	const trimmed = rawPrompt.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const sendGeminiResponse = async (
	message: Message<true>,
	prompt: string,
	resumeSessionId?: string,
): Promise<void> => {
	let typingInterval: NodeJS.Timeout | undefined;
	try {
		await message.channel.sendTyping();
		typingInterval = setInterval(() => {
			void message.channel.sendTyping();
		}, 9000);

		const result = await runGemini({
			prompt,
			cwd: geminiWorkingDirectory,
			...(resumeSessionId ? { resumeSessionId } : {}),
		});
		const output =
			result.output.trim() || "（Gemini CLIの出力がありませんでした）";
		const chunks = splitDiscordMessage(output, 2000);
		let lastMessageId: string | undefined;

		for (const chunk of chunks) {
			const sent = await message.channel.send(chunk);
			lastMessageId = sent.id;
		}

		if (result.sessionId && lastMessageId) {
			await sessionStore.set(result.sessionId, lastMessageId);
		}
	} finally {
		if (typingInterval) {
			clearInterval(typingInterval);
		}
	}
};

const handleMessage = async (message: Message): Promise<void> => {
	if (message.author.bot || !message.inGuild()) {
		return;
	}

	const botId = client.user?.id;
	if (!botId) {
		return;
	}

	const isMention = message.mentions.users.has(botId);
	const resumeSessionId = getResumeSessionId(message);

	if (!isMention && !resumeSessionId) {
		return;
	}

	const prompt = getPrompt(message, botId, isMention);
	if (!prompt) {
		return;
	}

	try {
		await sendGeminiResponse(message, prompt, resumeSessionId);
	} catch (error) {
		const messageText = error instanceof Error ? error.message : String(error);
		await message.channel.send(
			`Gemini CLIの実行に失敗しました: ${messageText}`,
		);
	}
};

client.on("messageCreate", (message) => {
	void handleMessage(message);
});

void client.login(process.env["DISCORD_BOT_TOKEN"]);
