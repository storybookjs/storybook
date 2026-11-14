import { join, resolve } from 'node:path';

import { createFileSystemCache, getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { eq, lt } from 'semver';

// The version an upgrade started from, kept from the moment it rewrites `package.json` until its
// automigrations have run. The automigrations compare with the installed version, so a run that
// stopped in between and was followed by an install would otherwise make its rerun an upgrade
// within the new version, which skips the automigrations of the upgrade, the skills among them.
type PendingUpgrade = { from: string; to: string };

// Not Storybook's own cache: that one lives in a folder per CLI version, and the rerun may come
// from a newer CLI than the run that stopped.
const pendingUpgrades = () =>
  createFileSystemCache({
    basePath: join(getProjectRoot(), 'node_modules', '.cache', 'storybook', 'upgrade'),
    ns: 'storybook',
  });

const key = (configDir: string) => `pending:${resolve(configDir)}`;

// A week covers a rerun on another day without reviving a long-abandoned upgrade.
const TTL_SECONDS = 7 * 24 * 60 * 60;

// The version to migrate from: where an unfinished upgrade started, when the project now has that
// upgrade's version installed, or else the installed version.
export async function upgradeStartVersion(configDir: string, installed: string): Promise<string> {
  try {
    const pending: PendingUpgrade | undefined = await pendingUpgrades().get(key(configDir));
    if (pending && eq(installed, pending.to) && lt(pending.from, installed)) {
      return pending.from;
    }
  } catch (error) {
    logger.debug(`Could not read the unfinished upgrade of ${configDir}: ${String(error)}`);
  }
  return installed;
}

export async function rememberUpgradeStart(
  configDir: string,
  upgrade: PendingUpgrade
): Promise<void> {
  try {
    await pendingUpgrades().set(key(configDir), upgrade, { ttl: TTL_SECONDS });
  } catch (error) {
    logger.debug(`Could not remember the upgrade of ${configDir}: ${String(error)}`);
  }
}

export async function forgetUpgradeStart(configDir: string): Promise<void> {
  try {
    await pendingUpgrades().remove(key(configDir));
  } catch (error) {
    logger.debug(`Could not forget the upgrade of ${configDir}: ${String(error)}`);
  }
}
