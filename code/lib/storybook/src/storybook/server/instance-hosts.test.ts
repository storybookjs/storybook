import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fs as memoryFs, vol } from 'memfs';
import { resolve } from 'pathe';

import { Channel } from '@storybook/core/internal/channels';
import * as presets from '../compat/presets.ts';
import type { Storybook } from 'storybook/internal/instance';

import { getFeatures } from '@storybook/core/internal/common';
import { createStorybook } from '../instance.ts';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';
import { buildDevStandalone } from './build-dev.ts';
import { buildStaticStandalone } from './build-static.ts';
import { storybookDevServer } from './dev-server.ts';
import { runStaticBuild } from './run-static-build.ts';
import { startDevServer } from './start-dev-server.ts';
import { attachServerTransport } from './utils/get-server-channel.ts';
import { getServerPort } from './utils/server-address.ts';
import { getServer } from './utils/server-init.ts';
import { writeIndexJson } from './utils/index-json.ts';
import { outputStartupInformation } from './utils/output-startup-information.ts';
import { outputStats } from './utils/output-stats.ts';
import { writeStorybookRuntimeInstanceRecord } from './utils/runtime-instance-registry.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('@storybook/core/internal/common', { spy: true });
vi.mock('../compat/presets.ts', { spy: true });
vi.mock('../instance.ts', () => ({ createStorybook: vi.fn() }));
vi.mock('@storybook/core/internal/deep/instance/instance-context', () => ({
  runWithStorybook: (_storybook: unknown, fn: () => unknown) => fn(),
}));
vi.mock('@storybook/manager/internal/deep/builder-manager/host', () => ({
  createManagerHost: vi.fn(),
}));
vi.mock('./dev-server.ts', () => ({ storybookDevServer: vi.fn() }));
vi.mock('./utils/get-server-channel.ts', () => ({ attachServerTransport: vi.fn() }));
vi.mock('./utils/server-init.ts', () => ({ getServer: vi.fn() }));
vi.mock('./utils/server-address.ts', { spy: true });
vi.mock('./utils/warnOnIncompatibleAddons.ts', () => ({ warnOnIncompatibleAddons: vi.fn() }));
vi.mock('./utils/warnWhenUsingArgTypesRegex.ts', () => ({ warnWhenUsingArgTypesRegex: vi.fn() }));
vi.mock('./utils/host-validation-warning.ts', () => ({ warnOnDisabledHostValidation: vi.fn() }));
vi.mock('./utils/runtime-instance-registry.ts', () => ({
  getMcpMetadataFromMainConfig: vi.fn(),
  getStorybookBaseUrl: (address: string) => address.replace(/\/$/, ''),
  writeStorybookRuntimeInstanceRecord: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./utils/toolset-rpc-host.ts', () => ({ serveToolsetRpc: vi.fn(() => () => {}) }));
vi.mock('./utils/output-startup-information.ts', () => ({ outputStartupInformation: vi.fn() }));
vi.mock('./utils/output-stats.ts', () => ({ outputStats: vi.fn() }));
vi.mock('../preview-page.ts', () => ({
  getPreviewSources: vi.fn(async () => ({ previewRuntimePath: '/runtime.js' })),
}));
vi.mock('./utils/index-json.ts', () => ({ writeIndexJson: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./utils/metadata.ts', () => ({
  extractStorybookMetadata: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./utils/copy-all-static-files.ts', () => ({
  copyAllStaticFilesRelativeToMain: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@storybook/core/internal/deep/shared/open-service/server', () => ({
  getRegisteredServices: vi.fn().mockReturnValue([]),
  writeOpenServiceStaticFiles: vi.fn(),
}));

const PREVIEW = { build: vi.fn(), meta: { name: 'preview-test', kind: 'builder' } };
const MANAGER = { build: vi.fn() };
const TRANSPORT = { close: vi.fn() };
const REGISTRATION = { cleanup: vi.fn().mockResolvedValue(undefined) };
const SERVER = {
  close: vi.fn((callback: (error?: Error) => void) => callback()),
  closeAllConnections: vi.fn(),
};
const GENERATOR = Promise.resolve({ getIndex: vi.fn() });
const STATS = { toJson: vi.fn() };
const PREVIEW_RESULT = { stats: STATS, totalTime: [1, 0], bail: vi.fn() };
const DEV_SERVER = {
  port: 6006,
  address: 'http://localhost:6006/',
  networkAddress: 'http://192.168.0.1:6006/',
  close: vi.fn(),
  managerResult: undefined,
  previewResult: PREVIEW_RESULT,
};
const STATIC_BUILD = { outputDir: resolve('storybook-static'), previewStats: STATS };
const DEV_OPTIONS = {
  configDir: resolve('.storybook'),
  port: 6006,
  localAddress: 'http://localhost:6006/',
  networkAddress: 'http://192.168.0.1:6006/',
};
let storybook: Storybook;

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.spyOn(fs, 'mkdir').mockImplementation(memoryFs.promises.mkdir as typeof fs.mkdir);
  vi.spyOn(fs, 'rm').mockImplementation(memoryFs.promises.rm as typeof fs.rm);
  vi.spyOn(fs, 'cp').mockResolvedValue(undefined);
  vi.stubGlobal('FEATURES', {});
  storybook = {
    configDir: resolve('.storybook'),
    workingDir: resolve('.'),
    options: {
      configDir: resolve('.storybook'),
      configType: 'PRODUCTION',
      outputDir: resolve('storybook-static'),
      main: { stories: [] },
      framework: { meta: { name: '@storybook/react-vite', kind: 'framework' } },
      stories: [],
      features: {},
      staticDirs: [],
    },
    builder: PREVIEW,
    presets: { apply: vi.fn() },
    channel: new Channel({}),
    callHook: vi.fn().mockResolvedValue({}),
    getStoryIndexGenerator: vi.fn().mockReturnValue(GENERATOR),
    ready: vi.fn().mockResolvedValue(undefined),
    dev: vi.fn().mockResolvedValue(DEV_SERVER),
    build: vi.fn().mockResolvedValue(STATIC_BUILD),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Storybook;
  vi.mocked(createStorybook).mockReturnValue(storybook as never);
  vi.mocked(createManagerHost).mockReturnValue(MANAGER as never);
  MANAGER.build.mockResolvedValue(undefined);
  PREVIEW.build.mockResolvedValue(STATS);
  vi.mocked(getServerPort).mockResolvedValue(6006);
  vi.mocked(getServer).mockResolvedValue(SERVER as never);
  vi.mocked(writeStorybookRuntimeInstanceRecord).mockResolvedValue(REGISTRATION as never);
  vi.mocked(attachServerTransport).mockReturnValue(TRANSPORT as never);
  vi.mocked(storybookDevServer).mockResolvedValue({
    previewResult: PREVIEW_RESULT,
    managerResult: undefined,
  } as never);
});

afterEach(() => {
  process.exitCode = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('instance product hosts', () => {
  it('builds through the instance, writes its stats and closes it', async () => {
    await buildStaticStandalone({
      configDir: '.storybook',
      outputDir: 'storybook-static',
      test: true,
      statsJson: true,
    });
    expect(createStorybook).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'build',
        cliOptions: expect.objectContaining({ outputDir: resolve('storybook-static') }),
      })
    );
    expect(storybook.build).toHaveBeenCalledOnce();
    expect(outputStats).toHaveBeenCalledWith(STATIC_BUILD.outputDir, STATS);
    expect(storybook.close).toHaveBeenCalledOnce();
    expect(presets.loadAllPresets).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'the instance fails to get ready', fail: 'ready' as const },
    { name: 'the static build fails', fail: 'build' as const },
  ])('closes the instance and rethrows when $name', async ({ fail }) => {
    const error = new Error(`${fail} failed`);
    vi.mocked(storybook[fail]).mockRejectedValueOnce(error);
    await expect(
      buildStaticStandalone({ configDir: '.storybook', outputDir: 'storybook-static', test: true })
    ).rejects.toBe(error);
    expect(storybook.close).toHaveBeenCalledOnce();
  });

  it('starts the dev server through the instance and preserves startup stats', async () => {
    const host = await buildDevStandalone({
      configDir: '.storybook',
      port: 6006,
      ci: true,
      statsJson: true,
    });
    expect(createStorybook).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'dev',
        cliOptions: expect.objectContaining({ port: 6006, configType: 'DEVELOPMENT' }),
      })
    );
    expect(storybook.dev).toHaveBeenCalledOnce();
    expect(outputStartupInformation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'react-vite', previewTotalTime: [1, 0] })
    );
    expect(outputStats).toHaveBeenCalledWith(expect.any(String), STATS);
    expect(storybook.close).not.toHaveBeenCalled();
    expect(presets.loadAllPresets).not.toHaveBeenCalled();
    expect(host.storybook).toBe(storybook);
    await host.close();
    expect(storybook.close).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'the instance fails to get ready', fail: 'ready' as const },
    { name: 'the dev server fails to start', fail: 'dev' as const },
  ])('closes the instance when $name', async ({ fail }) => {
    const error = new Error(`${fail} failed`);
    vi.mocked(storybook[fail]).mockRejectedValueOnce(error);
    await expect(
      buildDevStandalone({ configDir: '.storybook', port: 6006, ci: true })
    ).rejects.toBe(error);
    expect(storybook.close).toHaveBeenCalledOnce();
  });

  it('closes a smoke-test host and returns its exit status without exiting the process', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Unexpected process exit');
    });
    const host = await buildDevStandalone({
      configDir: '.storybook',
      port: 6006,
      ci: true,
      smokeTest: true,
    });
    expect(host.exitCode).toBe(0);
    expect(exit).not.toHaveBeenCalled();
    expect(storybook.close).toHaveBeenCalledOnce();
  });

  it('uses the requested working directory without leaking features into the process', async () => {
    const features = { docgenServer: false };
    vi.stubGlobal('FEATURES', features);
    const workingDir = resolve('other-project');
    const host = await buildDevStandalone({
      configDir: '.storybook',
      workingDir,
      port: 6006,
      ci: true,
    });
    expect(createStorybook).toHaveBeenCalledWith(
      expect.objectContaining({
        workingDir,
        configDir: resolve(workingDir, '.storybook'),
      })
    );
    expect(getFeatures()).toBe(features);
    await host.close();
  });
});

