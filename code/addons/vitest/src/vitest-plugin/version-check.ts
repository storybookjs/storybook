import { fileURLToPath } from 'node:url';

import { HandledError } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { dirname } from 'pathe';

/** Warnings already logged, as the plugin is created once per Vitest project that uses it. */
const loggedWarnings = new Set<string>();

/** The directory the `storybook` package was resolved from, if it can be determined. */
function resolveStorybookLocation(): string | undefined {
  try {
    return dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
  } catch {
    return undefined;
  }
}

/** The major of a version such as `11.0.0-beta.1`, or `undefined` when it can't be read. */
function getMajor(version: string): number | undefined {
  const major = Number.parseInt(version, 10);
  return Number.isNaN(major) ? undefined : major;
}

/** Whether a version is a canary release such as `0.0.0-pr-12345-sha-1a2b3c4d`. */
function isCanary(version: string): boolean {
  return version.startsWith('0.0.0');
}

/**
 * Checks the `storybook` package this addon resolved against the addon's own version.
 *
 * In monorepos, another copy of `storybook` can end up hoisted next to the addon, for example when
 * only some of the workspaces were upgraded. The addon then crashes with an obscure error once it
 * reaches an internal API the other version doesn't have.
 *
 * A `storybook` of another major throws, as the addon can't work with it. Any other difference
 * only logs a warning: the versions are meant to be the same, but a mismatch within a major often
 * works.
 *
 * Canary releases are skipped: they are versioned `0.0.0-…`, which says nothing about the release
 * they were built from, and they are installed on purpose next to other versions.
 *
 * It can only run once this module has loaded, so it doesn't cover a `storybook` so old that it
 * lacks one of the exports this plugin imports.
 */
export function checkStorybookVersion({
  addonVersion,
  coreVersion,
  resolveCoreLocation = resolveStorybookLocation,
}: {
  addonVersion: string;
  coreVersion: string;
  resolveCoreLocation?: () => string | undefined;
}) {
  if (coreVersion === addonVersion || isCanary(addonVersion) || isCanary(coreVersion)) {
    return;
  }

  const coreLocation = resolveCoreLocation();
  const details = [
    ...(coreLocation ? [`The addon loaded "storybook" from: ${coreLocation}`] : []),
    'This usually means several versions of Storybook are installed, for example when only some of the packages in a monorepo were upgraded.',
    'Run "npm ls storybook" (or the "why" command of your package manager) to see which versions are installed and what requires them, then make sure every "storybook" and "@storybook/*" dependency in your repository uses the same version.',
  ].join('\n\n');

  const addonMajor = getMajor(addonVersion);
  const coreMajor = getMajor(coreVersion);

  if (addonMajor !== undefined && coreMajor !== undefined && addonMajor !== coreMajor) {
    throw new HandledError(
      `@storybook/addon-vitest@${addonVersion} is not compatible with storybook@${coreVersion}.\n\n${details}`
    );
  }

  const warning = `@storybook/addon-vitest@${addonVersion} is running with storybook@${coreVersion}, which is a different version.\n\n${details}`;

  if (!loggedWarnings.has(warning)) {
    loggedWarnings.add(warning);
    logger.warn(warning);
  }
}
