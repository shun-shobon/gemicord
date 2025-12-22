import { promises as fs } from "node:fs";
import path from "node:path";

export type SessionStore = {
	getSessionIdByMessageId: (messageId: string) => string | undefined;
	setLatestMessageId: (sessionId: string, messageId: string) => Promise<void>;
};

const defaultSessionMapPath = path.join(process.cwd(), "data", "session-map.json");

export async function createSessionStore(
	filePath: string = defaultSessionMapPath,
): Promise<SessionStore> {
	let sessionToMessageMap: Record<string, string> = {};
	try {
		const raw = await fs.readFile(filePath, "utf8");
		sessionToMessageMap = JSON.parse(raw) as Record<string, string>;
	} catch (error) {
		if (isFileNotFound(error)) {
			sessionToMessageMap = {};
		} else {
			throw error;
		}
	}

	const messageToSessionMap: Record<string, string> = {};
	for (const [sessionId, messageId] of Object.entries(sessionToMessageMap)) {
		messageToSessionMap[messageId] = sessionId;
	}

	let writeQueue = Promise.resolve();

	const persist = async () => {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(
			filePath,
			JSON.stringify(sessionToMessageMap, null, 2),
			"utf8",
		);
	};

	return {
		getSessionIdByMessageId: (messageId) => messageToSessionMap[messageId],
		setLatestMessageId: async (sessionId, messageId) => {
			const previousMessageId = sessionToMessageMap[sessionId];
			if (previousMessageId) {
				delete messageToSessionMap[previousMessageId];
			}
			sessionToMessageMap[sessionId] = messageId;
			messageToSessionMap[messageId] = sessionId;
			writeQueue = writeQueue.then(persist).catch(async () => {
				await persist();
			});
			await writeQueue;
		},
	};
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
	return Boolean(
		typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: string }).code === "ENOENT",
	);
}
