import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import polka from 'polka';

import { Channel } from '@storybook/core/internal/channels';
import type { Storybook } from 'storybook/internal/instance';

import {
  registerInstanceContext,
  runWithStorybook,
} from '@storybook/core/internal/deep/instance/instance-context';
import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
import { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';
import { createUniversalStoreRealm } from '../../../../../core/src/shared/universal-store/realm.ts';
import { ChangeDetectionService } from '@storybook/core/internal/deep/services/change-detection/change-detection-service';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';
import { storybookDevServer } from './dev-server.ts';
import { registerIndexJsonRoute } from './utils/index-json.ts';

vi.mock('polka', () => ({ default: vi.fn() }));
vi.mock('@polka/compression', () => ({ default: vi.fn() }));
vi.mock('@storybook/manager/internal/deep/builder-manager/host', () => ({
  createManagerHost: vi.fn(),
}));
vi.mock('@storybook/core/internal/deep/services/change-detection/change-detection-service', () => ({
  ChangeDetectionService: vi.fn(
    class {
      start = vi.fn();
      dispose = vi.fn().mockResolvedValue(undefined);
    }
  ),
}));
vi.mock('./utils/index-json.ts', () => ({ registerIndexJsonRoute: vi.fn() }));
vi.mock('./utils/middleware.ts', () => ({ getMiddleware: vi.fn().mockResolvedValue(vi.fn()) }));
vi.mock('@storybook/core/internal/deep/common/utils/server-statics', () => ({
  useStatics: vi.fn(),
}));
vi.mock('./utils/metadata.ts', () => ({ useStorybookMetadata: vi.fn() }));
vi.mock('./utils/doTelemetry.ts', () => ({ doTelemetry: vi.fn() }));
vi.mock('../preview-page.ts', () => ({
  getPreviewSources: vi.fn(async () => ({ previewRuntimePath: '/runtime.js' })),
}));
vi.mock('./utils/server-address.ts', () => ({
  addLoopbackListener: vi.fn(),
  getListenHost: vi.fn().mockReturnValue('127.0.0.1'),
}));

const PREVIEW = { dev: vi.fn(), changeDetectionAdapter: vi.fn() };
const MANAGER = { dev: vi.fn(), bail: vi.fn().mockResolvedValue(undefined) };
const BAIL = vi.fn().mockResolvedValue(undefined);
const DISPOSE_INDEX = vi.fn();
const APP = { use: vi.fn(), listen: vi.fn((_options, callback: () => void) => callback()) };
const SIGNALS = new Map<string, () => Promise<void>>();
let storybook: Storybook;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(polka).mockReturnValue(APP as never);
  vi.mocked(createManagerHost).mockReturnValue(MANAGER as never);
  PREVIEW.dev.mockResolvedValue({ bail: BAIL, totalTime: [1, 0] });
  MANAGER.dev.mockResolvedValue(undefined);
  vi.mocked(registerIndexJsonRoute).mockReturnValue(DISPOSE_INDEX);
  const channel = new Channel({});
  storybook = {
    workingDir: '/instance-project',
    options: {
      configDir: '/instance-project/.storybook',
      stories: ['./*.stories.ts'],
      features: {},
      port: 6006,
    },
    builder: PREVIEW,
    channel,
    presets: { apply: vi.fn() },
    callHook: vi.fn().mockResolvedValue({}),
    getStoryIndexGenerator: vi.fn().mockResolvedValue({}),
    close: vi.fn(async () =>
      runWithStorybook(storybook, async () => {
        const cleanups = getInstanceContext()!.cleanups;
        await Promise.all([...cleanups].map((cleanup) => cleanup()));
        cleanups.clear();
      })
    ),
  } as unknown as Storybook;
  registerInstanceContext(storybook, {
    storybook,
    channel,
    workingDir: storybook.workingDir,
    universalStoreRealm: createUniversalStoreRealm({
      channel,
      environment: UniversalStore.Environment.SERVER,
    }),
    state: new Map(),
    cleanups: new Set(),
    getStoryIndexGenerator: storybook.getStoryIndexGenerator,
  });
  vi.spyOn(process, 'on').mockImplementation(((signal: string, handler: () => Promise<void>) => {
    SIGNALS.set(signal, handler);
    return process;
  }) as typeof process.on);
});

