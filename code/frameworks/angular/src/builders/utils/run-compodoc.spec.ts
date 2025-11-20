import type { BuilderContext } from '@angular-devkit/architect';
// @ts-expect-error (TODO)
import type { LoggerApi } from '@angular-devkit/core/src/logger';
import { take } from 'rxjs/operators';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCompodoc } from './run-compodoc';

const mockRunScript = vi.fn().mockResolvedValue({ stdout: '' });

vi.mock('storybook/internal/common', () => ({
  JsPackageManagerFactory: {
    getPackageManager: () => ({
      runPackageCommand: mockRunScript,
    }),
  },
}));

const builderContextLoggerMock: LoggerApi = {
  createChild: vi.fn(),
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
};

describe('runCompodoc', () => {
  afterEach(() => {
    mockRunScript.mockClear();
  });

  const builderContextMock = {
    workspaceRoot: 'path/to/project',
    logger: builderContextLoggerMock,
  } as BuilderContext;

  it('should run compodoc with tsconfig from context', async () => {
    runCompodoc(
      {
        compodocArgs: [],
        tsconfig: 'path/to/tsconfig.json',
      },
      builderContextMock
    )
      .pipe(take(1))
      .subscribe();

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-d', 'path/to/project'],
      cwd: 'path/to/project',
    });
  });

  it('should run compodoc with tsconfig from compodocArgs', async () => {
    runCompodoc(
      {
        compodocArgs: ['-p', 'path/to/tsconfig.stories.json'],
        tsconfig: 'path/to/tsconfig.json',
      },
      builderContextMock
    )
      .pipe(take(1))
      .subscribe();

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-d', 'path/to/project', '-p', 'path/to/tsconfig.stories.json'],
      cwd: 'path/to/project',
    });
  });

  it('should run compodoc with default output folder.', async () => {
    runCompodoc(
      {
        compodocArgs: [],
        tsconfig: 'path/to/tsconfig.json',
      },
      builderContextMock
    )
      .pipe(take(1))
      .subscribe();

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-d', 'path/to/project'],
      cwd: 'path/to/project',
    });
  });

  it('should run with custom output folder specified with --output compodocArgs', async () => {
    runCompodoc(
      {
        compodocArgs: ['--output', 'path/to/customFolder'],
        tsconfig: 'path/to/tsconfig.json',
      },
      builderContextMock
    )
      .pipe(take(1))
      .subscribe();

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '--output', 'path/to/customFolder'],
      cwd: 'path/to/project',
    });
  });

  it('should run with custom output folder specified with -d compodocArgs', async () => {
    runCompodoc(
      {
        compodocArgs: ['-d', 'path/to/customFolder'],
        tsconfig: 'path/to/tsconfig.json',
      },
      builderContextMock
    )
      .pipe(take(1))
      .subscribe();

    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', 'path/to/tsconfig.json', '-d', 'path/to/customFolder'],
      cwd: 'path/to/project',
    });
  });
});