describe('runStaticBuild', () => {
  it('builds the preview, manager, and index of the instance without closing it', async () => {
    const result = await runStaticBuild(storybook, { outputDir: 'storybook-static' });
    expect(PREVIEW.build).toHaveBeenCalledWith(storybook, {
      startTime: expect.any(Array),
      outDir: resolve('storybook-static'),
      preview: { previewRuntimePath: '/runtime.js' },
    });
    expect(createManagerHost).toHaveBeenCalledWith(storybook);
    expect(MANAGER.build).toHaveBeenCalledWith({ startTime: expect.any(Array) });
    expect(writeIndexJson).toHaveBeenCalledWith(resolve('storybook-static/index.json'), GENERATOR);
    expect(result).toEqual({ outputDir: resolve('storybook-static'), previewStats: STATS });
    expect(storybook.close).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'without an output directory',
      input: { cliOptions: {}, previewError: undefined },
      expected: 'Building Storybook requires cliOptions.outputDir.',
    },
    {
      name: 'when the preview build fails',
      input: { cliOptions: { outputDir: 'storybook-static' }, previewError: 'preview failed' },
      expected: 'preview failed',
    },
  ])('rejects $name', async ({ input: { cliOptions, previewError }, expected }) => {
    if (previewError) {
      PREVIEW.build.mockRejectedValueOnce(new Error(previewError));
    }
    await expect(runStaticBuild(storybook, cliOptions)).rejects.toThrow(expected);
    expect(storybook.close).not.toHaveBeenCalled();
  });
});

