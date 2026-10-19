import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import {
  assertReactNativeOnDevicePeers,
  onDevicePackageSpecifier,
  onDevicePeerAllowsCli,
  reactNativeOnDeviceDistTag,
} from './onDevicePackages.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('reactNativeOnDeviceDistTag', () => {
  it.each([
    ['11.0.0-alpha.6', 'next'],
    ['11.0.0-beta.1', 'next'],
    ['11.0.0-rc.1', 'next'],
    ['11.0.0-next.0', 'next'],
    ['11.0.0', 'latest'],
    ['11.1.2', 'latest'],
    ['10.6.2', 'latest'],
  ] as const)('%s uses the %s dist-tag', (cliVersion, tag) => {
    expect(reactNativeOnDeviceDistTag(cliVersion)).toBe(tag);
  });

  it('pins on-device packages to @next for a prerelease CLI and leaves stable installs untagged', () => {
    expect(onDevicePackageSpecifier('@storybook/react-native', '11.0.0-alpha.6')).toBe(
      '@storybook/react-native@next'
    );
    expect(onDevicePackageSpecifier('@storybook/react-native', '11.0.0-beta.1')).toBe(
      '@storybook/react-native@next'
    );
    expect(onDevicePackageSpecifier('@storybook/react-native', '11.0.0-rc.1')).toBe(
      '@storybook/react-native@next'
    );
    expect(onDevicePackageSpecifier('@storybook/react-native', '11.0.0')).toBe(
      '@storybook/react-native'
    );
  });
});

describe('onDevicePeerAllowsCli', () => {
  it('rejects a Storybook 10 peer for a Storybook 11 prerelease', () => {
    expect(onDevicePeerAllowsCli('11.0.0-alpha.6', '^10.5.4')).toBe(false);
  });

  it('rejects a stable or higher prerelease floor that npm would reject', () => {
    expect(onDevicePeerAllowsCli('11.0.0-alpha.6', '^11.0.0')).toBe(false);
    expect(onDevicePeerAllowsCli('11.0.0-alpha.6', '^11.0.0-alpha.7')).toBe(false);
  });

  it('accepts a prerelease range that includes the CLI, and a stable CLI against a stable range', () => {
    expect(onDevicePeerAllowsCli('11.0.0-alpha.6', '>=11.0.0-0')).toBe(true);
    expect(onDevicePeerAllowsCli('11.0.0', '^11.0.0')).toBe(true);
  });
});

describe('assertReactNativeOnDevicePeers', () => {
  const packageManager = {
    getRegistryURL: vi.fn(async () => 'https://registry.npmjs.org'),
    latestVersion: vi.fn(async () => '11.0.0-next.0'),
  } as unknown as JsPackageManager;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('names the package and storybook peer when the resolved release does not allow the CLI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ peerDependencies: { storybook: '^10.5.4' } }),
      }))
    );
    vi.mocked(logger.error).mockImplementation(() => {});

    await expect(assertReactNativeOnDevicePeers(packageManager, '11.0.0-alpha.6')).rejects.toThrow(
      /@storybook\/react-native@11\.0\.0-next\.0 peers storybook@\^10\.5\.4/
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('@storybook/react-native@11.0.0-next.0 peers storybook@^10.5.4')
    );
    expect(packageManager.latestVersion).toHaveBeenCalledWith('@storybook/react-native@next');
  });

  it('allows install when the resolved peer accepts the CLI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ peerDependencies: { storybook: '>=11.0.0-0' } }),
      }))
    );

    await expect(
      assertReactNativeOnDevicePeers(packageManager, '11.0.0-alpha.6')
    ).resolves.toBeUndefined();
  });

  it('skips the peer check when the registry lookup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('self-signed certificate');
      })
    );

    await expect(
      assertReactNativeOnDevicePeers(packageManager, '11.0.0-alpha.6')
    ).resolves.toBeUndefined();
  });
});
