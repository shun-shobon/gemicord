import { spawn } from "node:child_process";

export type GeminiResult = {
	eventBlocks: string[];
	sessionId?: string;
};

type GeminiRunOptions = {
	prompt: string;
	resumeSessionId?: string;
};

type StreamEvent = Record<string, unknown>;
type EventBlock =
	| { type: "message"; content: string }
	| {
			type: "tool";
			toolId?: string;
			toolName?: string;
			parameters?: unknown;
			result?: { status?: unknown; output?: unknown };
	  }
	| { type: "event"; eventType: string; payload: StreamEvent };

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

			const eventBlocks = formatEventBlocks(events);
			resolve({ eventBlocks, sessionId });
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

function formatEventBlocks(events: StreamEvent[]): string[] {
	const blocks: EventBlock[] = [];
	let pendingMessage = "";
	const pendingToolUses = new Map<
		string,
		{ toolName?: string; parameters?: unknown }
	>();

	for (const event of events) {
		if (isInitEvent(event) || isResultEvent(event)) {
			continue;
		}
		if (isUserMessageEvent(event)) {
			continue;
		}

		if (isMessageEvent(event)) {
			const content = extractMessageContent(event);
			if (content) {
				const isDelta = event.delta === true;
				if (!isDelta && pendingMessage) {
					blocks.push({ type: "message", content: pendingMessage });
					pendingMessage = content;
				} else {
					pendingMessage += content;
				}
			}
			continue;
		}

		if (pendingMessage) {
			blocks.push({ type: "message", content: pendingMessage });
			pendingMessage = "";
		}

		if (event.type === "tool_use") {
			const toolId = extractToolId(event);
			if (toolId) {
				pendingToolUses.set(toolId, {
					toolName: extractToolName(event),
					parameters: event.parameters,
				});
			} else {
				blocks.push({
					type: "tool",
					toolName: extractToolName(event),
					parameters: event.parameters,
				});
			}
			continue;
		}

		if (event.type === "tool_result") {
			const toolId = extractToolId(event);
			const result = {
				status: event.status,
				output: event.output,
			};
			if (toolId && pendingToolUses.has(toolId)) {
				const pending = pendingToolUses.get(toolId);
				pendingToolUses.delete(toolId);
				blocks.push({
					type: "tool",
					toolId,
					toolName: pending?.toolName ?? extractToolName(event),
					parameters: pending?.parameters,
					result,
				});
			} else {
				blocks.push({
					type: "tool",
					toolId,
					toolName: extractToolName(event),
					result,
				});
			}
			continue;
		}

		blocks.push({
			type: "event",
			eventType: typeof event.type === "string" ? event.type : "event",
			payload: event,
		});
	}

	if (pendingMessage) {
		blocks.push({ type: "message", content: pendingMessage });
	}

	for (const [toolId, pending] of pendingToolUses.entries()) {
		blocks.push({
			type: "tool",
			toolId,
			toolName: pending.toolName,
			parameters: pending.parameters,
		});
	}

	if (blocks.length === 0) {
		return ["（表示するイベントはありません）"];
	}

	return blocks.map(formatBlock);
}

function isInitEvent(event: StreamEvent): boolean {
	return event.type === "init";
}

function isResultEvent(event: StreamEvent): boolean {
	return event.type === "result";
}

function isUserMessageEvent(event: StreamEvent): boolean {
	const type = typeof event.type === "string" ? event.type : undefined;
	if (type !== "message") {
		return false;
	}
	const role = extractRole(event);
	return role === "user";
}

function isMessageEvent(event: StreamEvent): boolean {
	return event.type === "message";
}

function extractRole(event: StreamEvent): string | undefined {
	if (typeof event.role === "string") {
		return event.role;
	}
	if (
		typeof event.message === "object" &&
		event.message !== null &&
		"role" in event.message &&
		typeof (event.message as { role?: unknown }).role === "string"
	) {
		return (event.message as { role: string }).role;
	}
	return undefined;
}

function extractMessageContent(event: StreamEvent): string | undefined {
	if (typeof event.content === "string") {
		return event.content;
	}
	if (
		typeof event.message === "object" &&
		event.message !== null &&
		"content" in event.message &&
		typeof (event.message as { content?: unknown }).content === "string"
	) {
		return (event.message as { content: string }).content;
	}
	return undefined;
}

function extractToolId(event: StreamEvent): string | undefined {
	if (typeof event.tool_id === "string") {
		return event.tool_id;
	}
	if (typeof event.toolId === "string") {
		return event.toolId;
	}
	return undefined;
}

function extractToolName(event: StreamEvent): string | undefined {
	if (typeof event.tool_name === "string") {
		return event.tool_name;
	}
	if (typeof event.toolName === "string") {
		return event.toolName;
	}
	if (
		typeof event.tool === "object" &&
		event.tool !== null &&
		"name" in event.tool &&
		typeof (event.tool as { name?: unknown }).name === "string"
	) {
		return (event.tool as { name: string }).name;
	}
	return undefined;
}

function formatBlock(block: EventBlock): string {
	if (block.type === "message") {
		return block.content;
	}
	if (block.type === "tool") {
		const toolName = block.toolName ?? "unknown_tool";
		const payload = {
			tool: toolName,
			tool_id: block.toolId,
			parameters: block.parameters ?? null,
			result: block.result ?? null,
		};
		return `[tool]\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
	}
	const header = block.eventType ? `[${block.eventType}]` : "[event]";
	return `${header}\n\`\`\`json\n${JSON.stringify(block.payload, null, 2)}\n\`\`\``;
}
