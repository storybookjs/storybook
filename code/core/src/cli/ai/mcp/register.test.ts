import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import os from 'node:os';

import { optionalEnvToBoolean } from 'storybook/internal/common';
import { sendTelemetryError, withTelemetry } from 'storybook/internal/core-server';
import { telemetry } from 'storybook/internal/telemetry';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { isAiCliFeatureEnabled, registerAiMcpPassthrough } from './register.ts';
import { buildStorybookCommandsHelp, runAiTool, runAiToolHelp } from './run-tool.ts';

vi.mock('./run-tool.ts', { spy: true });

vi.mock('node:fs/promises', { spy: true });

vi.mock('storybook/internal/core-server', { spy: true });

vi.mock('storybook/internal/telemetry', { spy: true });

describe('isAiCliFeatureEnabled', () => {
  it.each([
    ['1', true],
    ['true', true],
    ['0', false],
    ['false', false],
    ['', false],
    [undefined, false],
  ])('STORYBOOK_FEATURE_AI_CLI=%j → %j', (value, expected) => {
    expect(isAiCliFeatureEnabled({ STORYBOOK_FEATURE_AI_CLI: value })).toBe(expected);
  });
});

/**
 * Replicate the `ai` command tree from `bin/run.ts`: a `setup` subcommand plus a help action. The
 * `--disable-telemetry` and `--logfile` options mirror the shared options that the `command()`
 * factory in `bin/run.ts` registers on every command, including the env-var default.
 */
function buildProgram({ withPassthrough }: { withPassthrough: boolean }) {
  const program = new Command();
  program.exitOverride();
  const setupAction = vi.fn();
  const helpAction = vi.fn();
  const failures: unknown[] = [];
  const handleCommandFailure = vi.fn((logFilePath: string | boolean | undefined) => {
    void logFilePath;
    return async (error: unknown): Promise<never> => {
      failures.push(error);
      return undefined as never;
    };
  });

  const aiCommand = program
    .command('ai')
    .description('AI agent helpers for Storybook')
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
    )
    .option('--logfile [path]', 'Write all debug logs to the specified file')
    .option('-o, --output <path>', 'Write the prompt output to a file')
    .exitOverride();
  aiCommand.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  aiCommand.command('setup').action(setupAction);
  aiCommand.action(helpAction);

  if (withPassthrough) {
    registerAiMcpPassthrough(program, aiCommand, handleCommandFailure);
  }

  return { program, aiCommand, setupAction, helpAction, handleCommandFailure, failures };
}

function parse(program: Command, argv: string[]) {
  return program.parseAsync(['node', 'storybook', ...argv]);
}

function stdoutText(): string {
  return vi
    .mocked(process.stdout.write)
    .mock.calls.map(([chunk]) => String(chunk))
    .join('');
}

/** The payloads of all `ai-command` events fired through the mocked telemetry module. */
function aiCommandPayloads(): unknown[] {
  return vi
    .mocked(telemetry)
    .mock.calls.filter(([eventType]) => eventType === 'ai-command')
    .map(([, payload]) => payload);
}

beforeEach(() => {
  // The CI/dev shell may have the opt-out set; tests control it explicitly via vi.stubEnv.
  vi.stubEnv('STORYBOOK_DISABLE_TELEMETRY', undefined);
  vi.mocked(runAiTool).mockResolvedValue({
    exitCode: 0,
    output: 'ok',
    outcome: { kind: 'success' },
  });
  vi.mocked(runAiToolHelp).mockResolvedValue({
    exitCode: 0,
    output: 'tool help',
    outcome: { kind: 'help' },
  });
  vi.mocked(buildStorybookCommandsHelp).mockResolvedValue(
    'Storybook commands (from the target Storybook configuration):'
  );
  vi.mocked(writeFile).mockResolvedValue(undefined);
  // Pass-through that mirrors the real contract: run the callback, propagate its rejection.
  vi.mocked(withTelemetry).mockImplementation(async (_eventType, _options, run) => run());
  vi.mocked(telemetry).mockResolvedValue(undefined);
  vi.mocked(sendTelemetryError).mockResolvedValue(undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runAiTool).mockReset();
  vi.mocked(runAiToolHelp).mockReset();
  vi.mocked(buildStorybookCommandsHelp).mockReset();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
});

