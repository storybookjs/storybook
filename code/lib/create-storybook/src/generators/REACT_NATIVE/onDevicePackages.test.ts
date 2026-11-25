import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, ReleaseAgeGate } from 'storybook/internal/common';
import { ReactNativeOnDevicePeerMismatchError } from 'storybook/internal/server-errors';

import {
  assertReactNativeOnDevicePeers,
  onDevicePackageSpecifier,
  onDevicePeerAllowsCli,
  reactNativeOnDeviceDistTag,
} from './onDevicePackages.ts';

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
    latestVersion: vi.fn<JsPackageManager['latestVersion']>(),
    getPublishedManifest: vi.fn<JsPackageManager['getPublishedManifest']>(),
    getReleaseAgeGate: vi.fn<JsPackageManager['getReleaseAgeGate']>(),
    getOverrideSources: vi.fn<JsPackageManager['getOverrideSources']>(),
    readLockfile: vi.fn<JsPackageManager['readLockfile']>(),
    getAllDependencies: vi.fn<JsPackageManager['getAllDependencies']>(),
    prefersLatestTag: true,
  };

  const gateOf = (
    minutes: number,
    isExcluded: ReleaseAgeGate['isExcluded'] = () => false
  ): ReleaseAgeGate => ({ strict: true, getMinutes: () => minutes, isExcluded });
  const overriding = (overrides: Record<string, string>) =>
    packageManager.getOverrideSources.mockReturnValue([
      { path: 'package.json', field: 'overrides', overrides },
    ]);

  const manifest = (peerDependencies: Record<string, string>) => ({
    version: '11.0.0-next.0',
    versions: ['11.0.0-next.0'],
    time: {},
    dependencies: {},
    peerDependencies,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    packageManager.latestVersion.mockResolvedValue('11.0.0-next.0');
    packageManager.getReleaseAgeGate.mockResolvedValue(gateOf(0));
    packageManager.getOverrideSources.mockReturnValue([]);
    packageManager.readLockfile.mockReturnValue(null);
    packageManager.getAllDependencies.mockReturnValue({});
    packageManager.prefersLatestTag = true;
  });

  const assertPeers = () =>
    assertReactNativeOnDevicePeers(packageManager as unknown as JsPackageManager, '11.0.0-alpha.6');

  describe('when the resolved release peers Storybook 10', () => {
    beforeEach(() => {
      packageManager.getPublishedManifest.mockResolvedValue(manifest({ storybook: '^10.5.4' }));
    });

    it('throws a categorized error naming the package and storybook peer', async () => {
      const error = await assertPeers().catch((err) => err);

      expect(error).toBeInstanceOf(ReactNativeOnDevicePeerMismatchError);
      expect(error.message).toContain(
        '@storybook/react-native@11.0.0-next.0 peers storybook@^10.5.4'
      );
      expect(packageManager.latestVersion).toHaveBeenCalledWith('@storybook/react-native@next');
      expect(packageManager.getPublishedManifest).toHaveBeenCalledWith(
        '@storybook/react-native',
        '11.0.0-next.0'
      );
    });

    it('asks for a Storybook version those packages allow, without naming an older one', async () => {
      const error = await assertPeers().catch((err) => err);

      expect(error.message).toContain(
        'Run init again with a Storybook version that all of these peers allow.'
      );
    });
  });

  describe('when the resolved release allows the CLI', () => {
    beforeEach(() => {
      packageManager.getPublishedManifest.mockResolvedValue(manifest({ storybook: '>=11.0.0-0' }));
    });

    it('allows install', async () => {
      await expect(assertPeers()).resolves.toBeUndefined();
    });
  });

  describe('when the peer lookup fails', () => {
    beforeEach(() => {
      packageManager.getPublishedManifest.mockResolvedValue(null);
    });

    it('skips the peer check', async () => {
      await expect(assertPeers()).resolves.toBeUndefined();
    });
  });

  describe('when on-device packages pull in other Storybook packages', () => {
    type Packument = {
      'dist-tags': Record<string, string>;
      versions: Record<
        string,
        { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }
      >;
      time: Record<string, string>;
    };
    let registry: Record<string, Packument>;

    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const assertPeersFor = (cliVersion: string, storybookRange?: string) =>
      assertReactNativeOnDevicePeers(
        packageManager as unknown as JsPackageManager,
        cliVersion,
        storybookRange
      );
    const readPackageNames = () =>
      packageManager.getPublishedManifest.mock.calls.map(([packageName]) => packageName);

    beforeEach(() => {
      registry = {
        '@storybook/react-native': {
          'dist-tags': { latest: '10.7.3', next: '11.0.0-next.2' },
          versions: {
            '10.7.3': {
              dependencies: { '@storybook/react': '^10.6.7', ws: '^8.21.1' },
              peerDependencies: { storybook: '^10.5.4' },
            },
            '11.0.0-next.2': {
              dependencies: { '@storybook/react': '^11.0.0-beta.3', ws: '^8.22.2' },
              peerDependencies: { storybook: '^11.0.0-beta.1' },
            },
          },
          time: { '10.7.3': hoursAgo(24 * 20), '11.0.0-next.2': hoursAgo(24 * 9) },
        },
        '@storybook/react': {
          'dist-tags': { latest: '10.6.8', next: '11.0.0-rc.0' },
          versions: {
            '10.6.7': { peerDependencies: { storybook: '^10.6.7' } },
            '10.6.8': {
              dependencies: { '@storybook/react-dom-shim': '10.6.8' },
              peerDependencies: { storybook: '^10.6.8' },
            },
            '11.0.0-beta.3': { peerDependencies: { storybook: '^11.0.0-beta.3' } },
            '11.0.0-beta.4': { peerDependencies: { storybook: '^11.0.0-beta.4' } },
            '11.0.0-beta.5': { peerDependencies: { storybook: '^11.0.0-beta.5' } },
            '11.0.0-rc.0': {
              dependencies: { '@storybook/global': '^5.0.0' },
              peerDependencies: { storybook: '^11.0.0-rc.0' },
            },
          },
          time: {
            '10.6.7': hoursAgo(24 * 40),
            '10.6.8': hoursAgo(24 * 14),
            '11.0.0-beta.3': hoursAgo(24 * 11),
            '11.0.0-beta.4': hoursAgo(30),
            '11.0.0-beta.5': hoursAgo(21),
            '11.0.0-rc.0': hoursAgo(5),
          },
        },
        '@storybook/react-dom-shim': {
          'dist-tags': { latest: '10.6.8' },
          versions: { '10.6.8': { peerDependencies: { storybook: '^10.6.8' } } },
          time: { '10.6.8': hoursAgo(24 * 14) },
        },
        '@storybook/global': {
          'dist-tags': { latest: '5.0.0' },
          versions: { '5.0.0': {} },
          time: { '5.0.0': hoursAgo(24 * 900) },
        },
      };

      packageManager.latestVersion.mockImplementation(async (packageSpec) => {
        const tagIndex = packageSpec.lastIndexOf('@');
        const [packageName, tag] =
          tagIndex > 0
            ? [packageSpec.slice(0, tagIndex), packageSpec.slice(tagIndex + 1)]
            : [packageSpec, 'latest'];
        return registry[packageName]?.['dist-tags'][tag] ?? null;
      });
      packageManager.getPublishedManifest.mockImplementation(async (packageName, version) => {
        const packument = registry[packageName];
        const publishedVersion = version ?? packument?.['dist-tags'].latest;
        const release = packument?.versions[publishedVersion];
        return release
          ? {
              version: publishedVersion,
              versions: Object.keys(packument.versions),
              time: packument.time,
              dependencies: release.dependencies ?? {},
              peerDependencies: release.peerDependencies ?? {},
            }
          : null;
      });
    });

    describe('and the CLI is an older prerelease than the newest @storybook/react', () => {
      it('names the @storybook/react release the install would get and what pulls it in', async () => {
        const error = await assertPeersFor('11.0.0-beta.3').catch((err) => err);

        expect(error).toBeInstanceOf(ReactNativeOnDevicePeerMismatchError);
        expect(error.message).toContain(
          '- @storybook/react-native@11.0.0-next.2 > @storybook/react@11.0.0-rc.0 peers storybook@^11.0.0-rc.0'
        );
        expect(error.message).not.toContain('- @storybook/react-native@11.0.0-next.2 peers');
      });

      it('suggests the release that all of these peers allow', async () => {
        const error = await assertPeersFor('11.0.0-beta.3').catch((err) => err);

        expect(error.message).toContain(
          'Run init again with storybook@11.0.0-rc.0, which all of these packages support.'
        );
      });

      it('only looks up Storybook packages', async () => {
        await assertPeersFor('11.0.0-beta.3').catch(() => {});

        expect(readPackageNames()).not.toContain('ws');
      });
    });

    describe('and the CLI is the newest prerelease', () => {
      it('allows install', async () => {
        await expect(assertPeersFor('11.0.0-rc.0')).resolves.toBeUndefined();
      });
    });

    describe('and a stable CLI is behind the latest @storybook/react patch', () => {
      it('names every Storybook package whose peer rejects the CLI, with its dependency path', async () => {
        const error = await assertPeersFor('10.6.7').catch((err) => err);

        expect(error).toBeInstanceOf(ReactNativeOnDevicePeerMismatchError);
        expect(error.message).toMatchInlineSnapshot(`
          "The React Native Storybook packages would install Storybook packages that do not support Storybook 10.6.7:
          - @storybook/react-native@10.7.3 > @storybook/react@10.6.8 peers storybook@^10.6.8
          - @storybook/react-native@10.7.3 > @storybook/react@10.6.8 > @storybook/react-dom-shim@10.6.8 peers storybook@^10.6.8

          Run init again with storybook@10.6.8, which all of these packages support."
        `);
      });

      it('takes the latest release without another lookup when it satisfies the range', async () => {
        await assertPeersFor('10.6.7').catch(() => {});

        expect(packageManager.getPublishedManifest).not.toHaveBeenCalledWith(
          '@storybook/react',
          '10.6.8'
        );
      });
    });

    describe('and a newer Storybook patch is published without the latest tag', () => {
      beforeEach(() => {
        registry['@storybook/react'].versions['10.6.9'] = {
          peerDependencies: { storybook: '^10.6.9' },
        };
        registry['@storybook/react'].time['10.6.9'] = hoursAgo(48);
        registry.storybook = {
          'dist-tags': { latest: '10.6.8' },
          versions: { '10.6.7': {}, '10.6.8': {}, '10.6.9': {} },
          time: {
            '10.6.7': hoursAgo(24 * 40),
            '10.6.8': hoursAgo(24 * 14),
            '10.6.9': hoursAgo(48),
          },
        };
      });

      it('checks the latest release, which npm, pnpm, Yarn 1 and bun install', async () => {
        await expect(assertPeersFor('10.6.8')).resolves.toBeUndefined();
      });

      describe('on a package manager that ignores the tag, like Yarn Berry', () => {
        beforeEach(() => {
          packageManager.prefersLatestTag = false;
        });

        it('checks the highest release against the storybook that init pins', async () => {
          const error = await assertPeersFor('10.6.7').catch((err) => err);

          expect(error.message).toContain(
            '- @storybook/react-native@10.7.3 > @storybook/react@10.6.9 peers storybook@^10.6.9'
          );
        });

        it('checks it against the newer storybook a latest CLI installs with its caret range', async () => {
          await expect(assertPeersFor('10.6.8', '^10.6.8')).resolves.toBeUndefined();
        });
      });
    });

    describe('and the project lockfile already resolves a nested Storybook package', () => {
      beforeEach(() => {
        packageManager.readLockfile.mockReturnValue(
          '"@storybook/react@npm:^10.6.7":\n  version: 10.6.7\n'
        );
      });

      it('leaves that package to the install, which keeps the saved release', async () => {
        await expect(assertPeersFor('10.6.7')).resolves.toBeUndefined();
        expect(readPackageNames()).not.toContain('@storybook/react');
      });
    });

    describe('and a package that allows the CLI pulls in one that needs a Storybook it rejects', () => {
      beforeEach(() => {
        registry['@storybook/react-native'].versions['10.7.3'].peerDependencies = {
          storybook: '~10.6.7',
        };
        registry['@storybook/react']['dist-tags'].latest = '10.7.0';
        registry['@storybook/react'].versions['10.7.0'] = {
          peerDependencies: { storybook: '^10.7.0' },
        };
        registry['@storybook/react'].time['10.7.0'] = hoursAgo(48);
      });

      it('does not suggest a version that the first package rejects', async () => {
        const error = await assertPeersFor('10.6.7').catch((err) => err);

        expect(error.message).toContain('@storybook/react@10.7.0 peers storybook@^10.7.0');
        expect(error.message).toContain(
          'Run init again with a Storybook version that all of these peers allow.'
        );
      });
    });

    describe('and the project declares a compatible @storybook/react itself', () => {
      beforeEach(() => {
        packageManager.getAllDependencies.mockReturnValue({ '@storybook/react': '11.0.0-beta.3' });
      });

      it('leaves that package to the install, which can reuse the declared release', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
        expect(readPackageNames()).not.toContain('@storybook/react');
      });
    });

    describe('and the stable CLI is the latest patch', () => {
      it('allows install', async () => {
        await expect(assertPeersFor('10.6.8')).resolves.toBeUndefined();
      });

      it('reads each on-device release from its latest manifest in one lookup', async () => {
        await assertPeersFor('10.6.8');

        expect(packageManager.latestVersion).not.toHaveBeenCalled();
        expect(packageManager.getPublishedManifest).toHaveBeenCalledWith(
          '@storybook/react-native',
          undefined
        );
      });
    });

    describe('and the package manager holds back releases younger than a day', () => {
      beforeEach(() => {
        packageManager.getReleaseAgeGate.mockResolvedValue(gateOf(24 * 60));
      });

      it('allows a CLI that is the newest release old enough to install', async () => {
        await expect(assertPeersFor('11.0.0-beta.4')).resolves.toBeUndefined();
      });

      it('names the release the package manager would install', async () => {
        const error = await assertPeersFor('11.0.0-beta.3').catch((err) => err);

        expect(error).toBeInstanceOf(ReactNativeOnDevicePeerMismatchError);
        expect(error.message).toContain(
          '- @storybook/react-native@11.0.0-next.2 > @storybook/react@11.0.0-beta.4 peers storybook@^11.0.0-beta.4'
        );
      });

      describe('and Storybook packages are exempt from it', () => {
        beforeEach(() => {
          packageManager.getReleaseAgeGate.mockResolvedValue(
            gateOf(24 * 60, (packageName) => packageName.startsWith('@storybook/'))
          );
        });

        it('checks the newest release', async () => {
          const error = await assertPeersFor('11.0.0-beta.4').catch((err) => err);

          expect(error).toBeInstanceOf(ReactNativeOnDevicePeerMismatchError);
          expect(error.message).toContain(
            '@storybook/react@11.0.0-rc.0 peers storybook@^11.0.0-rc.0'
          );
        });
      });

      describe('and only the newest @storybook/react release is exempt from it', () => {
        beforeEach(() => {
          packageManager.getReleaseAgeGate.mockResolvedValue(
            gateOf(
              24 * 60,
              (packageName, version) =>
                packageName === '@storybook/react' && version === '11.0.0-rc.0'
            )
          );
        });

        it('checks that release', async () => {
          const error = await assertPeersFor('11.0.0-beta.4').catch((err) => err);

          expect(error.message).toContain(
            '@storybook/react@11.0.0-rc.0 peers storybook@^11.0.0-rc.0'
          );
        });
      });

      describe('and the Storybook scope has its own gate', () => {
        beforeEach(() => {
          packageManager.getReleaseAgeGate.mockResolvedValue({
            strict: true,
            getMinutes: (packageName) => (packageName.startsWith('@storybook/') ? 0 : 24 * 60),
            isExcluded: () => false,
          });
        });

        it('applies the scope gate to Storybook packages', async () => {
          const error = await assertPeersFor('11.0.0-beta.4').catch((err) => err);

          expect(error.message).toContain(
            '@storybook/react@11.0.0-rc.0 peers storybook@^11.0.0-rc.0'
          );
        });
      });

      describe('and a nested package has no publish times', () => {
        beforeEach(() => {
          registry['@storybook/react'].time = {};
        });

        it('leaves that package to the install', async () => {
          await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
        });
      });

      describe('and the package manager prints a nested manifest without times or versions', () => {
        beforeEach(() => {
          const readRegistry = packageManager.getPublishedManifest.getMockImplementation()!;
          packageManager.getPublishedManifest.mockImplementation(async (packageName, version) => {
            const published = await readRegistry(packageName, version);
            return published && packageName === '@storybook/react'
              ? { ...published, versions: [], time: {} }
              : published;
          });
        });

        it('leaves that package to the install', async () => {
          await expect(assertPeersFor('10.6.7')).resolves.toBeUndefined();
        });
      });

      describe('and an on-device release is younger than the gate', () => {
        beforeEach(() => {
          registry['@storybook/react-native'].time['11.0.0-next.2'] = hoursAgo(5);
        });

        it('leaves that package to the install, which may pick another release', async () => {
          await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
        });

        it('still checks it when the gate exempts it', async () => {
          packageManager.getReleaseAgeGate.mockResolvedValue(
            gateOf(24 * 60, (packageName) => packageName === '@storybook/react-native')
          );

          await expect(assertPeersFor('11.0.0-beta.3')).rejects.toThrow(
            ReactNativeOnDevicePeerMismatchError
          );
        });
      });

      describe('and no release in range is old enough', () => {
        beforeEach(() => {
          registry['@storybook/react-native'].versions['11.0.0-next.2'].dependencies = {
            '@storybook/react': '^11.0.0-rc.0',
          };
        });

        it('checks the newest release in range, as pnpm installs it', async () => {
          const error = await assertPeersFor('11.0.0-beta.5').catch((err) => err);

          expect(error).toBeInstanceOf(ReactNativeOnDevicePeerMismatchError);
          expect(error.message).toContain(
            '@storybook/react@11.0.0-rc.0 peers storybook@^11.0.0-rc.0'
          );
        });
      });
    });

    describe('and the package manager settings cannot be read', () => {
      beforeEach(() => {
        packageManager.getReleaseAgeGate.mockResolvedValue(null);
      });

      it('leaves the outcome to the install', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
      });
    });

    describe('and the project pins a compatible @storybook/react with an override', () => {
      beforeEach(() => {
        overriding({ '@storybook/react': '11.0.0-beta.3' });
      });

      it('leaves that package to the install', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
        expect(readPackageNames()).not.toContain('@storybook/react');
      });
    });

    describe('and the project overrides an on-device package', () => {
      beforeEach(() => {
        overriding({ '@storybook/react-native': '10.7.3' });
      });

      it('leaves that package and its dependencies to the install', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
        expect(packageManager.latestVersion).not.toHaveBeenCalledWith(
          '@storybook/react-native@next'
        );
      });
    });

    describe('and the project overrides storybook', () => {
      beforeEach(() => {
        overriding({ storybook: '$storybook' });
      });

      it('skips the check, since the override decides which storybook every peer gets', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
        expect(packageManager.getPublishedManifest).not.toHaveBeenCalled();
      });
    });

    describe('and the overrides cannot be read', () => {
      beforeEach(() => {
        packageManager.getOverrideSources.mockImplementation(() => {
          throw new Error('Unexpected token in package.json');
        });
      });

      it('skips the check', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
      });
    });

    describe('and a nested lookup fails', () => {
      beforeEach(() => {
        delete registry['@storybook/react'];
      });

      it('skips that package', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
      });
    });

    describe('and no published release satisfies a nested range', () => {
      beforeEach(() => {
        registry['@storybook/react-native'].versions['11.0.0-next.2'].dependencies = {
          '@storybook/react': '^12.0.0',
        };
      });

      it('skips that package', async () => {
        await expect(assertPeersFor('11.0.0-beta.3')).resolves.toBeUndefined();
      });
    });

    describe('and Storybook packages depend on each other in a cycle', () => {
      beforeEach(() => {
        registry['@storybook/react'].versions['11.0.0-rc.0'].dependencies = {
          '@storybook/react-native': '^11.0.0-next.2',
        };
      });

      it('stops once every release is checked', async () => {
        await expect(assertPeersFor('11.0.0-rc.0')).resolves.toBeUndefined();
      });
    });

    describe('and several on-device packages depend on the same Storybook package', () => {
      beforeEach(() => {
        registry['@storybook/react-native-ui-lite'] = {
          'dist-tags': { latest: '10.7.3', next: '11.0.0-next.2' },
          versions: {
            '11.0.0-next.2': {
              dependencies: { '@storybook/react': '^11.0.0-beta.3' },
              peerDependencies: { storybook: '^11.0.0-beta.1' },
            },
          },
          time: { '11.0.0-next.2': hoursAgo(24 * 9) },
        };
      });

      it('looks each release up once', async () => {
        await assertPeersFor('11.0.0-rc.0');

        expect(
          packageManager.getPublishedManifest.mock.calls.filter(
            ([packageName]) => packageName === '@storybook/react'
          )
        ).toEqual([
          ['@storybook/react', undefined],
          ['@storybook/react', '11.0.0-rc.0'],
        ]);
      });
    });
  });
});