describe('startDevServer', () => {
  it('attaches the transport to the instance channel, then starts the server and record', async () => {
    const devServer = await startDevServer(storybook, DEV_OPTIONS);
    expect(attachServerTransport).toHaveBeenCalledWith(
      storybook.channel,
      SERVER,
      expect.objectContaining({ token: expect.any(String) })
    );
    expect(storybook.callHook).toHaveBeenCalledWith('server:channel:ready', storybook.channel);
    expect(storybookDevServer).toHaveBeenCalledWith(storybook, SERVER);
    expect(writeStorybookRuntimeInstanceRecord).toHaveBeenCalledWith(
      expect.objectContaining({ address: DEV_OPTIONS.localAddress, port: 6006 })
    );
    expect({
      port: devServer.port,
      address: devServer.address,
      networkAddress: devServer.networkAddress,
      previewResult: devServer.previewResult === (PREVIEW_RESULT as unknown),
    }).toMatchInlineSnapshot(`
      {
        "address": "http://localhost:6006/",
        "networkAddress": "http://192.168.0.1:6006/",
        "port": 6006,
        "previewResult": true,
      }
    `);
    expect(storybook.close).not.toHaveBeenCalled();
  });

  it('returns an idempotent close that disposes what it owns, but not the instance', async () => {
    const devServer = await startDevServer(storybook, DEV_OPTIONS);
    await Promise.all([devServer.close(), devServer.close()]);
    expect(TRANSPORT.close).toHaveBeenCalledOnce();
    expect(SERVER.close).toHaveBeenCalledOnce();
    expect(SERVER.closeAllConnections).toHaveBeenCalledOnce();
    expect(REGISTRATION.cleanup).toHaveBeenCalledOnce();
    expect(storybook.close).not.toHaveBeenCalled();
  });

  it('closes the transport and HTTP server when startup fails', async () => {
    const error = new Error('dev failed');
    vi.mocked(storybookDevServer).mockRejectedValueOnce(error);
    await expect(startDevServer(storybook, DEV_OPTIONS)).rejects.toBe(error);
    expect(TRANSPORT.close).toHaveBeenCalledOnce();
    expect(SERVER.close).toHaveBeenCalledOnce();
    expect(SERVER.closeAllConnections).toHaveBeenCalledOnce();
    expect(writeStorybookRuntimeInstanceRecord).not.toHaveBeenCalled();
  });

  it('attempts every owned cleanup when one fails', async () => {
    const devServer = await startDevServer(storybook, DEV_OPTIONS);
    REGISTRATION.cleanup.mockRejectedValueOnce(new Error('record cleanup failed'));
    await expect(devServer.close()).rejects.toThrow('Dev server cleanup failed.');
    expect(SERVER.close).toHaveBeenCalledOnce();
    expect(TRANSPORT.close).toHaveBeenCalledOnce();
  });
});
