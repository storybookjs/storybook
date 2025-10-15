import {
  type PackageManagerName,
  loadMainConfig,
  syncStorybookAddons,
  versions,
} from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import SemVer from 'semver';
import { dedent } from 'ts-dedent';

import {
  getAbsolutePathWrapperName,
  wrapValueWithGetAbsolutePathWrapper,
} from './automigrate/fixes/wrap-getAbsolutePath-utils';
import { getStorybookData } from './automigrate/helpers/mainConfigFile';
import { postinstallAddon } from './postinstallAddon';

export interface PostinstallOptions {
  packageManager: PackageManagerName;
  configDir: string;
  yes?: boolean;
  skipInstall?: boolean;
}

/**
 * Extract the addon name and version specifier from the input string
 *
 * @example
 *
 * ```ts
 * getVersionSpecifier('@storybook/addon-docs@7.0.1') => ['@storybook/addon-docs', '7.0.1']
 * ```
 *
 * @param addon - The input string
 * @returns {undefined} AddonName, versionSpecifier
 */
export const getVersionSpecifier = (addon: string) => {
  const groups = /^(@{0,1}[^@]+)(?:@(.+))?$/.exec(addon);
  if (groups) {
    return [groups[1], groups[2]] as const;
  }
  return [addon, undefined] as const;
};

const checkInstalled = (addonName: string, main: StorybookConfigRaw) => {
  const existingAddon = main.addons?.find((entry: string | { name: string }) => {
    const name = typeof entry === 'string' ? entry : entry.name;
    return name?.endsWith(addonName);
  });
  return !!existingAddon;
};

const isCoreAddon = (addonName: string) => Object.hasOwn(versions, addonName);

type CLIOptions = {
  packageManager?: PackageManagerName;
  configDir?: string;
  skipInstall?: boolean;
  skipPostinstall: boolean;
  yes?: boolean;
};

/**
 * Install the given addon package and add it to main.js
 *
 * @example
 *
 * ```sh
 * sb add "@storybook/addon-docs"
 * sb add "@storybook/addon-vitest@9.0.1"
 * ```
 *
 * If there is no version specifier and it's a Storybook addon, it will try to use the version
 * specifier matching your current Storybook install version.
 */
export async function add(
  addon: string,
  {
    packageManager: pkgMgr,
    skipPostinstall,
    configDir: userSpecifiedConfigDir,
    yes,
    skipInstall,
  }: CLIOptions,
  logger = console
) {
  const [addonName, inputVersion] = getVersionSpecifier(addon);

  const { mainConfig, mainConfigPath, configDir, previewConfigPath, packageManager } =
    await getStorybookData({
      configDir: userSpecifiedConfigDir,
      packageManagerName: pkgMgr,
    });

  if (typeof configDir === 'undefined') {
    throw new Error(dedent`
      Unable to find storybook config directory. Please specify your Storybook config directory with the --config-dir flag.
    `);
  }

  if (!mainConfigPath) {
    logger.error('Unable to find Storybook main.js config');
    return;
  }

  let shouldAddToMain = true;
  if (checkInstalled(addonName, mainConfig)) {
    shouldAddToMain = false;
    if (!yes) {
      logger.log(`The Storybook addon "${addonName}" is already present in ${mainConfigPath}.`);
      const shouldForceInstall = await prompt.confirm({
        message: `Do you wish to install it again?`,
      });

      if (!shouldForceInstall) {
        return;
      }
    }
  }

  const main = await readConfig(mainConfigPath);
  logger.log(`Verifying ${addonName}`);

  let version = inputVersion;

  if (!version && isCoreAddon(addonName)) {
    version = versions.storybook;
  }

  if (!version) {
    const latestVersion = await packageManager.latestVersion(addonName);
    if (!latestVersion) {
      throw new Error(`No version found for ${addonName}`);
    }
    version = latestVersion;
  }

  const storybookVersion = versions.storybook;
  const versionIsStorybook = version === versions.storybook;

  if (isCoreAddon(addonName) && !versionIsStorybook) {
    logger.warn(
      `The version of ${addonName} (${version}) you are installing is not the same as the version of Storybook you are using (${storybookVersion}). This may lead to unexpected behavior.`
    );
  }

  const storybookVersionSpecifier = packageManager.getDependencyVersion('storybook');
  const versionRange = storybookVersionSpecifier?.match(/^[~^]/)?.[0] ?? '';

  const addonWithVersion = versionIsStorybook
    ? `${addonName}@${versionRange}${storybookVersion}`
    : isValidVersion(version) && !version.includes('-pr-')
      ? `${addonName}@^${version}`
      : `${addonName}@${version}`;

  logger.log(`Installing ${addonWithVersion}`);

  await packageManager.addDependencies(
    { type: 'devDependencies', writeOutputToFile: false, skipInstall },
    [addonWithVersion]
  );

  if (shouldAddToMain) {
    logger.log(`Adding '${addon}' to the "addons" field in ${mainConfigPath}`);

    const mainConfigAddons = main.getFieldNode(['addons']);
    if (mainConfigAddons && getAbsolutePathWrapperName(main) !== null) {
      const addonNode = main.valueToNode(addonName);
      main.appendNodeToArray(['addons'], addonNode as any);
      wrapValueWithGetAbsolutePathWrapper(main, addonNode as any);
    } else {
      main.appendValueToArray(['addons'], addonName);
    }

    await writeConfig(main);
  }

  // TODO: remove try/catch once CSF factories is shipped, for now gracefully handle any error
  try {
    const newMainConfig = await loadMainConfig({ configDir, skipCache: true });
    await syncStorybookAddons(newMainConfig, previewConfigPath!, configDir);
  } catch (e) {
    //
  }

  if (!skipPostinstall && isCoreAddon(addonName)) {
    await postinstallAddon(addonName, {
      packageManager: packageManager.type,
      configDir,
      yes,
      skipInstall,
    });
  }
}
function isValidVersion(version: string) {
  return SemVer.valid(version) || version.match(/^\d+$/);
}
