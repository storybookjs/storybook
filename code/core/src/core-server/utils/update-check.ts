import { cache } from '@storybook/core/common';
import type { VersionCheck } from '@storybook/core/types';

import { colors } from '@storybook/core/node-logger';

import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';

const { STORYBOOK_VERSION_BASE = 'https://storybook.js.org', CI } = process.env;

export const updateCheck = async (version: string): Promise<VersionCheck> => {
  let result;
  const time = Date.now();
  try {
    const fromCache = await cache.get('lastUpdateCheck', { success: false, time: 0 });

    // if last check was more then 24h ago
    if (time - 86400000 > fromCache.time && !CI) {
      const fromFetch: any = await Promise.race([
        fetch(`${STORYBOOK_VERSION_BASE}/versions.json?current=${version}`),
        // if fetch is too slow, we won't wait for it
        new Promise((res, rej) => global.setTimeout(rej, 1500)),
      ]);
      const data = await fromFetch.json();
      result = { success: true, cached: false, data, time };
      await cache.set('lastUpdateCheck', result);
    } else {
      result = { ...fromCache, cached: true };
    }
  } catch (error) {
    result = { success: false, cached: false, error, time };
  }
  return result;
};

export function createUpdateMessage(updateInfo: VersionCheck, version: string): string {
  let updateMessage;

  try {
    const isPrerelease = semver.prerelease(updateInfo.data.latest.version);
    const upgradeCommand = `npx storybook@${isPrerelease ? 'next' : 'latest'} upgrade`;
    updateMessage =
      updateInfo.success && semver.lt(version, updateInfo.data.latest.version)
        ? dedent`
          ${colors.orange(
            `A new version (${picocolors.bold(updateInfo.data.latest.version)}) is available!`
          )}

          ${picocolors.gray('Upgrade now:')} ${colors.green(upgradeCommand)}

          ${picocolors.gray('Read full changelog:')} ${picocolors.gray(
            picocolors.underline('https://github.com/storybookjs/storybook/blob/main/CHANGELOG.md')
          )}
        `
        : '';
  } catch (e) {
    updateMessage = '';
  }
  return updateMessage;
}