afterEach(() => {
  process.exitCode = 0;
  SIGNALS.clear();
  vi.restoreAllMocks();
});

it('starts the instance preview and the host manager inside the owning context', async () => {
  PREVIEW.dev.mockImplementation(async (owner) => {
    expect(getInstanceContext()?.storybook).toBe(owner);
    return { bail: BAIL, totalTime: [1, 0] };
  });
  const server = { once: vi.fn() };
  const result = await storybookDevServer(storybook, server as never);
  expect(PREVIEW.dev).toHaveBeenCalledWith(
    storybook,
    expect.objectContaining({ router: APP, server, preview: { previewRuntimePath: '/runtime.js' } })
  );
  expect(PREVIEW.changeDetectionAdapter).toHaveBeenCalledWith(storybook);
  expect(createManagerHost).toHaveBeenCalledWith(storybook);
  expect(MANAGER.dev).toHaveBeenCalledWith({ router: APP, server, startTime: expect.any(Array) });
  expect(ChangeDetectionService).toHaveBeenCalledWith(
    expect.objectContaining({ workingDir: '/instance-project' })
  );
  expect(storybook.callHook).toHaveBeenCalledWith('server:app:extend', APP);
  expect(result.previewResult.totalTime).toEqual([1, 0]);
  expect(storybook.presets.apply).not.toHaveBeenCalled();
});

it('closes the instance when preview startup rejects', async () => {
  const error = new Error('preview failed');
  PREVIEW.dev.mockRejectedValueOnce(error);
  await expect(storybookDevServer(storybook, { once: vi.fn() } as never)).rejects.toBe(error);
  expect(MANAGER.bail).toHaveBeenCalled();
  expect(storybook.close).toHaveBeenCalled();
});

it('disposes owned builders and watchers when the instance closes without installing signal handlers', async () => {
  await storybookDevServer(storybook, { once: vi.fn() } as never);
  expect(SIGNALS.has('SIGINT')).toBe(false);
  expect(SIGNALS.has('SIGTERM')).toBe(false);
  expect(BAIL).not.toHaveBeenCalled();
  await storybook.close();
  expect(BAIL).toHaveBeenCalledOnce();
  expect(MANAGER.bail).toHaveBeenCalledOnce();
  expect(DISPOSE_INDEX).toHaveBeenCalledOnce();
});

it('disposes the manager and watchers when manager startup rejects', async () => {
  const error = new Error('manager failed');
  MANAGER.dev.mockRejectedValueOnce(error);
  await expect(storybookDevServer(storybook, { once: vi.fn() } as never)).rejects.toBe(error);
  expect(MANAGER.bail).toHaveBeenCalledOnce();
  expect(DISPOSE_INDEX).toHaveBeenCalledOnce();
  expect(PREVIEW.dev).not.toHaveBeenCalled();
});

it('forwards each regenerated index to the index:invalidated:after hook', async () => {
  await storybookDevServer(storybook, { once: vi.fn() } as never);
  const { onRegenerated } = vi.mocked(registerIndexJsonRoute).mock.calls[0][0];
  const index = { v: 5, entries: {} };

  await onRegenerated?.(index);

  expect(storybook.callHook).toHaveBeenCalledWith('index:invalidated:after', index);
});

it('disposes both builders when listening fails', async () => {
  const error = new Error('listen failed');
  APP.listen.mockImplementationOnce(() => {
    throw error;
  });
  await expect(storybookDevServer(storybook, { once: vi.fn() } as never)).rejects.toBe(error);
  expect(BAIL).toHaveBeenCalledOnce();
  expect(MANAGER.bail).toHaveBeenCalledOnce();
  expect(DISPOSE_INDEX).toHaveBeenCalledOnce();
});
