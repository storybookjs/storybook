import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { x } from 'tinyexec';

import type { AgentExecutionSummary, AgentName, SupportedModel } from './types';
import { MODEL_CONFIGS } from './models';

type ExecuteAgentOptions = {
  agent: AgentName;
  model: SupportedModel;
  prompt: string;
  repoRoot: string;
  logsDir: string;
};

const VALIDATION_COMMAND_PATTERN =
  /\bstorybook\b|\bbuild-storybook\b|\bvitest\b|\btest-storybook\b|\bdoctor\b/;

function isValidationCommand(command: string) {
  return VALIDATION_COMMAND_PATTERN.test(command);
}

function parseJsonLines<T>(value: string): T[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

async function executeClaudeCode({
  model,
  prompt,
  repoRoot,
  logsDir,
}: ExecuteAgentOptions): Promise<AgentExecutionSummary> {
  const transcriptPath = path.join(logsDir, 'claude-stream.jsonl');
  const stderrPath = path.join(logsDir, 'claude-stderr.log');
  const command = [
    'claude',
    '-p',
    '--verbose',
    '--output-format',
    'stream-json',
    '--permission-mode',
    'bypassPermissions',
    '--model',
    MODEL_CONFIGS[model].cliModel,
    '--add-dir',
    repoRoot,
  ];

  const startedAt = Date.now();
  const result = x(command[0], command.slice(1), {
    nodeOptions: {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  });
  result.process?.stdin?.write(prompt);
  result.process?.stdin?.end();
  const completed = await result;
  const durationMs = Date.now() - startedAt;

  await writeFile(transcriptPath, completed.stdout);
  await writeFile(stderrPath, completed.stderr);

  const events = parseJsonLines<Record<string, unknown>>(completed.stdout);
  let apiDurationMs: number | undefined;
  let turns: number | undefined;
  let costUsd: number | undefined;
  let finalMessage: string | undefined;
  let promptTokens: number | undefined;
  let outputTokens: number | undefined;
  const toolCalls: Array<{ name: string; input?: Record<string, unknown> }> = [];
  const commandExecutions: Array<{ command: string; exitCode?: number }> = [];

  for (const event of events) {
    if (event.type === 'assistant' && typeof event.message === 'object' && event.message) {
      const message = event.message as {
        content?: Array<Record<string, unknown>>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      promptTokens ??= message.usage?.input_tokens;
      outputTokens = (outputTokens ?? 0) + (message.usage?.output_tokens ?? 0);

      for (const item of message.content ?? []) {
        if (item.type === 'text' && typeof item.text === 'string') {
          finalMessage = item.text;
        }
        if (item.type === 'tool_use' && typeof item.name === 'string') {
          const input =
            typeof item.input === 'object' && item.input ? (item.input as Record<string, unknown>) : undefined;
          toolCalls.push({ name: item.name, input });
          if (item.name === 'Bash' && typeof input?.command === 'string') {
            commandExecutions.push({
              command: input.command,
            });
          }
        }
      }
    }

    if (event.type === 'result') {
      const typedEvent = event as {
        duration_api_ms?: number;
        num_turns?: number;
        total_cost_usd?: number;
        result?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      };
      apiDurationMs = typedEvent.duration_api_ms;
      turns = typedEvent.num_turns;
      costUsd = typedEvent.total_cost_usd;
      finalMessage = typeof typedEvent.result === 'string' ? typedEvent.result : finalMessage;
      promptTokens =
        typedEvent.usage?.input_tokens ??
        typedEvent.usage?.cache_creation_input_tokens ??
        typedEvent.usage?.cache_read_input_tokens ??
        promptTokens;
      outputTokens = typedEvent.usage?.output_tokens ?? outputTokens;
    }
  }

  return {
    durationMs,
    apiDurationMs,
    turns,
    costUsd,
    promptTokens,
    outputTokens,
    totalTokens:
      promptTokens !== undefined && outputTokens !== undefined ? promptTokens + outputTokens : undefined,
    finalMessage,
    commandExecutions,
    toolCalls,
    validationCommands: commandExecutions
      .map((entry) => entry.command)
      .filter((commandText) => isValidationCommand(commandText)),
    transcriptPath,
    stderrPath,
  };
}

async function executeCodexCli({
  model,
  prompt,
  repoRoot,
  logsDir,
}: ExecuteAgentOptions): Promise<AgentExecutionSummary> {
  const transcriptPath = path.join(logsDir, 'codex-stream.jsonl');
  const stderrPath = path.join(logsDir, 'codex-stderr.log');
  const command = [
    'codex',
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--dangerously-bypass-approvals-and-sandbox',
    '-C',
    repoRoot,
    '-m',
    MODEL_CONFIGS[model].cliModel,
    '-c',
    'suppress_unstable_features_warning=true',
    '-c',
    `model_reasoning_effort="${MODEL_CONFIGS[model].reasoningEffort}"`,
    '-',
  ];

  const startedAt = Date.now();
  const result = x(command[0], command.slice(1), {
    nodeOptions: {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  });
  result.process?.stdin?.write(prompt);
  result.process?.stdin?.end();
  const completed = await result;
  const durationMs = Date.now() - startedAt;

  await writeFile(transcriptPath, completed.stdout);
  await writeFile(stderrPath, completed.stderr);

  const events = parseJsonLines<Record<string, unknown>>(completed.stdout);
  let finalMessage: string | undefined;
  let turns: number | undefined;
  let promptTokens: number | undefined;
  let outputTokens: number | undefined;
  const toolCalls: Array<{ name: string; input?: Record<string, unknown> }> = [];
  const commandExecutions: Array<{ command: string; exitCode?: number }> = [];

  for (const event of events) {
    if (event.type === 'item.completed' && typeof event.item === 'object' && event.item) {
      const item = event.item as {
        type?: string;
        text?: string;
        command?: string;
        exit_code?: number;
      };

      if (item.type === 'agent_message' && typeof item.text === 'string') {
        finalMessage = item.text;
      }

      if (item.type === 'command_execution' && typeof item.command === 'string') {
        commandExecutions.push({
          command: item.command,
          exitCode: item.exit_code,
        });
        toolCalls.push({
          name: 'command_execution',
          input: {
            command: item.command,
            exitCode: item.exit_code,
          },
        });
      }
    }

    if (event.type === 'turn.completed' && typeof event.usage === 'object' && event.usage) {
      const usage = event.usage as {
        input_tokens?: number;
        output_tokens?: number;
        cached_input_tokens?: number;
      };
      turns = (turns ?? 0) + 1;
      promptTokens =
        (promptTokens ?? 0) + (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0);
      outputTokens = (outputTokens ?? 0) + (usage.output_tokens ?? 0);
    }
  }

  return {
    durationMs,
    turns,
    promptTokens,
    outputTokens,
    totalTokens:
      promptTokens !== undefined && outputTokens !== undefined ? promptTokens + outputTokens : undefined,
    finalMessage,
    commandExecutions,
    toolCalls,
    validationCommands: commandExecutions
      .map((entry) => entry.command)
      .filter((commandText) => isValidationCommand(commandText)),
    transcriptPath,
    stderrPath,
  };
}

export async function executeAgent(options: ExecuteAgentOptions) {
  if (options.agent === 'claude-code') {
    return executeClaudeCode(options);
  }

  return executeCodexCli(options);
}
