import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SessionStoreData = Record<string, string>;

export class SessionStore {
	private data: SessionStoreData = {};
	private readonly filePath: string;

	constructor(filePath: string) {
		this.filePath = filePath;
	}

	async load(): Promise<void> {
		try {
			const raw = await readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as unknown;
			this.data =
				parsed && typeof parsed === "object"
					? Object.fromEntries(
							Object.entries(parsed).filter(
								([key, value]) =>
									typeof key === "string" && typeof value === "string",
							),
						)
					: {};
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code?: string }).code === "ENOENT"
			) {
				this.data = {};
				await this.save();
				return;
			}
			this.data = {};
			await this.save();
		}
	}

	async set(sessionId: string, messageId: string): Promise<void> {
		this.data[sessionId] = messageId;
		await this.save();
	}

	findSessionIdByMessageId(messageId: string): string | undefined {
		for (const [sessionId, storedMessageId] of Object.entries(this.data)) {
			if (storedMessageId === messageId) {
				return sessionId;
			}
		}
		return undefined;
	}

	private async save(): Promise<void> {
		await mkdir(path.dirname(this.filePath), { recursive: true });
		await writeFile(
			this.filePath,
			JSON.stringify(this.data, null, 2) + "\n",
			"utf8",
		);
	}
}
