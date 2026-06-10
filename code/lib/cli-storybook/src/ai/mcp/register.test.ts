import { writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { isAiCliFeatureEnabled, registerAiMcpPassthrough } from './register.ts';
import { buildToolCommandsHelp, runAiTool, runAiToolHelp } from './run-tool.ts';

vi.mock('./run-tool.ts', { spy: true });

vi.mock('node:fs/promises', { spy: true });

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

/** Replicate the `ai` command tree from `bin/run.ts`: a `setup` subcommand plus a help action. */
function buildProgram({ withPassthrough }: { withPassthrough: boolean }) {
  const program = new Command();
  program.exitOverride();
  const setupAction = vi.fn();
  const helpAction = vi.fn();

  const aiCommand = program
    .command('ai')
    .description('AI agent helpers for Storybook')
    .option('-o, --output <path>', 'Write the prompt output to a file')
    .exitOverride();
  aiCommand.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  aiCommand.command('setup').action(setupAction);
  aiCommand.action(helpAction);

  if (withPassthrough) {
    registerAiMcpPassthrough(program, aiCommand);
  }

  return { program, aiCommand, setupAction, helpAction };
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

beforeEach(() => {
  vi.mocked(runAiTool).mockResolvedValue({ exitCode: 0, output: 'ok' });
  vi.mocked(runAiToolHelp).mockResolvedValue({ exitCode: 0, output: 'tool help' });
  vi.mocked(buildToolCommandsHelp).mockResolvedValue('Tool commands (from the Storybook):');
  vi.mocked(writeFile).mockResolvedValue(undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runAiTool).mockReset();
  vi.mocked(runAiToolHelp).mockReset();
  vi.mocked(buildToolCommandsHelp).mockReset();
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
    expect(buildToolCommandsHelp).not.toHaveBeenCalled();
  });
});

describe('with the feature flag (passthrough registered)', () => {
  it('forwards `ai <tool>` with pass-through tokens to runAiTool', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'get-documentation', '--id', 'button-docs']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', ['--id', 'button-docs'], {
      cwd: undefined,
      port: undefined,
      json: undefined,
    });
  });

  it('parses --cwd, --port and --json before the tool name as CLI options', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, [
      'ai',
      '--cwd',
      '/x',
      '--port',
      '6006',
      '--json',
      '{"a":1}',
      'get-documentation',
    ]);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', [], {
      cwd: '/x',
      port: '6006',
      json: '{"a":1}',
    });
  });

  it('passes tokens after the tool name through verbatim, even option-like ones', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'tool-x', '--cwd', '/y', '--output', 'z']);
    expect(runAiTool).toHaveBeenCalledWith('tool-x', ['--cwd', '/y', '--output', 'z'], {
      cwd: undefined,
      port: undefined,
      json: undefined,
    });
  });

  it('writes the result to the file given via --output instead of stdout', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({ exitCode: 0, output: 'markdown result' });
    await parse(program, ['ai', '-o', '/out/result.md', 'tool-x']);
    expect(writeFile).toHaveBeenCalledWith('/out/result.md', 'markdown result\n', 'utf-8');
    expect(process.stdout.write).not.toHaveBeenCalledWith('markdown result\n');
  });

  it('writes the result to stdout', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({ exitCode: 0, output: 'markdown result' });
    await parse(program, ['ai', 'tool-x']);
    expect(process.stdout.write).toHaveBeenCalledWith('markdown result\n');
    expect(process.exitCode).toBeUndefined();
  });

  it('sets a non-zero exit code on failure', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    vi.mocked(runAiTool).mockResolvedValue({ exitCode: 1, output: 'repair instructions' });
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
      expect(buildToolCommandsHelp).toHaveBeenCalledWith({ cwd: undefined, port: undefined });
      const output = stdoutText();
      expect(output).toContain('Usage:');
      expect(output).toContain('setup');
      expect(output).toContain('Tool commands (from the Storybook):');
      expect(runAiTool).not.toHaveBeenCalled();
    }
  );

  it('passes --cwd and --port through to the tool commands section', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--cwd', '/x', '--port', '6006', '--help']);
    expect(buildToolCommandsHelp).toHaveBeenCalledWith({ cwd: '/x', port: '6006' });
  });

  it('shows single-tool help for `ai --help <tool>`', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--help', 'get-documentation']);
    expect(runAiToolHelp).toHaveBeenCalledWith('get-documentation', {
      cwd: undefined,
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
      port: undefined,
      json: undefined,
    });
  });
});
