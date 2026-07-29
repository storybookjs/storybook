import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCompodoc } from './run-compodoc.ts';

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
});
