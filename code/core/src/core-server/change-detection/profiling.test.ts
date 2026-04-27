import { describe, expect, it, vi } from 'vitest';

import { _createActiveProfilerForTesting, profiler } from './profiling.ts';

describe('profiling', () => {
  describe('module-level profiler', () => {
    it('is a NoopProfiler by default (env flag unset)', () => {
      // The module-level profiler is constructed from env at import time. In the test
      // environment, STORYBOOK_CHANGE_DETECTION_PROFILE is not set.
      expect(profiler.enabled).toBe(false);
    });

    it('no-op methods do not throw and return null from end calls', () => {
      expect(() => profiler.buildStart()).not.toThrow();
      expect(profiler.buildEnd({ storyCount: 0, reverseIndexSize: 0 })).toBeNull();
      expect(() => profiler.patchStart({ kind: 'change', path: '/foo' })).not.toThrow();
      expect(profiler.patchEnd({ storiesReWalked: 0 })).toBeNull();
      expect(() => profiler.recordParse('.ts')).not.toThrow();
      expect(() => profiler.recordResolve()).not.toThrow();
    });
  });

  describe('ActiveProfiler', () => {
    it('captures build timing, parse counts, and resolver counts', () => {
      const active = _createActiveProfilerForTesting();
      const sink = vi.fn();
      active.setSink(sink);

      active.buildStart();
      active.recordParse('.ts');
      active.recordParse('.ts');
      active.recordParse('.tsx');
      active.recordResolve();
      active.recordResolve();
      const summary = active.buildEnd({ storyCount: 3, reverseIndexSize: 9 });

      expect(summary).not.toBeNull();
      expect(summary).toMatchObject({
        operation: 'build',
        filesParsed: 3,
        specifiersResolved: 2,
        parserDispatch: { '.ts': 2, '.tsx': 1 },
        storyCount: 3,
        reverseIndexSize: 9,
      });
      expect(summary!.ms).toBeGreaterThanOrEqual(0);
      expect(sink).toHaveBeenCalledTimes(1);
      expect(sink).toHaveBeenCalledWith(summary);
    });

    it('captures patch timing and per-extension dispatch', () => {
      const active = _createActiveProfilerForTesting();
      const sink = vi.fn();
      active.setSink(sink);

      active.patchStart({ kind: 'change', path: '/src/Button.tsx' });
      active.recordParse('.tsx');
      active.recordResolve();
      active.recordResolve();
      active.recordResolve();
      const summary = active.patchEnd({ storiesReWalked: 1 });

      expect(summary).not.toBeNull();
      expect(summary).toMatchObject({
        operation: 'patch',
        kind: 'change',
        path: '/src/Button.tsx',
        filesParsed: 1,
        specifiersResolved: 3,
        parserDispatch: { '.tsx': 1 },
        storiesReWalked: 1,
      });
      expect(sink).toHaveBeenCalledTimes(1);
    });

    it('resets counters between operations', () => {
      const active = _createActiveProfilerForTesting();
      const sink = vi.fn();
      active.setSink(sink);

      active.buildStart();
      active.recordParse('.ts');
      active.buildEnd({ storyCount: 1, reverseIndexSize: 1 });

      active.patchStart({ kind: 'change', path: '/a.ts' });
      active.recordParse('.ts');
      const patch = active.patchEnd({ storiesReWalked: 0 });

      expect(patch!.filesParsed).toBe(1);
      expect(patch!.parserDispatch).toEqual({ '.ts': 1 });
    });

    it('buildEnd with no buildStart returns null', () => {
      const active = _createActiveProfilerForTesting();
      expect(active.buildEnd({ storyCount: 0, reverseIndexSize: 0 })).toBeNull();
    });

    it('patchEnd with no patchStart returns null', () => {
      const active = _createActiveProfilerForTesting();
      expect(active.patchEnd({ storiesReWalked: 0 })).toBeNull();
    });

    it('recordParse / recordResolve outside an operation is ignored', () => {
      const active = _createActiveProfilerForTesting();
      active.recordParse('.ts');
      active.recordResolve();
      active.buildStart();
      const summary = active.buildEnd({ storyCount: 0, reverseIndexSize: 0 });
      expect(summary!.filesParsed).toBe(0);
      expect(summary!.specifiersResolved).toBe(0);
    });
  });
});
