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

    const codex = new Codex();
    const thread = codex.startThread({
      model,
      modelReasoningEffort: CODEX_EFFORT[effort],
      workingDirectory: projectPath,
      approvalPolicy: "never",
    });
    const { events } = await thread.runStreamed(prompt);

    const items: unknown[] = [];
    // Token tracking not yet exposed in result — logged per-turn for visibility

    for await (const event of events) {
      switch (event.type) {
        case "item.completed": {
          const item = event.item;
          items.push(item);
          switch (item.type) {
            case "agent_message":
              log("💬", item.text.slice(0, 300));
              break;
            case "command_execution":
              log("🔧", `$ ${item.command} → exit ${item.exit_code ?? "?"}`);
              if (item.exit_code !== 0 && item.aggregated_output) {
                log("  ", item.aggregated_output.slice(-200));
              }
              break;
            case "file_change":
              for (const c of item.changes) log("📝", `${c.kind} ${c.path}`);
              break;
            case "reasoning":
              log("🧠", item.text.slice(0, 200));
              break;
            case "error":
              log("❌", item.message);
              break;
          }
          break;
        }
        case "turn.completed":
          log("📊", `tokens: ${event.usage.input_tokens}in / ${event.usage.output_tokens}out (${event.usage.cached_input_tokens} cached)`);
          break;
        case "turn.failed":
          log("❌", `Turn failed: ${event.error.message}`);
          break;
        case "error":
          log("❌", `Error: ${event.message}`);
          break;
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
