import { Codex } from "@openai/codex-sdk";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent, Effort, ExecutionResult } from "../../types.ts";

/** Per-million-token pricing for Codex/OpenAI models (USD). */
const OPENAI_PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.4": { input: 2.50, cachedInput: 0.625, output: 10.00 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
): number | undefined {
  const pricing = OPENAI_PRICING[model];
  if (!pricing) return undefined;
  const freshInput = inputTokens - cachedInputTokens;
  return (
    (freshInput / 1_000_000) * pricing.input +
    (cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (outputTokens / 1_000_000) * pricing.output
  );
}

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
    model: string,
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
    let totalInput = 0;
    let totalCached = 0;
    let totalOutput = 0;
    let turns = 0;

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
          totalInput += event.usage.input_tokens;
          totalCached += event.usage.cached_input_tokens;
          totalOutput += event.usage.output_tokens;
          turns++;
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
    const cost = estimateCost(model, totalInput, totalCached, totalOutput);
    log("✅", `Done — ${turns} turns, ${Math.round(duration)}s, ${totalInput}in/${totalOutput}out tokens${cost != null ? `, $${cost.toFixed(4)}` : ""}`);

    if (resultsDir) {
      writeFileSync(join(resultsDir, "transcript.json"), JSON.stringify(items, null, 2));
    }

    return { agent: "codex", model, effort, cost, duration, turns };
  },
};
