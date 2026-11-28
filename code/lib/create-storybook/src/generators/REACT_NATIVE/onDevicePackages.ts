import type { JsPackageManager, PublishedManifest } from 'storybook/internal/common';
import {
  getOverriddenPackages,
  getReleaseAgeVerdict,
  isPackageInLockfile,
  selectInstallableVersion,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { ReactNativeOnDevicePeerMismatchError } from 'storybook/internal/server-errors';

import { compare, gt, minVersion, prerelease, satisfies, valid, validRange } from 'semver';

export const REACT_NATIVE_ON_DEVICE_PACKAGES = [
  '@storybook/addon-ondevice-controls',
  '@storybook/addon-ondevice-actions',
  '@storybook/react-native',
  '@storybook/react-native-ui-lite',
] as const;

export function reactNativeOnDeviceDistTag(cliVersion: string): 'next' | 'latest' {
  return prerelease(cliVersion) ? 'next' : 'latest';
}

export function onDevicePackageSpecifier(packageName: string, cliVersion: string): string {
  const tag = reactNativeOnDeviceDistTag(cliVersion);
  return tag === 'latest' ? packageName : `${packageName}@${tag}`;
}

export function onDevicePeerAllowsCli(cliVersion: string, peerRange: string): boolean {
  if (!validRange(peerRange)) {
    return true;
  }
  // Match npm. `11.0.0-alpha.6` does not satisfy `^11.0.0`, and coercing it to `11.0.0`
  // would also accept a higher prerelease floor such as `^11.0.0-alpha.7`.
  return satisfies(cliVersion, peerRange);
}

type ResolvedPackage = {
  packageName: string;
  manifest: PublishedManifest;
  parents: string[];
};

async function resolveOnDeviceStorybookPackages(
  packageManager: JsPackageManager,
  cliVersion: string,
  storybookRange: string,
  overridden: Set<string>,
  declared: Set<string>
): Promise<{ storybookVersion: string; packages: ResolvedPackage[] } | null> {
  const manifests = new Map<string, Promise<PublishedManifest | null>>();
  const readManifest = (packageName: string, version?: string) => {
    const packageSpec = version ? `${packageName}@${version}` : packageName;
    let manifest = manifests.get(packageSpec);
    if (!manifest) {
      manifest = packageManager.getPublishedManifest(packageName, version);
      manifests.set(packageSpec, manifest);
    }
    return manifest;
  };

  const readOnDevicePackage = async (packageName: string) => {
    const packageSpec = onDevicePackageSpecifier(packageName, cliVersion);
    if (packageSpec === packageName) {
      return readManifest(packageName);
    }
    const version = await packageManager.latestVersion(packageSpec);
    return version ? readManifest(packageName, version) : null;
  };

  const onDevicePackages = REACT_NATIVE_ON_DEVICE_PACKAGES.filter(
    (packageName) => !overridden.has(packageName)
  );
  const [gate, onDeviceManifests, latestStorybook] = await Promise.all([
    packageManager.getReleaseAgeGate(),
    Promise.all(onDevicePackages.map(readOnDevicePackage)),
    valid(storybookRange) || !validRange(storybookRange) ? null : readManifest('storybook'),
  ]);
  const storybookVersion = latestStorybook
    ? selectInstallableVersion({
        packageName: 'storybook',
        range: storybookRange,
        latest: latestStorybook,
        gate,
        prefersLatestTag: packageManager.prefersLatestTag,
      })
    : (valid(storybookRange) ?? cliVersion);
  if (!storybookVersion) {
    return null;
  }

  const readDependency = async (packageName: string, range: string) => {
    const latest = await readManifest(packageName);
    const version =
      latest &&
      selectInstallableVersion({
        packageName,
        range,
        latest,
        gate,
        prefersLatestTag: packageManager.prefersLatestTag,
      });
    if (!latest || !version) {
      return null;
    }
    return version === latest.version ? latest : readManifest(packageName, version);
  };

  // A failed lookup skips the check and leaves the outcome to the install itself.
  let level: ResolvedPackage[] = onDevicePackages.flatMap((packageName, index) => {
    const manifest = onDeviceManifests[index];
    return manifest &&
      getReleaseAgeVerdict(gate, packageName, manifest.version, manifest.time) === 'allowed'
      ? [{ packageName, manifest, parents: [] }]
      : [];
  });

  const lockfile = packageManager.readLockfile();
  const isLeftToInstall = (packageName: string) =>
    overridden.has(packageName) ||
    declared.has(packageName) ||
    (!!lockfile && isPackageInLockfile(lockfile, packageName));
  const resolved = new Map<string, ResolvedPackage>();
  while (level.length > 0) {
    const dependencies: Promise<ResolvedPackage[]>[] = [];
    for (const { packageName, manifest, parents } of level) {
      const id = `${packageName}@${manifest.version}`;
      if (resolved.has(id)) {
        continue;
      }
      resolved.set(id, { packageName, manifest, parents });

      for (const [dependency, range] of Object.entries(manifest.dependencies)) {
        if (dependency.startsWith('@storybook/') && !isLeftToInstall(dependency)) {
          dependencies.push(
            readDependency(dependency, range).then((dependencyManifest) =>
              dependencyManifest
                ? [
                    {
                      packageName: dependency,
                      manifest: dependencyManifest,
                      parents: [...parents, id],
                    },
                  ]
                : []
            )
          );
        }
      }
    }
    level = (await Promise.all(dependencies)).flat();
  }

  return { storybookVersion, packages: [...resolved.values()] };
}

const suggestStorybookVersion = (cliVersion: string, storybookPeers: string[]) => {
  const candidate = storybookPeers
    .map((storybookPeer) => minVersion(storybookPeer)?.version)
    .filter((version): version is string => !!version)
    .sort(compare)
    .at(-1);
  return candidate &&
    gt(candidate, cliVersion) &&
    storybookPeers.every((storybookPeer) => satisfies(candidate, storybookPeer))
    ? candidate
    : undefined;
};

export async function assertReactNativeOnDevicePeers(
  packageManager: JsPackageManager,
  cliVersion: string,
  storybookRange = cliVersion
): Promise<void> {
  let overridden: Set<string>;
  let declared: Set<string>;
  try {
    overridden = getOverriddenPackages(packageManager.getOverrideSources());
    declared = new Set(Object.keys(packageManager.getAllDependencies()));
  } catch (error) {
    logger.debug(
      `Skipping the React Native peer check, the project dependencies or overrides could not be read: ${error}`
    );
    return;
  }
  if (overridden.has('storybook')) {
    logger.debug('Skipping the React Native peer check, the project overrides storybook.');
    return;
  }

  const resolved = await resolveOnDeviceStorybookPackages(
    packageManager,
    cliVersion,
    storybookRange,
    overridden,
    declared
  );
  if (!resolved) {
    logger.debug(
      'Skipping the React Native peer check, the storybook release to install is unknown.'
    );
    return;
  }

  const { storybookVersion, packages } = resolved;
  const mismatches = packages.flatMap(
    ({ packageName, manifest: { version, peerDependencies }, parents }) => {
      const storybookPeer = peerDependencies.storybook;
      return storybookPeer && !onDevicePeerAllowsCli(storybookVersion, storybookPeer)
        ? [{ packageName, version, storybookPeer, parents }]
        : [];
    }
  );

  if (mismatches.length > 0) {
    throw new ReactNativeOnDevicePeerMismatchError({
      cliVersion: storybookVersion,
      mismatches,
      suggestedVersion: suggestStorybookVersion(
        storybookVersion,
        packages
          .flatMap(({ manifest }) => manifest.peerDependencies.storybook ?? [])
          .filter((storybookPeer) => validRange(storybookPeer))
      ),
    });
  }
}
