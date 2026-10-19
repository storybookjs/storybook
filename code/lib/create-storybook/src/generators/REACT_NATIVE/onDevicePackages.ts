import type { JsPackageManager } from 'storybook/internal/common';
import { HandledError } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { prerelease, satisfies, validRange } from 'semver';
import { dedent } from 'ts-dedent';

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

const readStorybookPeer = async (
  registry: string,
  packageName: string,
  version: string
): Promise<string | undefined> => {
  try {
    const response = await fetch(`${registry}/${packageName}/${version}`);
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json()) as { peerDependencies?: { storybook?: unknown } };
    const peer = body.peerDependencies?.storybook;
    return typeof peer === 'string' ? peer : undefined;
  } catch {
    // A private registry or a custom CA can reject this lookup. Skip the check
    // and let the package manager, which has the user's auth and certs, install.
    return undefined;
  }
};

export async function assertReactNativeOnDevicePeers(
  packageManager: JsPackageManager,
  cliVersion: string
): Promise<void> {
  const tag = reactNativeOnDeviceDistTag(cliVersion);
  const registry =
    (await packageManager.getRegistryURL())?.replace(/\/$/, '') || 'https://registry.npmjs.org';

  const mismatches = (
    await Promise.all(
      REACT_NATIVE_ON_DEVICE_PACKAGES.map(async (packageName) => {
        const spec = tag === 'latest' ? packageName : `${packageName}@${tag}`;
        const version = await packageManager.latestVersion(spec);
        if (!version) {
          return null;
        }
        const storybookPeer = await readStorybookPeer(registry, packageName, version);
        if (!storybookPeer || onDevicePeerAllowsCli(cliVersion, storybookPeer)) {
          return null;
        }
        return `${packageName}@${version} peers storybook@${storybookPeer}`;
      })
    )
  ).filter((line): line is string => line !== null);

  if (mismatches.length === 0) {
    return;
  }

  const message = dedent`
    These React Native Storybook packages do not support Storybook ${cliVersion}:
    ${mismatches.map((line) => `- ${line}`).join('\n')}
  `;
  logger.error(message);
  throw new HandledError(message);
}
