import { Codex, type ModelReasoningEffort } from '@openai/codex-sdk';
import {
  AGENTS,
  estimateCost,
  type AgentDriver,
  type AgentExecutionResult,
  type Execution,
} from './config.ts';
import { countLines } from '../output-preview.ts';

export const codexAgent: AgentDriver = {
  name: 'codex',

  async execute({ prompt, projectPath, variant, logger }): Promise<AgentExecutionResult> {
    if (variant.agent !== 'codex') {
      throw new Error(`Codex driver received unsupported variant: ${variant.agent}`);
    }

    const startTime = Date.now();
    const settings = AGENTS.codex.execution;
    const { model, effort } = variant;

    const codex = new Codex({
      env: {
        ...process.env,
        STORYBOOK_DISABLE_TELEMETRY: '1',
      },
    });
    const thread = codex.startThread({
      model,
      modelReasoningEffort: effort as ModelReasoningEffort,
      workingDirectory: projectPath,
      approvalPolicy: settings.approvalPolicy,
    });

    const items: unknown[] = [];
    let totalInput = 0;
    let totalCached = 0;
    let totalOutput = 0;
    let sdkTurns = 0;
    let agentMessageTurns = 0;

    const { events } = await thread.runStreamed(prompt);
    for await (const event of events) {
      switch (event.type) {
        case 'item.completed': {
          const item = event.item;
          items.push(item);
          switch (item.type) {
            case 'agent_message':
              agentMessageTurns += 1;
              logger.log(`💬 ${item.text}`);
              break;
            case 'command_execution': {
              const lines = countLines(item.aggregated_output);
              logger.log(
                `🔧 $ ${item.command} → exit ${item.exit_code ?? '?'}${lines > 0 ? ` (${lines} lines)` : ''}`
              );
              break;
            }
            case 'file_change':
              for (const c of item.changes) logger.log(`📝 ${c.kind} ${c.path}`);
              break;
            case 'reasoning':
              logger.log(`🧠 ${item.text}`);
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
          sdkTurns += 1;
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

    // Codex often reports a single SDK turn for the whole autonomous run.
    // Counting completed assistant messages gives a more useful "effective turns" metric.
    const turns = agentMessageTurns || sdkTurns;

    const execution: Execution = {
      cost: estimateCost('codex', model, {
        inputTokens: totalInput,
        cachedInputTokens: totalCached,
        outputTokens: totalOutput,
      }),
      duration: (Date.now() - startTime) / 1000,
      turns,
    };
    logger.logSuccess(
      `Done — ${turns} turns, ${Math.round(execution.duration)}s, ${totalInput}in/${totalOutput}out tokens${execution.cost != null ? `, $${execution.cost.toFixed(4)}` : ''}`
    );

    return { execution, transcript: items };
  },
};
