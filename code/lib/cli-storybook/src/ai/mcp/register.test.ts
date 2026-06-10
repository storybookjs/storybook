import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { isAiCliFeatureEnabled, registerAiMcpPassthrough } from './register.ts';
import { runAiListTools, runAiTool } from './run-tool.ts';

vi.mock('./run-tool.ts', () => ({
  runAiTool: vi.fn(),
  runAiListTools: vi.fn(),
}));

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

beforeEach(() => {
  vi.mocked(runAiTool).mockResolvedValue({ exitCode: 0, output: 'ok' });
  vi.mocked(runAiListTools).mockResolvedValue({ exitCode: 0, output: 'tools' });
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runAiTool).mockReset();
  vi.mocked(runAiListTools).mockReset();
  process.exitCode = undefined;
});

describe('without the feature flag (no registration)', () => {
  it('does not expose list-tools', async () => {
    const { program, aiCommand } = buildProgram({ withPassthrough: false });
    expect(aiCommand.commands.map((c) => c.name())).toEqual(['setup']);
    await expect(parse(program, ['ai', 'list-tools'])).rejects.toMatchObject({
      code: 'commander.excessArguments',
    });
    expect(runAiListTools).not.toHaveBeenCalled();
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
  });
});

describe('with the feature flag (passthrough registered)', () => {
  it('forwards `ai <tool>` with pass-through tokens to runAiTool', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'get-documentation', '--id', 'button-docs']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', ['--id', 'button-docs'], {
      cwd: undefined,
      json: undefined,
    });
  });

  it('parses --cwd and --json before the tool name as CLI options', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', '--cwd', '/x', '--json', '{"a":1}', 'get-documentation']);
    expect(runAiTool).toHaveBeenCalledWith('get-documentation', [], { cwd: '/x', json: '{"a":1}' });
  });

  it('passes tokens after the tool name through verbatim, even option-like ones', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'tool-x', '--cwd', '/y', '--output', 'z']);
    expect(runAiTool).toHaveBeenCalledWith('tool-x', ['--cwd', '/y', '--output', 'z'], {
      cwd: undefined,
      json: undefined,
    });
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

  it('dispatches `ai list-tools` to runAiListTools with the cwd option', async () => {
    const { program } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'list-tools', '--cwd', '/x']);
    expect(runAiListTools).toHaveBeenCalledWith({ cwd: '/x' });
    expect(runAiTool).not.toHaveBeenCalled();
  });

  it('still dispatches `ai setup` to the setup subcommand', async () => {
    const { program, setupAction } = buildProgram({ withPassthrough: true });
    await parse(program, ['ai', 'setup']);
    expect(setupAction).toHaveBeenCalled();
    expect(runAiTool).not.toHaveBeenCalled();
  });

  it('shows help when `ai` is run without a tool', async () => {
    const { program, aiCommand } = buildProgram({ withPassthrough: true });
    const outputHelp = vi.spyOn(aiCommand, 'outputHelp').mockImplementation(() => '');
    await parse(program, ['ai']);
    expect(outputHelp).toHaveBeenCalled();
    expect(runAiTool).not.toHaveBeenCalled();
  });
});
