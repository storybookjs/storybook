import { createRequire } from 'node:module';
import { join } from 'node:path';

import { lt } from 'semver';

/** Minimum Storybook version whose `storybook dev` registers itself for MCP discovery. */
export const STORYBOOK_MIN_VERSION = '10.5.0';

/**
 * Comparison floor for the minimum version. The `-0` prerelease suffix is the lowest possible
 * 10.5.0 build, so every 10.5.0 prerelease (alpha/beta/rc) is accepted alongside the stable
 * release, while anything below 10.5.0 is rejected.
 */
const STORYBOOK_MIN_VERSION_FLOOR = '10.5.0-0';

export type StorybookVersionStatus =
  | { status: 'ok' }
  | { status: 'too-old'; version: string }
  | { status: 'not-installed' };

function readStorybookVersion(cwd: string): string | null {
  try {
    const requireFromCwd = createRequire(join(cwd, 'package.json'));
    const { version } = requireFromCwd('storybook/package.json') as { version: string };
    return version;
  } catch {
    return null;
  }
}

export function checkStorybookVersion(cwd: string): StorybookVersionStatus {
  const version = readStorybookVersion(cwd);
  // Storybook canary releases are published as `0.0.0-*`; semver considers these < any stable
  // version, but we still want to treat them as supported.
  if (version?.startsWith('0.0.0-')) {
    return { status: 'ok' };
  }
  if (version === null) {
    return { status: 'not-installed' };
  }
  return lt(version, STORYBOOK_MIN_VERSION_FLOOR)
    ? { status: 'too-old', version }
    : { status: 'ok' };
}
