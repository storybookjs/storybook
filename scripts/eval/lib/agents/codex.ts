import { Codex } from "@openai/codex-sdk";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent, Effort, ExecutionResult, SupportedModel } from "../../types.ts";

/** Map our unified effort to Codex's model_reasoning_effort values. */
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
          for (const block of item.content) {
            if (typeof block === "object" && block !== null && "text" in block) {
              process.stderr.write(`${(block as { text: string }).text}\n`);
            }
          }
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    if (resultsDir) {
      writeFileSync(join(resultsDir, "transcript.json"), JSON.stringify(items, null, 2));
    }

    return { agent: "codex", model, effort, duration, turns: items.length };
  },
};
