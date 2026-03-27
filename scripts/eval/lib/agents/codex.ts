import { Codex } from '@openai/codex-sdk';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Agent, ExecutionResult, SupportedModel } from '../../types';

export const codexAgent: Agent = {
  name: 'codex',

  async execute(
    prompt: string,
    projectPath: string,
    model: SupportedModel,
    options?: { verbose?: boolean; resultsDir?: string }
  ): Promise<ExecutionResult> {
    const { verbose, resultsDir } = options ?? {};
    const startTime = Date.now();

    const codex = new Codex({ model });
    const thread = codex.startThread({ workingDirectory: projectPath });
    const { events } = await thread.runStreamed(prompt);

    const items: unknown[] = [];

    for await (const event of events) {
      if (verbose && event.type === 'item.completed') {
        const item = event.item as Record<string, unknown>;
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const block of item.content) {
            if (typeof block === 'object' && block !== null && 'text' in block) {
              process.stderr.write(`${(block as { text: string }).text}\n`);
            }
          }
        }
      }

      if (event.type === 'item.completed') {
        items.push(event.item);
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    if (resultsDir) {
      writeFileSync(join(resultsDir, 'transcript.json'), JSON.stringify(items, null, 2));
    }

    return {
      agent: 'codex',
      model,
      duration,
      turns: items.length,
    };
  },
};
