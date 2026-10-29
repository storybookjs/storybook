import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runInTestInstance } from '../../shared/instance-context.test-helpers.ts';
import { ChangeDetectionService } from './change-detection-service.ts';
import changeDetection from './node.ts';
import { getChangeDetectionReadiness, setChangeDetectionReadiness } from './readiness.ts';

vi.mock('./change-detection-service.ts', () => ({
  ChangeDetectionService: vi.fn(
    class {
      start = vi.fn(() => setChangeDetectionReadiness({ status: 'ready' }));
      dispose = vi.fn().mockResolvedValue(undefined);
    }
  ),
}));

type Handlers = Record<string, (...args: unknown[]) => unknown>;

beforeEach(() => {
  vi.mocked(ChangeDetectionService).mockClear();
});

/** Run the addon's setup against a recorder and return the handlers it registered. */
function setUp(mode: 'dev' | 'build' | 'headless', attached = false): Handlers {
  const handlers: Handlers = {};
  changeDetection().setup({
    mode,
    attached,
    workingDir: '/project',
    getStoryIndexGenerator: vi.fn().mockResolvedValue({}),
    hook: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers[name] = handler;
    },
  } as never);
  return handlers;
}

/** The instance of the mocked service the addon created last. */
const lastService = (): { start: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } =>
  vi.mocked(ChangeDetectionService).mock.instances.at(-1) as never;

describe('change-detection addon', () => {
  it.each([
    { name: 'build', mode: 'build', attached: false, expected: [] },
    { name: 'attached headless', mode: 'headless', attached: true, expected: [] },
    {
      name: 'dev',
      mode: 'dev',
      attached: false,
      expected: ['core:instance:ready', 'core:preview-builder:ready', 'core:instance:close'],
    },
    {
      name: 'local headless',
      mode: 'headless',
      attached: false,
      expected: ['core:instance:ready', 'core:preview-builder:ready', 'core:instance:close'],
    },
  ] as const)('registers its hooks in $name mode', ({ mode, attached, expected }) => {
    expect(Object.keys(setUp(mode, attached))).toEqual(expected);
  });

  it('starts in dev only once the preview builder is ready, and disposes on close', () =>
    runInTestInstance(async () => {
      const handlers = setUp('dev');
      await handlers['core:instance:ready']();
      expect(ChangeDetectionService).toHaveBeenCalledWith(
        expect.objectContaining({ workingDir: '/project' })
      );
      expect(lastService().start).not.toHaveBeenCalled();

      await handlers['core:preview-builder:ready']();
      expect(lastService().start).toHaveBeenCalledOnce();

      await handlers['core:instance:close']();
      expect(lastService().dispose).toHaveBeenCalledOnce();
    }));

  it('starts headless on the first readiness request', () =>
    runInTestInstance(async () => {
      const handlers = setUp('headless');
      await handlers['core:instance:ready']();
      expect(ChangeDetectionService).not.toHaveBeenCalled();

      await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });
      expect(ChangeDetectionService).toHaveBeenCalledOnce();
      expect(lastService().start).toHaveBeenCalledOnce();
    }));
});
