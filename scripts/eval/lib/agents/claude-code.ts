import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent, ExecutionResult, SupportedModel } from "../../types.ts";

function logMessage(message: SDKMessage) {
  const log = (prefix: string, text: string) => process.stderr.write(`${prefix} ${text}\n`);

  switch (message.type) {
    case "assistant": {
      for (const block of message.message.content) {
        if (block.type === "text") {
          log("💬", block.text);
        } else if (block.type === "tool_use") {
          log("🔧", `${block.name}(${JSON.stringify(block.input).slice(0, 200)})`);
        }
      }
      if (message.error) {
        log("❌", `Assistant error: ${message.error}`);
      }
      break;
    }
    case "user": {
      const content = message.message.content;
      if (!Array.isArray(content)) break;
      for (const block of content) {
        if (block.type === "tool_result") {
          const text =
            typeof block.content === "string"
              ? block.content.slice(0, 200)
              : Array.isArray(block.content)
                ? block.content
                    .map((b: { type: string; text?: string }) =>
                      "text" in b ? b.text : `[${b.type}]`,
                    )
                    .join("")
                    .slice(0, 200)
                : "[no content]";
          log("📎", `tool_result(${block.tool_use_id?.slice(-8)}): ${text}`);
        }
      }
      break;
    }
    case "result":
      if (message.subtype === "success") {
        log("✅", `Done — ${message.num_turns} turns, $${message.total_cost_usd?.toFixed(4)}`);
      } else {
        log("❌", `Error (${message.subtype}): ${message.errors?.join(", ")}`);
      }
      break;
    case "system":
      if (message.subtype === "init") {
        log("🚀", `Session started — model: ${message.model}`);
      } else if (message.subtype === "api_retry") {
        log("🔄", `API retry: attempt ${message.attempt}/${message.max_retries}`);
      } else if (message.subtype === "status") {
        log("📊", `status: ${message.status ?? "unknown"}`);
      }
      break;
    case "tool_use_summary":
      log("📋", message.summary.slice(0, 200));
      break;
    case "rate_limit_event":
      log("⏳", `Rate limited — status: ${message.rate_limit_info?.status}, resets at: ${message.rate_limit_info?.resetsAt}`);
      break;
    default:
      break;
  }
}

export const claudeCodeAgent: Agent = {
  name: "claude-code",

  async execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { resultsDir?: string },
  ): Promise<ExecutionResult> {
    const { resultsDir } = options ?? {};
    const startTime = Date.now();

    let cost: number | undefined;
    let turns = 0;
    let durationApi: number | undefined;
    const messages: unknown[] = [];

    for await (const message of query({
      prompt,
      options: {
        model,
        cwd: projectPath,
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        maxTurns: 50,
        debug: true,
        systemPrompt: { type: "preset", preset: "claude_code" },
      },
    })) {
      logMessage(message);
      messages.push(message);

      if (message.type === "result" && message.subtype === "success") {
        cost = message.total_cost_usd as number | undefined;
        turns = (message.num_turns as number) ?? 0;
        durationApi =
          typeof message.duration_api_ms === "number" ? message.duration_api_ms / 1000 : undefined;
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    if (resultsDir) {
      writeFileSync(join(resultsDir, "transcript.json"), JSON.stringify(messages, null, 2));
    }

    return {
      agent: "claude-code",
      model,
      cost,
      duration,
      durationApi,
      turns,
    };
  },
};
