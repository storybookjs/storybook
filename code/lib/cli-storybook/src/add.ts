import { isAbsolute, join } from 'node:path';

import {
  JsPackageManagerFactory,
  type PackageManagerName,
  getCoercedStorybookVersion,
  getStorybookInfo,
  serverRequire,
  versions,
} from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';

import SemVer from 'semver';
import { dedent } from 'ts-dedent';

import { postinstallAddon } from './postinstallAddon';

export interface PostinstallOptions {
  packageManager: PackageManagerName;
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

const requireMain = (configDir: string) => {
  const absoluteConfigDir = isAbsolute(configDir) ? configDir : join(process.cwd(), configDir);
  const mainFile = join(absoluteConfigDir, 'main');

  return serverRequire(mainFile) ?? {};
};

const checkInstalled = (addonName: string, main: any) => {
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
  skipPostinstall: boolean;
};

/**
 * Install the given addon package and add it to main.js
 *
 * @example
 *
 * ```sh
 * sb add "@storybook/addon-docs"
 * sb add "@storybook/addon-interactions@7.0.1"
 * ```
 *
 * If there is no version specifier and it's a storybook addon, it will try to use the version
 * specifier matching your current Storybook install version.
 */
export async function add(
  addon: string,
  { packageManager: pkgMgr, skipPostinstall, configDir: userSpecifiedConfigDir }: CLIOptions,
  logger = console
) {
  const [addonName, inputVersion] = getVersionSpecifier(addon);

  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr });
  const packageJson = await packageManager.retrievePackageJson();
  const { mainConfig, configDir: inferredConfigDir } = getStorybookInfo(
    packageJson,
    userSpecifiedConfigDir
  );
  const configDir = userSpecifiedConfigDir || inferredConfigDir || '.storybook';

  if (typeof configDir === 'undefined') {
    throw new Error(dedent`
      Unable to find storybook config directory
    `);
  }

  if (!mainConfig) {
    logger.error('Unable to find storybook main.js config');
    return;
  }

  if (checkInstalled(addonName, requireMain(configDir))) {
    throw new Error(dedent`
      Addon ${addonName} is already installed; we skipped adding it to your ${mainConfig}.
    `);
  }

  const main = await readConfig(mainConfig);
  logger.log(`Verifying ${addonName}`);

  const storybookVersion = await getCoercedStorybookVersion(packageManager);

  let version = inputVersion;

  if (!version && isCoreAddon(addonName) && storybookVersion) {
    version = storybookVersion;
  }
  if (!version) {
    version = await packageManager.latestVersion(addonName);
  }

  if (isCoreAddon(addonName) && version !== storybookVersion) {
    logger.warn(
      `The version of ${addonName} you are installing is not the same as the version of Storybook you are using. This may lead to unexpected behavior.`
    );
  }

  const addonWithVersion = isValidVersion(version)
    ? `${addonName}@^${version}`
    : `${addonName}@${version}`;

  logger.log(`Installing ${addonWithVersion}`);
  await packageManager.addDependencies({ installAsDevDependencies: true }, [addonWithVersion]);

  logger.log(`Adding '${addon}' to main.js addons field.`);
  main.appendValueToArray(['addons'], addonName);
  await writeConfig(main);

  if (!skipPostinstall && isCoreAddon(addonName)) {
    await postinstallAddon(addonName, { packageManager: packageManager.type });
  }
}
function isValidVersion(version: string) {
  return SemVer.valid(version) || version.match(/^\d+$/);
}
