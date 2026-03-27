import { Codex } from "@openai/codex-sdk";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent, Effort, ExecutionResult, SupportedModel } from "../../types.ts";

const CODEX_EFFORT: Record<Effort, string> = {
  low: "low",
  medium: "medium",
  high: "high",
  max: "xhigh",
};

export const codexAgent: Agent = {
  name: "codex",

  async execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { effort?: Effort; verbose?: boolean; resultsDir?: string },
  ): Promise<ExecutionResult> {
    const { effort = "high", resultsDir } = options ?? {};
    const startTime = Date.now();
    const log = (prefix: string, text: string) => process.stderr.write(`${prefix} ${text}\n`);

    const codex = new Codex({
      model,
      config: { model_reasoning_effort: CODEX_EFFORT[effort] },
    });
    const thread = codex.startThread({ workingDirectory: projectPath });
    const { events } = await thread.runStreamed(prompt);

    const items: unknown[] = [];

    for await (const event of events) {
      if (event.type === "item.completed") {
        const item = event.item as Record<string, unknown>;
        items.push(item);

        if (item.type === "message" && Array.isArray(item.content)) {
          for (const block of item.content as Array<Record<string, unknown>>) {
            if (block.type === "output_text" && typeof block.text === "string") {
              log("💬", block.text.slice(0, 300));
            }
          }
        } else if (item.type === "command_execution") {
          const cmd = item.command as string | undefined;
          const exit = item.exit_code as number | undefined;
          log("🔧", `${cmd ?? "?"} → exit ${exit ?? "?"}`);
        }
      } else if (event.type === "turn.completed") {
        const usage = event.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        if (usage) {
          log("📊", `tokens: ${usage.input_tokens ?? 0}in / ${usage.output_tokens ?? 0}out`);
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    log("✅", `Done — ${items.length} items, ${Math.round(duration)}s`);

    if (resultsDir) {
      writeFileSync(join(resultsDir, "transcript.json"), JSON.stringify(items, null, 2));
    }

    return { agent: "codex", model, effort, duration, turns: items.length };
  },
};
