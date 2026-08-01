import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

import { getCompodocOutputDir, runCompodoc } from './run-compodoc.ts';

const mockRunScript = vi.fn().mockResolvedValue({ stdout: '' });

vi.mock('storybook/internal/common', () => ({
  JsPackageManagerFactory: {
    getPackageManager: () => ({
      runPackageCommand: mockRunScript,
    }),
  },
}));
vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
    executeTaskWithSpinner: async (fn: any) => {
      await fn();
    },
  },
}));

describe('runCompodoc', () => {
  afterEach(() => {
    mockRunScript.mockClear();
  });

  const workspaceRoot = 'path/to/project';

  it('should run compodoc with tsconfig from context', async () => {
    await runCompodoc({
      compodocArgs: [],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-d', 'path/to/project'],
      cwd: 'path/to/project',
    });
  });

  it('should run compodoc with tsconfig from compodocArgs', async () => {
    await runCompodoc({
      compodocArgs: ['-p', 'path/to/tsconfig.stories.json'],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-d', 'path/to/project', '-p', 'path/to/tsconfig.stories.json'],
      cwd: 'path/to/project',
    });
  });

  it('should run compodoc with default output folder.', async () => {
    await runCompodoc({
      compodocArgs: [],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-d', 'path/to/project'],
      cwd: 'path/to/project',
    });
  });

  it('should run with custom output folder specified with --output compodocArgs', async () => {
    await runCompodoc({
      compodocArgs: ['--output', 'path/to/customFolder'],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '--output', 'path/to/customFolder'],
      cwd: 'path/to/project',
    });
  });

  it('should run with custom output folder specified with -d compodocArgs', async () => {
    await runCompodoc({
      compodocArgs: ['-d', 'path/to/customFolder'],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-d', 'path/to/customFolder'],
      cwd: 'path/to/project',
    });
  });

  it('should not inject a default -d when an attached -d value is present', async () => {
    await runCompodoc({
      compodocArgs: ['-e', 'json', '-ddocs'],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-e', 'json', '-ddocs'],
      cwd: 'path/to/project',
    });
  });

  it('should not inject a default -d when a long --output=value is present', async () => {
    await runCompodoc({
      compodocArgs: ['--output=docs'],
      tsconfig: 'path/to/tsconfig.json',
      workspaceRoot,
    });

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '--output=docs'],
      cwd: 'path/to/project',
    });
  });
});

describe('getCompodocOutputDir', () => {
  // Paths are wrapped in `resolve` so the expectations hold on Windows too.
  const workspaceRoot = '/path/to/project';

  it('defaults to the workspace root when no output flag is present', () => {
    expect(getCompodocOutputDir([], workspaceRoot)).toBe(resolve(workspaceRoot));
    expect(getCompodocOutputDir(['-e', 'json'], workspaceRoot)).toBe(resolve(workspaceRoot));
  });

  it('resolves a relative -d output directory against the workspace root', () => {
    expect(getCompodocOutputDir(['-e', 'json', '-d', 'libs/storybook-host/'], workspaceRoot)).toBe(
      resolve(workspaceRoot, 'libs/storybook-host')
    );
  });

  it('resolves a relative --output directory against the workspace root', () => {
    expect(getCompodocOutputDir(['--output', 'docs'], workspaceRoot)).toBe(
      resolve(workspaceRoot, 'docs')
    );
  });

  it('keeps an absolute -d output directory as-is', () => {
    expect(getCompodocOutputDir(['-d', '/abs/docs'], workspaceRoot)).toBe(resolve('/abs/docs'));
  });

  it('uses the last output flag when several are given', () => {
    expect(getCompodocOutputDir(['-d', 'first', '--output', 'second'], workspaceRoot)).toBe(
      resolve(workspaceRoot, 'second')
    );
  });

  it('falls back to the workspace root for a dangling output flag', () => {
    expect(getCompodocOutputDir(['-d'], workspaceRoot)).toBe(resolve(workspaceRoot));
    expect(getCompodocOutputDir(['--output', '-e'], workspaceRoot)).toBe(resolve(workspaceRoot));
  });

  it('resolves an attached -d value (-ddocs)', () => {
    expect(getCompodocOutputDir(['-ddocs'], workspaceRoot)).toBe(resolve(workspaceRoot, 'docs'));
  });

  it('resolves an inline long --output=value', () => {
    expect(getCompodocOutputDir(['--output=docs'], workspaceRoot)).toBe(
      resolve(workspaceRoot, 'docs')
    );
  });

  it('does not treat an attached long flag (--outputdocs) as an output option', () => {
    // Commander parses `--outputdocs` as an unknown flag, so it must not be
    // mistaken for the output directory.
    expect(getCompodocOutputDir(['--outputdocs'], workspaceRoot)).toBe(resolve(workspaceRoot));
  });
});
