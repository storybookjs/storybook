import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Agent, ExecutionResult, SupportedModel } from "../../types";

export const claudeCodeAgent: Agent = {
  name: "claude-code",

  async execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { verbose?: boolean; resultsDir?: string },
  ): Promise<ExecutionResult> {
    const { verbose, resultsDir } = options ?? {};
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
      console.log(message);
      messages.push(message);

      if ("type" in message && message.type === "assistant") {
        const content = (message as Record<string, unknown>).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            console.log(block.text);
            if (block.type === "text") {
              process.stderr.write(block.text + "\n");
            } else if (block.type === "tool_use") {
              const tool = block as { name?: string; input?: unknown };
              process.stderr.write(`  [tool] ${tool.name}\n`);
            }
          }
        }
      }

      if ("type" in message && message.type === "result") {
        const result = message as Record<string, unknown>;
        if (result.subtype === "success") {
          cost = result.total_cost_usd as number | undefined;
          turns = (result.num_turns as number) ?? 0;
          durationApi =
            typeof result.duration_api_ms === "number" ? result.duration_api_ms / 1000 : undefined;
        }
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
