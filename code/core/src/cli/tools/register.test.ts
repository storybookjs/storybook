import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { optionalEnvToBoolean } from 'storybook/internal/common';
import { telemetry } from 'storybook/internal/telemetry';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { sendTelemetryError, withTelemetry } from '../../core-server/withTelemetry.ts';
import { registerToolsPassthrough } from './register.ts';
import { runToolsCommand } from './run.ts';
import type { ToolsRunResult } from './run.ts';

vi.mock('./run.ts', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('../../core-server/withTelemetry.ts', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

function buildProgram() {
  const program = new Command();
  program.exitOverride();
  const failures: unknown[] = [];
  const handleCommandFailure = vi.fn((logFilePath: string | boolean | undefined) => {
    void logFilePath;
    return async (error: unknown): Promise<never> => {
      failures.push(error);
      return undefined as never;
    };
  });

  const toolsCommand = program
    .command('tools')
    .description('Run the agent tools provided by the target Storybook configuration')
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
    )
    .option('--logfile [path]', 'Write all debug logs to the specified file')
    .exitOverride();
  toolsCommand.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerToolsPassthrough(program, toolsCommand, handleCommandFailure);

  return { program, toolsCommand, handleCommandFailure, failures };
}

function parse(program: Command, argv: string[]) {
  return program.parseAsync(['node', 'storybook', ...argv]);
}

function toolsCommandPayloads(): unknown[] {
  return vi
    .mocked(telemetry)
    .mock.calls.filter(
      ([eventType, payload]) =>
        eventType === 'tools-command' && payload !== undefined && !('event' in payload)
    )
    .map(([, payload]) => payload);
}

function successResult(overrides: Partial<ToolsRunResult> = {}): ToolsRunResult {
  return {
    exitCode: 0,
    output: 'ok',
    outcome: { kind: 'success' },
    requestedMode: 'auto',
    attachMode: 'attached',
    host: 'in-process',
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('STORYBOOK_DISABLE_TELEMETRY', undefined);
  vi.mocked(runToolsCommand).mockResolvedValue(successResult());
  vi.mocked(writeFile).mockResolvedValue(undefined);
  vi.mocked(withTelemetry).mockImplementation(async (_eventType, _options, run) => run());
  vi.mocked(telemetry).mockResolvedValue(undefined);
  vi.mocked(sendTelemetryError).mockResolvedValue(undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runToolsCommand).mockReset();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
});

describe('tools-command telemetry', () => {
  it('fires tools-command with client, modes, and host on success', async () => {
    const { program } = buildProgram();
    await parse(program, ['tools', 'docs', 'list']);

    expect(toolsCommandPayloads()).toEqual([
      {
        command: 'docs list',
        success: true,
        outcome: 'success',
        client: 'cli',
        requestedMode: 'auto',
        resolvedMode: 'attached',
        attachMode: 'attached',
        host: 'in-process',
        duration: expect.any(Number),
      },
    ]);
    expect(sendTelemetryError).not.toHaveBeenCalled();
  });

  it('reports an attach-gate outcome from --attach', async () => {
    const { program } = buildProgram();
    vi.mocked(runToolsCommand).mockResolvedValue(
      successResult({
        exitCode: 1,
        output: 'No running Storybook',
        outcome: { kind: 'attach-gate', reason: 'no-instance' },
        requestedMode: 'attached',
        attachMode: 'attached',
        host: undefined,
      })
    );
    await parse(program, ['tools', '--attach', 'docs', 'list']);

    expect(toolsCommandPayloads()).toEqual([
      expect.objectContaining({
        command: 'docs list',
        success: false,
        outcome: 'attach-gate',
        client: 'cli',
        requestedMode: 'attached',
        attachMode: 'attached',
        attachGate: 'no-instance',
      }),
    ]);
    expect(toolsCommandPayloads()[0]).not.toHaveProperty('resolvedMode');
    expect(toolsCommandPayloads()[0]).not.toHaveProperty('host');
    expect(sendTelemetryError).not.toHaveBeenCalled();
  });

  it('keeps requestedMode auto and attachGate on a successful local fallback', async () => {
    const { program } = buildProgram();
    vi.mocked(runToolsCommand).mockResolvedValue(
      successResult({
        requestedMode: 'auto',
        attachMode: 'local',
        host: 'in-process',
        fallbackReason: 'no-instance',
        fallbackNotice: 'Falling back',
      })
    );
    await parse(program, ['tools', 'docs', 'list']);

    expect(toolsCommandPayloads()).toEqual([
      expect.objectContaining({
        command: 'docs list',
        success: true,
        outcome: 'success',
        client: 'cli',
        requestedMode: 'auto',
        resolvedMode: 'local',
        attachMode: 'local',
        host: 'in-process',
        attachGate: 'no-instance',
      }),
    ]);
  });

  it('fires interceptReason without a resolved host', async () => {
    const { program } = buildProgram();
    vi.mocked(runToolsCommand).mockResolvedValue({
      exitCode: 1,
      output: 'Unknown toolset',
      outcome: { kind: 'intercept', reason: 'unknown-toolset' },
      requestedMode: 'auto',
      attachMode: 'auto',
    });
    await parse(program, ['tools', 'nope', 'list']);

    expect(toolsCommandPayloads()).toEqual([
      expect.objectContaining({
        command: 'nope list',
        success: false,
        outcome: 'intercept',
        interceptReason: 'unknown-toolset',
        client: 'cli',
        requestedMode: 'auto',
        attachMode: 'auto',
      }),
    ]);
    expect(toolsCommandPayloads()[0]).not.toHaveProperty('resolvedMode');
    expect(toolsCommandPayloads()[0]).not.toHaveProperty('host');
  });

  it('routes unexpected errors through the sanitized error path', async () => {
    const { program } = buildProgram();
    const error = new Error('connection reset');
    vi.mocked(runToolsCommand).mockResolvedValue({
      exitCode: 1,
      output: 'Failed',
      outcome: { kind: 'error', error },
      requestedMode: 'attached',
      attachMode: 'attached',
      host: 'in-process',
    });
    await parse(program, ['tools', 'docs', 'list']);

    expect(toolsCommandPayloads()).toEqual([
      expect.objectContaining({
        command: 'docs list',
        success: false,
        outcome: 'error',
        client: 'cli',
      }),
    ]);
    expect(sendTelemetryError).toHaveBeenCalledWith(error, 'tools-command', {
      cliOptions: {
        disableTelemetry: undefined,
        logfile: undefined,
        configDir: resolve(process.cwd(), '.storybook'),
      },
    });
  });

  it('does not fire tools-command for help lookups', async () => {
    const { program } = buildProgram();
    vi.mocked(runToolsCommand).mockResolvedValue({
      exitCode: 0,
      output: 'help',
      outcome: { kind: 'help' },
      requestedMode: 'auto',
      attachMode: 'local',
      host: 'in-process',
    });
    await parse(program, ['tools', '--help']);

    expect(toolsCommandPayloads()).toEqual([]);
    expect(withTelemetry).toHaveBeenCalledWith(
      'tools-command',
      expect.anything(),
      expect.any(Function)
    );
  });

  it('collapses non-command-shaped names to a placeholder', async () => {
    const { program } = buildProgram();
    await parse(program, ['tools', './projects/secret-app', 'list']);

    expect(toolsCommandPayloads()).toEqual([
      expect.objectContaining({ command: '(invalid) list' }),
    ]);
  });

  it('reports combining --attach and --no-attach as an intercept', async () => {
    const { program } = buildProgram();
    await parse(program, ['tools', '--attach', '--no-attach', 'docs', 'list']);

    expect(runToolsCommand).not.toHaveBeenCalled();
    expect(toolsCommandPayloads()).toEqual([
      expect.objectContaining({
        command: 'docs list',
        success: false,
        outcome: 'intercept',
        interceptReason: 'invalid-arguments',
        client: 'cli',
        requestedMode: 'auto',
        attachMode: 'auto',
      }),
    ]);
  });

  it('passes --disable-telemetry through to withTelemetry', async () => {
    const { program } = buildProgram();
    await parse(program, ['tools', '--disable-telemetry', 'docs', 'list']);

    expect(withTelemetry).toHaveBeenCalledWith(
      'tools-command',
      expect.objectContaining({
        cliOptions: expect.objectContaining({ disableTelemetry: true }),
        fallbackTelemetryState: true,
      }),
      expect.any(Function)
    );
  });
});
