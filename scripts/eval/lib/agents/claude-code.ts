import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AGENTS, type AgentDriver, type Execution } from './config.ts';
import type { Logger } from '../utils.ts';

function logMessage(message: SDKMessage, logger: Logger) {
  switch (message.type) {
    case 'assistant': {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          logger.log(`💬 ${block.text}`);
        } else if (block.type === 'tool_use') {
          logger.log(`🔧 ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`);
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
              ? block.content.slice(0, 200)
              : Array.isArray(block.content)
                ? block.content
                    .map((b: { type: string; text?: string }) =>
                      'text' in b ? b.text : `[${b.type}]`
                    )
                    .join('')
                    .slice(0, 200)
                : '[no content]';
          logger.log(`📎 tool_result(${block.tool_use_id?.slice(-8)}): ${text}`);
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
      logger.log(`📋 ${message.summary.slice(0, 200)}`);
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

const MAX_TURNS = 50;

export const claudeAgent: AgentDriver = {
  name: 'claude',

  async execute({ prompt, projectPath, variant, resultsDir, logger }): Promise<Execution> {
    const startTime = Date.now();
    const { model } = variant;
    const effort = variant.effort as 'low' | 'medium' | 'high' | 'max';
    const sdkModel = AGENTS.claude.sdkModelIds[model] ?? model;

    let cost: number | undefined;
    let turns = 0;
    let durationApi: number | undefined;
    const messages: unknown[] = [];

    for await (const message of query({
      prompt,
      options: {
        model: sdkModel,
        cwd: projectPath,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        maxTurns: MAX_TURNS,
        effort,
        debug: true,
        systemPrompt: { type: 'preset', preset: 'claude_code' },
      },
    })) {
      logMessage(message, logger);
      messages.push(message);

      if (message.type === 'result' && message.subtype === 'success') {
        cost = message.total_cost_usd as number | undefined;
        turns = (message.num_turns as number) ?? 0;
        durationApi =
          typeof message.duration_api_ms === 'number' ? message.duration_api_ms / 1000 : undefined;
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    await writeFile(join(resultsDir, 'transcript.json'), JSON.stringify(messages, null, 2));

    return {
      cost,
      duration,
      durationApi,
      turns,
    };
  },
};
