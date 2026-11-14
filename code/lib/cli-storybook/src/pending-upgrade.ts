import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { lt } from 'semver';

/**
 * The version an upgrade started from, kept from the moment it rewrites `package.json` until its
 * automigrations have run. The automigrations compare with the installed version, so a run that
 * stopped in between and was followed by an install would otherwise look like an upgrade within
 * the new version, and its rerun would skip the automigrations of the upgrade, the skills among
 * them.
 */
type PendingUpgrade = { from: string; to: string };

const key = (configDir: string) => `upgrade-pending:${configDir}`;

// A week covers a rerun on another day without reviving a long-abandoned upgrade.
const TTL_SECONDS = 7 * 24 * 60 * 60;

/** The version to migrate from: the start of an unfinished upgrade to the same version, if any. */
export async function upgradeStartVersion({
  configDir,
  installed,
  target,
}: {
  configDir: string;
  installed: string;
  target: string;
}): Promise<string> {
  try {
    const pending: PendingUpgrade | undefined = await cache.get(key(configDir));
    if (pending?.to === target && lt(pending.from, installed)) {
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
    await cache.set(key(configDir), upgrade, { ttl: TTL_SECONDS });
  } catch (error) {
    logger.debug(`Could not remember the upgrade of ${configDir}: ${String(error)}`);
  }
}

export async function forgetUpgradeStart(configDir: string): Promise<void> {
  try {
    await cache.remove(key(configDir));
  } catch (error) {
    logger.debug(`Could not forget the upgrade of ${configDir}: ${String(error)}`);
  }
}
