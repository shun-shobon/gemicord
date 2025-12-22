import { spawn } from "node:child_process";

export type GeminiResult = {
	responseText: string;
	sessionId?: string;
	toolLogText?: string;
};

type GeminiRunOptions = {
	prompt: string;
	resumeSessionId?: string;
};

type StreamEvent = Record<string, unknown>;

export async function runGemini(
	options: GeminiRunOptions,
): Promise<GeminiResult> {
	const { prompt, resumeSessionId } = options;

	const args = ["--output-format", "stream-json"];
	if (resumeSessionId) {
		args.push("--resume", resumeSessionId);
	}

	return await new Promise<GeminiResult>((resolve, reject) => {
		const geminiCwd =
			process.env["GEMINI_CLI_CWD"]?.trim() || process.cwd();
		const child = spawn("gemini", args, {
			cwd: geminiCwd,
			stdio: ["pipe", "pipe", "pipe"],
		});
		const events: StreamEvent[] = [];
		const toolEvents: StreamEvent[] = [];
		let sessionId: string | undefined;
		let stdoutBuffer = "";
		let stderrBuffer = "";

		child.on("error", (error) => {
			reject(error);
		});

		child.stdout.on("data", (chunk: Buffer) => {
			stdoutBuffer += chunk.toString("utf8");
			stdoutBuffer = consumeLines(stdoutBuffer, (line) => {
				const parsed = safeParseJson(line);
				if (!parsed) {
					return;
				}
				events.push(parsed);
				if (isToolEvent(parsed)) {
					toolEvents.push(parsed);
				}
				if (!sessionId) {
					const maybeSessionId = extractSessionId(parsed);
					if (maybeSessionId) {
						sessionId = maybeSessionId;
					}
				}
			});
		});

		child.stderr.on("data", (chunk: Buffer) => {
			stderrBuffer += chunk.toString("utf8");
		});

		child.on("close", (code) => {
			stdoutBuffer = consumeLines(stdoutBuffer, (line) => {
				const parsed = safeParseJson(line);
				if (!parsed) {
					return;
				}
				events.push(parsed);
				if (isToolEvent(parsed)) {
					toolEvents.push(parsed);
				}
				if (!sessionId) {
					const maybeSessionId = extractSessionId(parsed);
					if (maybeSessionId) {
						sessionId = maybeSessionId;
					}
				}
			});

			if (code !== 0) {
				reject(
					new Error(
						`Gemini CLI exited with code ${code ?? "unknown"}. stderr length=${stderrBuffer.length}`,
					),
				);
				return;
			}

			const responseText = extractResponseText(events);
			if (!responseText) {
				reject(new Error("Gemini CLI returned no response text."));
				return;
			}

			const toolLogText = formatToolLog(toolEvents);
			resolve({ responseText, sessionId, toolLogText });
		});

		if (child.stdin) {
			child.stdin.write(prompt);
			child.stdin.end();
		}
	});
}

function consumeLines(buffer: string, onLine: (line: string) => void): string {
	const lines = buffer.split(/\r?\n/);
	const remainder = lines.pop() ?? "";
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		onLine(trimmed);
	}
	return remainder;
}

function safeParseJson(line: string): StreamEvent | null {
	try {
		return JSON.parse(line) as StreamEvent;
	} catch {
		return null;
	}
}

function extractSessionId(event: StreamEvent): string | undefined {
	if (event.type === "init" && typeof event.session_id === "string") {
		return event.session_id;
	}
	if (typeof event.session_id === "string") {
		return event.session_id;
	}
	return undefined;
}

function extractResponseText(events: StreamEvent[]): string {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const text = pickResponseText(events[index]);
		if (text) {
			return text;
		}
	}
	return "";
}

function isToolEvent(event: StreamEvent): boolean {
	if (typeof event.type === "string" && event.type.includes("tool")) {
		return true;
	}
	if ("tool" in event || "tool_name" in event || "toolName" in event) {
		return true;
	}
	if ("tool_calls" in event || "toolCalls" in event) {
		return true;
	}
	return false;
}

function formatToolLog(events: StreamEvent[]): string | undefined {
	if (events.length === 0) {
		return undefined;
	}
	return events.map((event) => JSON.stringify(event)).join("\n");
}

function pickResponseText(event: StreamEvent): string | null {
	const response = event.response;
	if (typeof response === "string" && response.trim().length > 0) {
		return response;
	}
	if (
		typeof response === "object" &&
		response !== null &&
		"text" in response &&
		typeof (response as { text?: unknown }).text === "string"
	) {
		const text = (response as { text: string }).text.trim();
		if (text.length > 0) {
			return text;
		}
	}
	if (typeof event.text === "string" && event.text.trim().length > 0) {
		return event.text;
	}
	if (typeof event.content === "string" && event.content.trim().length > 0) {
		return event.content;
	}
	return null;
}
