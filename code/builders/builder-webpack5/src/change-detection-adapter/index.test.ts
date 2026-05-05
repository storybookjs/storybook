// Tests the webpack implementation of ChangeDetectionAdapter — resolve-config extraction
// and watchRun-based file-change event normalisation.
import { describe, expect, it, vi } from 'vitest';

import { createWebpackChangeDetectionAdapter } from './index.ts';

interface FakeTapable {
  tap(pluginName: string, fn: (compiler: FakeCompiler) => void): void;
}

interface FakeCompiler {
  context: string;
  options: {
    resolve: {
      alias?: unknown;
      conditionNames?: string[];
    };
  };
  hooks: {
    watchRun: FakeTapable;
  };
  modifiedFiles?: ReadonlySet<string>;
  removedFiles?: ReadonlySet<string>;
}

function createFakeCompiler(overrides: Partial<FakeCompiler> = {}): {
  compiler: FakeCompiler;
  triggerWatchRun: (modifiedFiles?: string[], removedFiles?: string[]) => void;
} {
  let watchRunCallback: ((c: FakeCompiler) => void) | undefined;

  const compiler: FakeCompiler = {
    context: '/repo',
    options: {
      resolve: {},
    },
    hooks: {
      watchRun: {
        tap(_pluginName, fn) {
          watchRunCallback = fn;
        },
      },
    },
    ...overrides,
  };

  function triggerWatchRun(modifiedFiles: string[] = [], removedFiles: string[] = []): void {
    const ctx: FakeCompiler = {
      ...compiler,
      modifiedFiles: new Set(modifiedFiles),
      removedFiles: new Set(removedFiles),
    };
    watchRunCallback?.(ctx);
  }

  return { compiler, triggerWatchRun };
}

describe('createWebpackChangeDetectionAdapter', () => {
  describe('getResolveConfig()', () => {
    it('returns projectRoot from compiler.context', async () => {
      const { compiler } = createFakeCompiler({ context: '/my/project' });
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const config = await adapter.getResolveConfig();
      expect(config.projectRoot).toBe('/my/project');
    });

    it('returns conditions from resolve.conditionNames', async () => {
      const { compiler } = createFakeCompiler({
        options: { resolve: { conditionNames: ['import', 'module'] } },
      });
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const config = await adapter.getResolveConfig();
      expect(config.conditions).toEqual(['import', 'module']);
    });

    it('normalises object-form alias to Record<string, string>', async () => {
      const { compiler } = createFakeCompiler({
        options: {
          resolve: {
            alias: {
              '@': '/repo/src',
              utils: '/repo/utils',
              disabled: false,
              multi: ['/repo/multi-a', '/repo/multi-b'],
            },
          },
        },
      });
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const config = await adapter.getResolveConfig();
      expect(config.alias).toEqual({
        '@': '/repo/src',
        utils: '/repo/utils',
        multi: '/repo/multi-a',
        // `disabled: false` is skipped
      });
    });

    it('normalises array-form alias to Array<{ find, replacement }>', async () => {
      const { compiler } = createFakeCompiler({
        options: {
          resolve: {
            alias: [
              { name: '@', alias: '/repo/src' },
              { name: 'utils', alias: ['/repo/utils-a'] },
              { name: 'gone', alias: false },
            ],
          },
        },
      });
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const config = await adapter.getResolveConfig();
      expect(config.alias).toEqual([
        { find: '@', replacement: '/repo/src' },
        { find: 'utils', replacement: '/repo/utils-a' },
        // `gone: false` is skipped
      ]);
    });

    it('returns undefined alias when resolve has no alias', async () => {
      const { compiler } = createFakeCompiler({ options: { resolve: {} } });
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const config = await adapter.getResolveConfig();
      expect(config.alias).toBeUndefined();
    });
  });

  describe('onFileChange()', () => {
    it('emits kind:"add" for first-seen paths in modifiedFiles', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']);

      expect(handler).toHaveBeenCalledWith({ kind: 'add', path: '/repo/src/A.tsx' });
    });

    it('emits kind:"change" for paths seen in a previous watchRun', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // first time → add
      triggerWatchRun(['/repo/src/A.tsx']); // second time → change

      expect(handler).toHaveBeenNthCalledWith(1, { kind: 'add', path: '/repo/src/A.tsx' });
      expect(handler).toHaveBeenNthCalledWith(2, { kind: 'change', path: '/repo/src/A.tsx' });
    });

    it('emits kind:"unlink" for removedFiles and forgets the path', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // add
      triggerWatchRun([], ['/repo/src/A.tsx']); // unlink

      expect(handler).toHaveBeenNthCalledWith(2, { kind: 'unlink', path: '/repo/src/A.tsx' });
    });

    it('emits kind:"add" again after a path was unlinked and re-added', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // add
      triggerWatchRun([], ['/repo/src/A.tsx']); // unlink
      triggerWatchRun(['/repo/src/A.tsx']); // add again

      expect(handler).toHaveBeenNthCalledWith(3, { kind: 'add', path: '/repo/src/A.tsx' });
    });

    it('normalises paths via pathe.normalize before forwarding', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/./A.tsx']);

      expect(handler).toHaveBeenCalledWith({ kind: 'add', path: '/repo/src/A.tsx' });
    });

    it('does not emit events after the unsubscribe function is called', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      const unsubscribe = adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      triggerWatchRun(['/repo/src/B.tsx']);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits no events when modifiedFiles and removedFiles are empty', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun([], []);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
