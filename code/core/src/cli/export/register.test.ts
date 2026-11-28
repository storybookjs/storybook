import { afterEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { registerExportCommand, storybookBaseURL } from './register.ts';
import { runExport } from './run.ts';

vi.mock('./run.ts', () => ({ runExport: vi.fn() }));

const parse = async (args: string[]) => {
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  const command = program
    .command('export')
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} });
  registerExportCommand(command);
  return program.parseAsync(['export', ...args], { from: 'user' });
};

afterEach(() => {
  process.exitCode = undefined;
});

describe('export command', () => {
  it('passes normalized options and an abort signal to the exporter', async () => {
    await parse([
      '--format',
      'claude-design',
      '--url',
      'http://localhost:6006/nested/?path=/story/a',
    ]);
    expect(runExport).toHaveBeenCalledWith(
      {
        format: 'claude-design',
        url: 'http://localhost:6006/nested/',
        outputFile: 'storybook-design.zip',
        width: 1280,
        height: 800,
        timeout: 30000,
      },
      expect.any(AbortSignal)
    );
  });

  it.each(
    [
      [],
      ['--url', 'http://localhost:6006'],
      ['--format', 'unknown', '--url', 'http://localhost:6006'],
      ['--format', 'claude-design', '--url', 'file:///storybook'],
      ['--format', 'claude-design', '--url', 'http://localhost', '--width', '0'],
      ['--format', 'claude-design', '--url', 'http://localhost', '--height', '1.5'],
      ['--format', 'claude-design', '--url', 'http://localhost', '--timeout', '-1'],
    ].map((args) => ({ args }))
  )('rejects invalid arguments before starting a browser: $args', async ({ args }) => {
    await expect(parse(args)).rejects.toThrow();
    expect(runExport).not.toHaveBeenCalled();
  });

  it('shows help without invoking capture', async () => {
    await expect(parse(['--help'])).rejects.toMatchObject({ code: 'commander.helpDisplayed' });
    expect(runExport).not.toHaveBeenCalled();
  });

  it('reports failure and removes its signal handlers', async () => {
    const listeners = process.listenerCount('SIGINT');
    vi.mocked(runExport).mockRejectedValueOnce(new Error('Broken story'));
    await parse(['--format', 'claude-design', '--url', 'http://localhost']);
    expect(process.exitCode).toBe(1);
    expect(process.listenerCount('SIGINT')).toBe(listeners);
  });

  it.each([
    'https://example.com/library/iframe.html?id=a',
    'https://example.com/library/index.html',
    'https://example.com/library',
  ])('resolves a nested Storybook base: %s', (value) => {
    expect(storybookBaseURL(value)).toBe('https://example.com/library/');
  });

  it('rejects embedded credentials', () => {
    expect(() => storybookBaseURL('https://user:password@example.com')).toThrow(/credentials/);
  });
});