describe('without the feature flag (no registration)', () => {
  it('keeps `setup` as the only subcommand', () => {
    const { aiCommand } = buildProgram({ withPassthrough: false });
    expect(aiCommand.commands.map((c) => c.name())).toEqual(['setup']);
  });

  it('rejects tool names like today (excess arguments)', async () => {
    const { program } = buildProgram({ withPassthrough: false });
    await expect(parse(program, ['ai', 'list-all-documentation'])).rejects.toMatchObject({
      code: 'commander.excessArguments',
    });
    expect(runAiTool).not.toHaveBeenCalled();
  });

  it('keeps the bare `ai` help action', async () => {
    const { program, helpAction } = buildProgram({ withPassthrough: false });
    await parse(program, ['ai']);
    expect(helpAction).toHaveBeenCalled();
    expect(buildStorybookCommandsHelp).not.toHaveBeenCalled();
  });
});

describe('with the feature flag (passthrough registered)', () => {
  it('forwards `ai <tool>` with pass-through tokens to runAiTool', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'get-documentation', '--id', 'button-docs']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', ['--id', 'button-docs'], {
      cwd: undefined,
      configDir: undefined,
      port: undefined,
      json: undefined,
    });
  });

  it('parses target options before the tool name and leaves later tokens as command args', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, [
      'ai',
      '--cwd',
      '/repo',
      '--config-dir',
      'config/storybook',
      '--port',
      '6007',
      'preview-stories',
      '--storyIds',
      '["button--primary"]',
    ]);
    expect(runAiTool).toHaveBeenCalledWith(
      'preview-stories',
      ['--storyIds', '["button--primary"]'],
      {
        cwd: '/repo',
        configDir: 'config/storybook',
        port: '6007',
        json: undefined,
      }
    );
  });

  it('parses --json before the tool name as the command argument escape hatch', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--json', '{"a":1}', 'get-documentation']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', [], {
      cwd: undefined,
      configDir: undefined,
      port: undefined,
      json: '{"a":1}',
    });
  });

  it('parses -c before the tool name as a config-dir CLI option', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '-c', 'config/storybook', 'get-documentation']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', [], {
      cwd: undefined,
      configDir: 'config/storybook',
      port: undefined,
      json: undefined,
    });
  });

  it('passes tokens after the tool name through verbatim, even option-like ones', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, [
      'ai',
      'tool-x',
      '--cwd',
      '/y',
      '--config-dir',
      'config/storybook',
      '--port',
      '6007',
      '--output',
      'z',
    ]);
    expect(runAiTool).toHaveBeenCalledWith(
      'tool-x',
      ['--cwd', '/y', '--config-dir', 'config/storybook', '--port', '6007', '--output', 'z'],
      {
        cwd: undefined,
        configDir: undefined,
        port: undefined,
        json: undefined,
      }
    );
  });

  it('writes the result to the file given via --output instead of stdout', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({
      exitCode: 0,
      output: 'markdown result',
      outcome: { kind: 'success' },
    });
    await parse(program, ['ai', '-o', '/out/result.md', 'tool-x']);
    const expectedPath = os.platform() === 'win32' ? 'C:\\out\\result.md' : '/out/result.md';
    expect(writeFile).toHaveBeenCalledWith(expectedPath, 'markdown result\n', 'utf-8');
    expect(process.stdout.write).not.toHaveBeenCalledWith('markdown result\n');
  });

  it('writes the result to stdout', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({
      exitCode: 0,
      output: 'markdown result',
      outcome: { kind: 'success' },
    });
    await parse(program, ['ai', 'tool-x']);
    expect(process.stdout.write).toHaveBeenCalledWith('markdown result\n');
    expect(process.exitCode).toBeUndefined();
  });

  it('sets a non-zero exit code on failure', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({
      exitCode: 1,
      output: 'repair instructions',
      outcome: { kind: 'intercept', reason: 'no-instance' },
    });
    await parse(program, ['ai', 'tool-x']);
    expect(process.stdout.write).toHaveBeenCalledWith('repair instructions\n');
    expect(process.exitCode).toBe(1);
  });

  it('still dispatches `ai setup` to the setup subcommand', async () => {
    const { program, setupAction } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'setup']);
    expect(setupAction).toHaveBeenCalled();
    expect(runAiTool).not.toHaveBeenCalled();
  });

  it.each([[['ai']], [['ai', '--help']], [['ai', '-h']]])(
    'shows commander help plus the tool commands section for %j',
    async (argv) => {
      const { program } = buildProgram({ withPassthrough: true });
      await parse(program, argv);
      expect(buildStorybookCommandsHelp).toHaveBeenCalledWith({
        cwd: undefined,
        configDir: undefined,
        port: undefined,
      });
      const output = stdoutText();
      expect(output).toContain('Usage:');
      expect(output).toContain('setup');
      expect(output).toContain('Storybook commands (from the target Storybook configuration):');
      expect(runAiTool).not.toHaveBeenCalled();
    }
  );

  it('passes --cwd and --port through to the tool commands section', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--cwd', '/x', '--port', '6006', '--help']);
    expect(buildStorybookCommandsHelp).toHaveBeenCalledWith({
      cwd: '/x',
      configDir: undefined,
      port: '6006',
    });
  });

  it('passes --config-dir through to the tool commands section', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--config-dir', 'config/storybook', '--help']);
    expect(buildStorybookCommandsHelp).toHaveBeenCalledWith({
      cwd: undefined,
      configDir: 'config/storybook',
      port: undefined,
    });
  });

  it('shows single-tool help for `ai --help <tool>`', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--help', 'get-documentation']);
    expect(runAiToolHelp).toHaveBeenCalledWith('get-documentation', {
      cwd: undefined,
      configDir: undefined,
      port: undefined,
    });
    expect(process.stdout.write).toHaveBeenCalledWith('tool help\n');
    expect(runAiTool).not.toHaveBeenCalled();
  });

  it('passes a --help token after the tool name through to runAiTool', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'get-documentation', '--help']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', ['--help'], {
      cwd: undefined,
      configDir: undefined,
      port: undefined,
      json: undefined,
    });
  });
});

