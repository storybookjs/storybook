import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  AGENTS,
  resolveClaudeSdkModel,
  type AgentDriver,
  type AgentExecutionResult,
  type Execution,
} from './config.ts';
import { countLines, trimNonChatOutput } from '../output-preview.ts';
import type { Logger } from '../utils.ts';

export const claudeAgent: AgentDriver = {
  name: 'claude',

  async execute({ prompt, projectPath, variant, logger }): Promise<AgentExecutionResult> {
    if (variant.agent !== 'claude') {
      throw new Error(`Claude driver received unsupported variant: ${variant.agent}`);
    }

    const startTime = Date.now();
    const settings = AGENTS.claude.execution;
    const { model } = variant;
    const effort = variant.effort as 'low' | 'medium' | 'high' | 'max';
    const sdkModel = resolveClaudeSdkModel(model);

    let cost: number | undefined;
    let turns = 0;
    let durationApi: number | undefined;
    const messages: unknown[] = [];

    try {
      for await (const message of query({
        prompt,
        options: {
          model: sdkModel,
          cwd: projectPath,
          env: {
            ...process.env,
            STORYBOOK_DISABLE_TELEMETRY: '1',
          },
          allowedTools: [...settings.allowedTools],
          effort,
          debug: settings.debug,
          systemPrompt: settings.systemPrompt,
        },
      })) {
        logMessage(message, logger);
        messages.push(message);

        if (message.type === 'result') {
          cost = message.total_cost_usd as number | undefined;
          turns = (message.num_turns as number) ?? 0;
          durationApi =
            typeof message.duration_api_ms === 'number'
              ? message.duration_api_ms / 1000
              : undefined;
        }
      }
    } catch (error) {
      logger.logError(
        `Claude execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }

    const execution: Execution = {
      cost,
      duration: (Date.now() - startTime) / 1000,
      durationApi,
      turns,
      terminalResultSubtype: getLastResultSubtype(messages),
    };

    return { execution, transcript: messages };
  },
};

function logMessage(message: SDKMessage, logger: Logger) {
  switch (message.type) {
    case 'assistant': {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          logger.log(`💬 ${block.text}`);
        } else if (block.type === 'tool_use') {
          logger.log(`🔧 ${block.name}(${formatToolInput(block.input)})`);
        }
      }
      if (message.error) {
        logger.logError(`Assistant error: ${message.error}`);
      }
      break;
    }
    case 'user': {
      const content = message.message.content;
      if (!Array.isArray(content)) break;
      for (const block of content) {
        if (block.type === 'tool_result') {
          const text =
            typeof block.content === 'string'
              ? block.content
              : Array.isArray(block.content)
                ? block.content
                    .map((b: { type: string; text?: string }) =>
                      'text' in b ? (b.text ?? '') : `[${b.type}]`
                    )
                    .join('')
                : '[no content]';
          const lines = countLines(text);
          logger.log(
            `📎 tool_result(${block.tool_use_id?.slice(-8)}): ${lines > 0 ? `${lines} lines` : '(empty)'}`
          );
        }
      }
      break;
    }
    case 'result':
      if (message.subtype === 'success') {
        logger.logSuccess(
          `Done — ${message.num_turns} turns, $${message.total_cost_usd?.toFixed(4)}`
        );
      } else {
        logger.logError(`Error (${message.subtype}): ${message.errors?.join(', ')}`);
      }
      break;
    case 'system':
      if (message.subtype === 'init') {
        logger.log(`🚀 Session started — model: ${message.model}`);
      } else if (message.subtype === 'api_retry') {
        logger.log(`🔄 API retry: attempt ${message.attempt}/${message.max_retries}`);
      } else if (message.subtype === 'status') {
        logger.log(`📊 status: ${message.status ?? 'unknown'}`);
      }
      break;
    case 'tool_use_summary':
      logger.log(`📋 ${message.summary}`);
      break;
    case 'rate_limit_event':
      logger.log(
        `⏳ Rate limited — status: ${message.rate_limit_info?.status}, resets at: ${message.rate_limit_info?.resetsAt}`
      );
      break;
    default:
      break;
  }
}

function formatToolInput(value: unknown) {
  try {
    return trimNonChatOutput(JSON.stringify(value, null, 2));
  } catch {
    return trimNonChatOutput(String(value));
  }
}

function getLastResultSubtype(messages: unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      message.type === 'result' &&
      'subtype' in message &&
      typeof message.subtype === 'string'
    ) {
      return message.subtype;
    }
  }

  return undefined;
}
