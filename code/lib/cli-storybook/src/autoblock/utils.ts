import type { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { lt } from 'semver';

import { shortenPath } from '../util';
import type { AutoblockerResult } from './types';

type Result<M extends Record<string, string>> = {
  installedVersion: string | undefined;
  packageName: keyof M;
  minimumVersion: string;
};

const typedKeys = <TKey extends string>(obj: Record<TKey, any>) => Object.keys(obj) as TKey[];

/**
 * Finds the outdated package in the list of packages.
 *
 * @param minimalVersionsMap - The map of minimal versions for the packages.
 * @param options - The options for the function.
 * @returns The outdated package or false if no outdated package is found.
 */
export async function findOutdatedPackage<M extends Record<string, string>>(
  minimalVersionsMap: M,
  options: {
    packageManager: JsPackageManager;
  }
): Promise<false | Result<M>> {
  const list = await Promise.all(
    typedKeys(minimalVersionsMap).map(async (packageName) => ({
      packageName,
      installedVersion:
        (await options.packageManager.getModulePackageJSON(packageName))?.version ?? null,
      minimumVersion: minimalVersionsMap[packageName],
    }))
  );

  return list.reduce<false | Result<M>>(
    (acc, { installedVersion, minimumVersion, packageName }) => {
      if (acc) {
        return acc;
      }
      if (packageName && installedVersion && lt(installedVersion, minimumVersion)) {
        return {
          installedVersion,
          packageName,
          minimumVersion,
        };
      }
      return acc;
    },
    false
  );
}

/**
 * Processes autoblocker results and formats them for display. Returns true if there are blocking
 * issues that should prevent the upgrade.
 *
 * @param projects - Array of project results with autoblocker check results
 * @param onError - Callback function to handle error display
 * @returns True if there are blockers that should prevent upgrade, false otherwise
 */
export function processAutoblockerResults<
  T extends { configDir: string; autoblockerCheckResults?: AutoblockerResult<unknown>[] | null },
>(projects: T[], onError: (message: string) => void): boolean {
  const autoblockerMessagesMap = new Map<
    string,
    { title: string; message: string; link?: string; configDirs: string[] }
  >();

  projects.forEach((result) => {
    result.autoblockerCheckResults?.forEach((blocker) => {
      if (blocker.result === null || blocker.result === false) {
        return;
      }
      const blockerResult = blocker.blocker.log(blocker.result);
      const message = blockerResult.message;
      const link = blockerResult.link;

      if (autoblockerMessagesMap.has(message)) {
        autoblockerMessagesMap.get(message)!.configDirs.push(result.configDir);
      } else {
        autoblockerMessagesMap.set(message, {
          title: blockerResult.title,
          message,
          link,
          configDirs: [result.configDir],
        });
      }
    });
  });

  const autoblockerMessages = Array.from(autoblockerMessagesMap.values());

  if (autoblockerMessages.length > 0) {
    const formatConfigDirs = (configDirs: string[]) => {
      const baseMessage = 'Affected projects:';
      const relativeDirs = configDirs.map((dir) => shortenPath(dir) || '.');
      if (relativeDirs.length <= 3) {
        return `${baseMessage} ${relativeDirs.join(', ')}`;
      }
      const remaining = relativeDirs.length - 3;
      return `${baseMessage} ${relativeDirs.slice(0, 3).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
    };

    const formattedMessages = autoblockerMessages.map((item) => {
      let message = `${CLI_COLORS.warning(item.title)}\n\n${item.message}\n\n${formatConfigDirs(item.configDirs)}`;

      if (item.link) {
        message += `\n\nMore information: ${item.link}`;
      }

      return message;
    });

    onError(
      `Storybook has found potential blockers that need to be resolved before upgrading:\n\n${[...formattedMessages].join(`\n\n`)}\n\n---\n\nAfter addressing this, you can try running the upgrade command again. You can also rerun the upgrade command with the ${CLI_COLORS.info('--force')} flag to skip the blocker check and to proceed with the upgrade.`
    );

    return true;
  }

  return false;
}