describe('ai-command telemetry', () => {
  it('wraps the command execution in withTelemetry with the opt-out cli options', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'tool-x']);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      {
        cliOptions: {
          disableTelemetry: undefined,
          logfile: undefined,
          configDir: resolve(process.cwd(), '.storybook'),
        },
        // Keeps the no-instance intercept reportable from a cwd without a loadable main config.
        fallbackTelemetryState: true,
      },
      expect.any(Function)
    );
  });

  it('resolves the opt-out configDir from pre-command --cwd', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--cwd', '/target/project', 'tool-x']);
    // The target project's core.disableTelemetry must apply, not the invoking cwd's.
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({
        cliOptions: expect.objectContaining({
          configDir: resolve('/target/project', '.storybook'),
        }),
      }),
      expect.any(Function)
    );
  });

  it('resolves the opt-out configDir from pre-command --config-dir', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, [
      'ai',
      '--cwd',
      '/target/project',
      '--config-dir',
      'config/storybook',
      'tool-x',
    ]);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({
        cliOptions: expect.objectContaining({
          configDir: resolve('/target/project', 'config/storybook'),
        }),
      }),
      expect.any(Function)
    );
  });

  it('does not resolve the opt-out configDir from post-command target-looking flags', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, [
      'ai',
      'tool-x',
      '--cwd',
      '/target/project',
      '--config-dir',
      'config/storybook',
      '--port',
      '6007',
    ]);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({
        cliOptions: expect.objectContaining({
          configDir: resolve(process.cwd(), '.storybook'),
        }),
      }),
      expect.any(Function)
    );
  });

  it('honors pre-command --cwd target opt-out even when the command args are malformed', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    // `--json '{bad'` makes full arg parsing fail (invalid-arguments intercept), but the
    // target project's core.disableTelemetry must still be the one consulted.
    await parse(program, ['ai', '--cwd', '/target/project', 'tool-x', '--json', '{bad']);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({
        cliOptions: expect.objectContaining({
          configDir: resolve('/target/project', '.storybook'),
        }),
      }),
      expect.any(Function)
    );
  });

  it('honors pre-command --config-dir even when the command args are malformed', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, [
      'ai',
      '--cwd',
      '/target/project',
      '--config-dir',
      'config/storybook',
      'tool-x',
      '--json',
      '{bad',
    ]);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({
        cliOptions: expect.objectContaining({
          configDir: resolve('/target/project', 'config/storybook'),
        }),
      }),
      expect.any(Function)
    );
  });

  it('fires ai-command with a success payload and no interceptReason', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'tool-x']);
    expect(telemetry).toHaveBeenCalledWith(
      'ai-command',
      {
        command: 'tool-x',
        success: true,
        duration: expect.any(Number),
      },
      // Metadata is collected from the target project, like the opt-out resolution.
      { configDir: resolve(process.cwd(), '.storybook') }
    );
    expect(aiCommandPayloads()).toHaveLength(1);
    expect(aiCommandPayloads()[0]).not.toHaveProperty('interceptReason');
    expect(sendTelemetryError).not.toHaveBeenCalled();
  });

  it('collects the event metadata from the --cwd target project', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--cwd', '/target/project', 'tool-x']);
    expect(telemetry).toHaveBeenCalledWith('ai-command', expect.anything(), {
      configDir: resolve('/target/project', '.storybook'),
    });
  });

  it.each([
    'no-instance',
    'port-mismatch',
    'addon-missing',
    'mcp-starting',
    'mcp-error',
    'invalid-arguments',
    'unknown-command',
  ] as const)(
    'fires ai-command with interceptReason %s on intercepted invocations',
    async (reason) => {
      const { program } = buildProgram({ withPassthrough: true });
      vi.mocked(runAiTool).mockResolvedValue({
        exitCode: 1,
        output: 'repair instructions',
        outcome: { kind: 'intercept', reason },
      });
      await parse(program, ['ai', 'tool-x']);
      expect(telemetry).toHaveBeenCalledWith(
        'ai-command',
        {
          command: 'tool-x',
          success: false,
          interceptReason: reason,
          duration: expect.any(Number),
        },
        expect.anything()
      );
      expect(sendTelemetryError).not.toHaveBeenCalled();
    }
  );

  it('routes server-reached errors through the standard sanitized error path', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    const error = new Error('connection reset');
    vi.mocked(runAiTool).mockResolvedValue({
      exitCode: 1,
      output: 'Failed to reach the Storybook server',
      outcome: { kind: 'error', error },
    });
    await parse(program, ['ai', 'tool-x']);
    expect(telemetry).toHaveBeenCalledWith(
      'ai-command',
      {
        command: 'tool-x',
        success: false,
        duration: expect.any(Number),
      },
      expect.anything()
    );
    expect(sendTelemetryError).toHaveBeenCalledWith(error, 'ai-command', {
      cliOptions: {
        disableTelemetry: undefined,
        logfile: undefined,
        configDir: resolve(process.cwd(), '.storybook'),
      },
    });
  });

  it('still fires ai-command when writing the --output file fails after the command executed', async () => {
    const { program, failures } = buildProgram({ withPassthrough: true });
    const writeError = new Error('EACCES: permission denied');
    vi.mocked(writeFile).mockRejectedValue(writeError);
    await parse(program, ['ai', '-o', '/readonly/out.md', 'tool-x']);
    expect(telemetry).toHaveBeenCalledWith(
      'ai-command',
      {
        command: 'tool-x',
        success: true,
        duration: expect.any(Number),
      },
      expect.anything()
    );
    expect(failures).toEqual([writeError]);
  });

  it('collapses non-command-shaped names to a placeholder (no paths in payloads)', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({
      exitCode: 1,
      output: 'repair instructions',
      outcome: { kind: 'intercept', reason: 'no-instance' },
    });
    await parse(program, ['ai', './projects/secret-app']);
    expect(telemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({ command: '(invalid)' }),
      expect.anything()
    );
  });

  it.each([[['ai']], [['ai', '--help']], [['ai', '--help', 'tool-x']]])(
    'does not fire ai-command for the help path %j, but still wraps it in withTelemetry',
    async (argv) => {
      const { program } = buildProgram({ withPassthrough: true });
      await parse(program, argv);
      expect(withTelemetry).toHaveBeenCalledWith(
        'ai-command',
        expect.anything(),
        expect.any(Function)
      );
      expect(aiCommandPayloads()).toHaveLength(0);
    }
  );

  it('does not fire ai-command when a --help token after the command name turns the run into a help lookup', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({
      exitCode: 0,
      output: 'tool help',
      outcome: { kind: 'help' },
    });
    await parse(program, ['ai', 'tool-x', '--help']);
    expect(aiCommandPayloads()).toHaveLength(0);
  });

  it('passes --disable-telemetry through to withTelemetry', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--disable-telemetry', 'tool-x']);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({ cliOptions: expect.objectContaining({ disableTelemetry: true }) }),
      expect.any(Function)
    );
  });

  it('defaults --disable-telemetry from STORYBOOK_DISABLE_TELEMETRY (as registered in bin/run.ts)', async () => {
    vi.stubEnv('STORYBOOK_DISABLE_TELEMETRY', 'true');
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'tool-x']);
    expect(withTelemetry).toHaveBeenCalledWith(
      'ai-command',
      expect.objectContaining({ cliOptions: expect.objectContaining({ disableTelemetry: true }) }),
      expect.any(Function)
    );
  });

  it('hands unexpected failures to the command failure handler with the --logfile value', async () => {
    const { program, handleCommandFailure, failures } = buildProgram({ withPassthrough: true });
    const error = new Error('unexpected');
    vi.mocked(runAiTool).mockRejectedValue(error);
    await parse(program, ['ai', '--logfile', 'debug.log', 'tool-x']);
    expect(handleCommandFailure).toHaveBeenCalledWith('debug.log');
    expect(failures).toEqual([error]);
  });
});
