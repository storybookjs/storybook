import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual<typeof import('storybook/internal/common')>(
    'storybook/internal/common'
  );
  return {
    ...actual,
    cache: { set: vi.fn(), get: vi.fn(), remove: vi.fn() },
  };
});

vi.mock('storybook/internal/telemetry', () => ({
  telemetry: vi.fn(),
  getSessionId: vi.fn().mockResolvedValue('session-xyz'),
  snapshotPreviewFile: vi
    .fn()
    .mockResolvedValue({ previewPath: '/proj/.storybook/preview.ts', previewHash: 'abc' }),
  isTelemetryModuleEnabled: vi.fn(() => true),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../create-storybook/src/services/ProjectTypeService.ts', () => ({
  ProjectTypeService: class {
    async detectLanguage() {
      return 'ts';
    }
  },
}));

vi.mock('../automigrate/helpers/mainConfigFile.ts', () => ({
  getStorybookData: vi.fn().mockResolvedValue({
    versionInstalled: '10.4.0',
    frameworkPackage: '@storybook/react-vite',
    rendererPackage: '@storybook/react',
    renderer: 'react',
    builderPackage: '@storybook/builder-vite',
    addons: [],
    configDir: '/proj/.storybook',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
    packageManager: {},
  }),
}));

import { cache } from 'storybook/internal/common';
import { snapshotPreviewFile, telemetry } from 'storybook/internal/telemetry';

import { aiSetup } from './index.ts';

beforeEach(() => {
  vi.mocked(cache.set).mockClear();
  vi.mocked(snapshotPreviewFile).mockClear();
  vi.mocked(telemetry).mockClear();
});

describe('aiSetup telemetry gating', () => {
  it('records ai-setup-pending + preview snapshot when telemetry is enabled', async () => {
    await aiSetup({ configDir: '/proj/.storybook', disableTelemetry: false });

    expect(vi.mocked(snapshotPreviewFile)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cache.set)).toHaveBeenCalledWith(
      'ai-setup-pending',
      expect.objectContaining({
        configDir: expect.stringContaining('.storybook'),
        sessionId: 'session-xyz',
        previewPath: '/proj/.storybook/preview.ts',
        previewHash: 'abc',
      })
    );
    expect(vi.mocked(telemetry)).toHaveBeenCalledWith('ai-setup', expect.any(Object));
  });

  it('skips snapshot + cache write when telemetry is disabled', async () => {
    await aiSetup({ configDir: '/proj/.storybook', disableTelemetry: true });

    expect(vi.mocked(snapshotPreviewFile)).not.toHaveBeenCalled();
    expect(vi.mocked(cache.set)).not.toHaveBeenCalled();
  });

  it('treats missing disableTelemetry as enabled (backwards compatible default)', async () => {
    await aiSetup({ configDir: '/proj/.storybook' });

    expect(vi.mocked(snapshotPreviewFile)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cache.set)).toHaveBeenCalledWith('ai-setup-pending', expect.any(Object));
  });
});
