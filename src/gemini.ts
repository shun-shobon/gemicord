import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

import { formatToolResult, formatToolUse } from "./format.ts";

interface GeminiRunOptions {
	prompt: string;
	resumeSessionId?: string;
	cwd: string;
}

interface GeminiRunResult {
	output: string;
	sessionId?: string;
}

interface GeminiStreamEvent {
	type?: string;
	session_id?: string;
	tool_name?: string;
	tool_id?: string;
	parameters?: unknown;
	status?: string;
	output?: unknown;
	role?: string;
	content?: string;
	delta?: boolean;
}

export async function runGemini(
	options: GeminiRunOptions,
): Promise<GeminiRunResult> {
	const args = ["--output-format", "stream-json"];
	if (options.resumeSessionId) {
		args.push("--resume", options.resumeSessionId);
	}

	const child = spawn("gemini", args, {
		cwd: options.cwd,
		stdio: ["pipe", "pipe", "pipe"],
	});

	const toolNamesById = new Map<string, string>();
	let sessionId: string | undefined;
	const outputParts: string[] = [];
	let assistantBuffer = "";
	let stderrBuffer = "";
	const unparsedLines: string[] = [];

	const flushAssistant = () => {
		const trimmed = assistantBuffer.trim();
		if (trimmed) {
			outputParts.push(trimmed);
		}
		assistantBuffer = "";
	};

	const handleEvent = (event: GeminiStreamEvent) => {
		switch (event.type) {
			case "init":
				if (event.session_id) {
					sessionId = event.session_id;
				}
				break;

			case "tool_use": {
				flushAssistant();
				const toolName = event.tool_name ?? "unknown";
				if (event.tool_id && event.tool_name) {
					toolNamesById.set(event.tool_id, event.tool_name);
				}
				outputParts.push(formatToolUse(toolName, event.parameters));
				break;
			}
			case "tool_result": {
				flushAssistant();
				const toolName = event.tool_id
					? toolNamesById.get(event.tool_id)
					: undefined;
				outputParts.push(
					formatToolResult(toolName, event.status, event.output, event.tool_id),
				);
				break;
			}
			case "message":
				if (event.role === "assistant" && event.content) {
					assistantBuffer += event.content;
				}
				break;

			default:
				break;
		}
	};

	const rl = createInterface({
		input: child.stdout,
		crlfDelay: Infinity,
	});

	rl.on("line", (line) => {
		console.log("line", line);
		const trimmed = line.trim();
		if (!trimmed) {
			return;
		}
		try {
			const event = JSON.parse(trimmed) as GeminiStreamEvent;
			handleEvent(event);
		} catch {
			unparsedLines.push(trimmed);
		}
	});

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => {
		stderrBuffer += chunk;
	});

	if (child.stdin) {
		child.stdin.write(options.prompt);
		child.stdin.end();
	}

	const [exitCode] = (await once(child, "close")) as [number | null];
	rl.close();

	flushAssistant();

	if (exitCode !== 0) {
		const detail = stderrBuffer.trim() || unparsedLines.join("\n");
		throw new Error(
			detail || `Gemini CLI exited with code ${exitCode ?? "unknown"}.`,
		);
	}

	const output = outputParts.join("\n\n");
	if (sessionId) {
		return { output, sessionId };
	}
	return { output };
}
