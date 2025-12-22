import { promises as fs } from "node:fs";
import path from "node:path";

export type SessionStore = {
	get: (messageId: string) => string | undefined;
	set: (messageId: string, sessionId: string) => Promise<void>;
};

const defaultSessionMapPath = path.join(process.cwd(), "data", "session-map.json");

export async function createSessionStore(
	filePath: string = defaultSessionMapPath,
): Promise<SessionStore> {
	let sessionMap: Record<string, string> = {};
	try {
		const raw = await fs.readFile(filePath, "utf8");
		sessionMap = JSON.parse(raw) as Record<string, string>;
	} catch (error) {
		if (isFileNotFound(error)) {
			sessionMap = {};
		} else {
			throw error;
		}
	}

	let writeQueue = Promise.resolve();

	const persist = async () => {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(
			filePath,
			JSON.stringify(sessionMap, null, 2),
			"utf8",
		);
	};

	return {
		get: (messageId) => sessionMap[messageId],
		set: async (messageId, sessionId) => {
			sessionMap[messageId] = sessionId;
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
