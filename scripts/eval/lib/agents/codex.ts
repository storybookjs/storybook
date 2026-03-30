import { Codex, type ModelReasoningEffort } from '@openai/codex-sdk';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentDriver, Execution } from '../../types.ts';
import { estimateCost } from '../../config.ts';

export const codexAgent: AgentDriver = {
  name: 'codex',

  async execute({ prompt, projectPath, variant, resultsDir, logger }): Promise<Execution> {
    const startTime = Date.now();
    const { model, effort } = variant;

    const codex = new Codex();
    const thread = codex.startThread({
      model,
      modelReasoningEffort: effort as ModelReasoningEffort,
      workingDirectory: projectPath,
      approvalPolicy: 'never',
    });
    const { events } = await thread.runStreamed(prompt);

    const items: unknown[] = [];
    let totalInput = 0;
    let totalCached = 0;
    let totalOutput = 0;
    let turns = 0;

    for await (const event of events) {
      switch (event.type) {
        case 'item.completed': {
          const item = event.item;
          items.push(item);
          switch (item.type) {
            case 'agent_message':
              logger.log(`💬 ${item.text.slice(0, 300)}`);
              break;
            case 'command_execution':
              logger.log(`🔧 $ ${item.command} → exit ${item.exit_code ?? '?'}`);
              if (item.exit_code !== 0 && item.aggregated_output) {
                logger.log(`   ${item.aggregated_output.slice(-200)}`);
              }
              break;
            case 'file_change':
              for (const c of item.changes) logger.log(`📝 ${c.kind} ${c.path}`);
              break;
            case 'reasoning':
              logger.log(`🧠 ${item.text.slice(0, 200)}`);
              break;
            case 'error':
              logger.logError(item.message);
              break;
          }
          break;
        }
        case 'turn.completed':
          totalInput += event.usage.input_tokens;
          totalCached += event.usage.cached_input_tokens;
          totalOutput += event.usage.output_tokens;
          turns++;
          logger.log(
            `📊 tokens: ${event.usage.input_tokens}in / ${event.usage.output_tokens}out (${event.usage.cached_input_tokens} cached)`
          );
          break;
        case 'turn.failed':
          logger.logError(`Turn failed: ${event.error.message}`);
          break;
        case 'error':
          logger.logError(`Error: ${event.message}`);
          break;
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    const cost = estimateCost('codex', model, {
      inputTokens: totalInput,
      cachedInputTokens: totalCached,
      outputTokens: totalOutput,
    });
    logger.logSuccess(
      `Done — ${turns} turns, ${Math.round(duration)}s, ${totalInput}in/${totalOutput}out tokens${cost != null ? `, $${cost.toFixed(4)}` : ''}`
    );

    await writeFile(join(resultsDir, 'transcript.json'), JSON.stringify(items, null, 2));

    return { cost, duration, turns };
  },
};
