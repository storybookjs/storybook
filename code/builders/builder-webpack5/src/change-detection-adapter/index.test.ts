// Tests the webpack implementation of ChangeDetectionAdapter — resolve-config extraction
// and watchRun-based file-change event normalisation.
import { describe, expect, it, vi } from 'vitest';

import webpack from 'webpack';
import type { Configuration } from 'webpack';

import { createWebpackChangeDetectionAdapter } from './index.ts';

interface FakeTapable {
  tap(pluginName: string, fn: (compiler: FakeCompiler) => void): void;
}

interface FakeCompiler {
  hooks: {
    watchRun: FakeTapable;
  };
  modifiedFiles?: ReadonlySet<string>;
  removedFiles?: ReadonlySet<string>;
}

function createCompiler(config: Configuration = {}) {
  return webpack({ mode: 'development', target: 'web', context: '/repo', ...config });
}

function createFakeCompiler(): {
  compiler: FakeCompiler;
  triggerWatchRun: (modifiedFiles?: string[], removedFiles?: string[]) => void;
} {
  let watchRunCallback: ((c: FakeCompiler) => void) | undefined;

  const compiler: FakeCompiler = {
    hooks: {
      watchRun: {
        tap(_pluginName, fn) {
          watchRunCallback = fn;
        },
      },
    },
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
      const adapter = createWebpackChangeDetectionAdapter(
        createCompiler({ context: '/my/project' })
      );
      const config = await adapter.getResolveConfig();
      expect(config.projectRoot).toBe('/my/project');
    });

    it.each([
      {
        name: 'the Storybook preview conditions',
        resolve: { conditionNames: ['storybook', 'stories', 'test', '...'] },
        conditions: [
          'storybook',
          'stories',
          'test',
          'import',
          'module',
          'webpack',
          'development',
          'browser',
        ],
        requireConditions: [
          'storybook',
          'stories',
          'test',
          'require',
          'module',
          'webpack',
          'development',
          'browser',
        ],
      },
      {
        name: 'a top-level list without "..."',
        resolve: { conditionNames: ['custom'] },
        conditions: ['custom'],
        requireConditions: ['custom'],
      },
      {
        name: 'an ESM list without "..."',
        resolve: { byDependency: { esm: { conditionNames: ['esm-only'] } } },
        conditions: ['esm-only'],
        requireConditions: ['require', 'module', 'webpack', 'development', 'browser'],
      },
    ])(
      'returns the conditions webpack matches for an ESM import and a `require()`, given $name',
      async ({ resolve, conditions, requireConditions }) => {
        const adapter = createWebpackChangeDetectionAdapter(createCompiler({ resolve }));
        const config = await adapter.getResolveConfig();
        expect(config.conditions).toEqual(conditions);
        expect(config.requireConditions).toEqual(requireConditions);
      }
    );

    it('normalises object-form alias to Record<string, string>', async () => {
      const compiler = createCompiler({
        resolve: {
          alias: {
            '@': '/repo/src',
            utils: '/repo/utils',
            disabled: false,
            multi: ['/repo/multi-a', '/repo/multi-b'],
          },
        },
      });
      const adapter = createWebpackChangeDetectionAdapter(compiler);
      const config = await adapter.getResolveConfig();
      expect(config.alias).toEqual({
        '@': '/repo/src',
        utils: '/repo/utils',
        multi: '/repo/multi-a',
        // `disabled: false` is skipped
      });
    });

    it('normalises array-form alias to Array<{ find, replacement }>', async () => {
      const compiler = createCompiler({
        resolve: {
          alias: [
            { name: '@', alias: '/repo/src' },
            { name: 'utils', alias: ['/repo/utils-a'] },
            { name: 'gone', alias: false },
          ],
        },
      });
      const adapter = createWebpackChangeDetectionAdapter(compiler);
      const config = await adapter.getResolveConfig();
      expect(config.alias).toEqual([
        { find: '@', replacement: '/repo/src' },
        { find: 'utils', replacement: '/repo/utils-a' },
        // `gone: false` is skipped
      ]);
    });

    it('returns undefined alias when resolve has no alias', async () => {
      const adapter = createWebpackChangeDetectionAdapter(createCompiler());
      const config = await adapter.getResolveConfig();
      expect(config.alias).toBeUndefined();
    });
  });

  describe('onFileChange()', () => {
    it('emits kind:"change" (not "add") for files present in modifiedFiles on the first watchRun', () => {
      // H2 fix: on first watchRun seenFiles is empty, but files already exist on disk.
      // Emitting 'add' would cause IncrementalPatcher to treat them as new, silently ignoring
      // the edit. The firstRun flag ensures they are classified as 'change'.
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']);

      expect(handler).toHaveBeenCalledWith({ kind: 'change', path: '/repo/src/A.tsx' });
    });

    it('emits kind:"add" for files that appear in modifiedFiles for the first time after the first watchRun', () => {
      // H2 fix: after the first watchRun the firstRun flag is cleared. A file that was NOT
      // in the first run and appears in a later run is genuinely new — emit 'add'.
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // first run — A treated as 'change'
      triggerWatchRun(['/repo/src/B.tsx']); // second run — B is genuinely new → 'add'

      expect(handler).toHaveBeenNthCalledWith(1, { kind: 'change', path: '/repo/src/A.tsx' });
      expect(handler).toHaveBeenNthCalledWith(2, { kind: 'add', path: '/repo/src/B.tsx' });
    });

    it('emits kind:"change" for paths seen in a previous watchRun', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // first run → change (firstRun flag)
      triggerWatchRun(['/repo/src/A.tsx']); // second run → change (already seen)

      expect(handler).toHaveBeenNthCalledWith(1, { kind: 'change', path: '/repo/src/A.tsx' });
      expect(handler).toHaveBeenNthCalledWith(2, { kind: 'change', path: '/repo/src/A.tsx' });
    });

    it('emits kind:"unlink" for removedFiles and forgets the path', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // first run → change
      triggerWatchRun([], ['/repo/src/A.tsx']); // unlink

      expect(handler).toHaveBeenNthCalledWith(2, { kind: 'unlink', path: '/repo/src/A.tsx' });
    });

    it('emits kind:"add" again after a path was unlinked and re-added', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/A.tsx']); // first run → change
      triggerWatchRun([], ['/repo/src/A.tsx']); // unlink — seenFiles forgets path
      triggerWatchRun(['/repo/src/A.tsx']); // path is unseen again after unlink → add

      expect(handler).toHaveBeenNthCalledWith(3, { kind: 'add', path: '/repo/src/A.tsx' });
    });

    it('normalises paths via pathe.normalize before forwarding', () => {
      const { compiler, triggerWatchRun } = createFakeCompiler();
      const adapter = createWebpackChangeDetectionAdapter(compiler as any);
      const handler = vi.fn();
      adapter.onFileChange(handler);

      triggerWatchRun(['/repo/src/./A.tsx']);

      expect(handler).toHaveBeenCalledWith({ kind: 'change', path: '/repo/src/A.tsx' });
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
