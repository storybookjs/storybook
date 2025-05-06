import { hasStorybookDependencies } from 'storybook/internal/cli';
import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import {
  JsPackageManagerFactory,
  isCorePackage,
  isSatelliteAddon,
  versions,
} from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookInWrongWorkingDirectory,
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookToSameVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import boxen from 'boxen';
import { sync as spawnSync } from 'cross-spawn';
import picocolors from 'picocolors';
import semver, { clean, eq, lt, prerelease } from 'semver';
import { dedent } from 'ts-dedent';

import { autoblock } from './autoblock/index';
import { getStorybookData } from './automigrate/helpers/mainConfigFile';
import { automigrate } from './automigrate/index';
import { doctor } from './doctor';

type Package = {
  package: string;
  version: string;
};

const versionRegex = /(@storybook\/[^@]+)@(\S+)/;
export const getStorybookVersion = (line: string) => {
  if (line.startsWith('npm ')) {
    return null;
  }
  const match = versionRegex.exec(line);

  if (!match || !clean(match[2])) {
    return null;
  }
  return {
    package: match[1],
    version: match[2],
  };
};

const getInstalledStorybookVersion = async (packageManager: JsPackageManager) => {
  const installations = await packageManager.findInstallations(Object.keys(versions));
  if (!installations) {
    return;
  }

  return Object.entries(installations.dependencies)[0]?.[1]?.[0].version;
};

const deprecatedPackages = [
  {
    minVersion: '6.0.0-alpha.0',
    url: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#60-deprecations',
    deprecations: [
      '@storybook/addon-notes',
      '@storybook/addon-info',
      '@storybook/addon-contexts',
      '@storybook/addon-options',
      '@storybook/addon-centered',
    ],
  },
];

const formatPackage = (pkg: Package) => `${pkg.package}@${pkg.version}`;

const warnPackages = (pkgs: Package[]) =>
  pkgs.forEach((pkg) => logger.warn(`- ${formatPackage(pkg)}`));

export const checkVersionConsistency = () => {
  const lines = spawnSync('npm', ['ls'], { stdio: 'pipe', shell: true })
    .output.toString()
    .split('\n');
  const storybookPackages = lines
    .map(getStorybookVersion)
    .filter((item): item is NonNullable<typeof item> => !!item)
    .filter((pkg) => isCorePackage(pkg.package));
  if (!storybookPackages.length) {
    logger.warn('No storybook core packages found.');
    logger.warn(`'npm ls | grep storybook' can show if multiple versions are installed.`);
    return;
  }
  storybookPackages.sort((a, b) => semver.rcompare(a.version, b.version));
  const latestVersion = storybookPackages[0].version;
  const outdated = storybookPackages.filter((pkg) => pkg.version !== latestVersion);
  if (outdated.length > 0) {
    logger.warn(
      `Found ${outdated.length} outdated packages (relative to '${formatPackage(
        storybookPackages[0]
      )}')`
    );
    logger.warn('Please make sure your packages are updated to ensure a consistent experience.');
    warnPackages(outdated);
  }

  deprecatedPackages.forEach(({ minVersion, url, deprecations }) => {
    if (semver.gte(latestVersion, minVersion)) {
      const deprecated = storybookPackages.filter((pkg) => deprecations.includes(pkg.package));
      if (deprecated.length > 0) {
        logger.warn(`Found ${deprecated.length} deprecated packages since ${minVersion}`);
        logger.warn(`See ${url}`);
        warnPackages(deprecated);
      }
    }
  });
};

function getVersionModifier(versionSpecifier: string) {
  if (!versionSpecifier || typeof versionSpecifier !== 'string') {
    return '';
  }

  // Split in case of complex version strings like "9.0.0 || >= 0.0.0-pr.0"
  const firstPart = versionSpecifier.split(/\s*\|\|\s*/)[0].trim();

  // Match common modifiers
  const match = firstPart.match(/^([~^><=]+)/);

  return match ? match[1] : '';
}

/** Based on a list of dependencies, return a which need upgrades and to which versions */
export const toUpgradedDependencies = async (
  deps: Record<string, string> = {},
  packageManager: JsPackageManager,
  {
    isCanary = false,
    isCLIOutdated = false,
    isCLIPrerelease = false,
    isCLIExactPrerelease = false,
    isCLIExactLatest = false,
  } = {}
): Promise<string[]> => {
  const monorepoDependencies = Object.keys(deps || {}).filter((dependency) => {
    // only upgrade packages that are in the monorepo
    return dependency in versions;
  }) as Array<keyof typeof versions>;

  const storybookCoreUpgrades = monorepoDependencies.map((dependency) => {
    /**
     * Respect the modifier that the user set to the dependency, but make it fixed when the CLI is
     * outdated (e.g. user is downgrading) or when upgrading to a canary version.
     *
     * Example outputs:
     *
     * - @storybook/react@9.0.0
     * - @storybook/react@^9.0.0
     * - @storybook/react@~9.0.0
     */
    let char = getVersionModifier(deps[dependency]);

    if (isCLIOutdated) {
      char = '';
    }
    if (isCanary) {
      char = '';
    }

    return `${dependency}@${char}${versions[dependency]}`;
  });

  let storybookSatelliteUpgrades: string[] = [];
  if (isCLIExactPrerelease || isCLIExactLatest) {
    const satelliteDependencies = Object.keys(deps).filter(isSatelliteAddon);

    if (satelliteDependencies.length > 0) {
      try {
        // respect the existing character here.
        storybookSatelliteUpgrades = await Promise.all(
          satelliteDependencies.map(async (dependency) => {
            const latestVersion = await packageManager.latestVersion(
              isCLIPrerelease ? `${dependency}@next` : dependency
            );
            const modifier = getVersionModifier(deps[dependency]);
            return `${dependency}@${modifier}${latestVersion}`;
          })
        );
      } catch (error) {
        // If there is an error fetching satellite dependencies, we don't want to block the upgrade
      }
    }
  }

  return [...storybookCoreUpgrades, ...storybookSatelliteUpgrades];
};

export interface UpgradeOptions {
  skipCheck: boolean;
  packageManager?: PackageManagerName;
  dryRun: boolean;
  yes: boolean;
  force: boolean;
  disableTelemetry: boolean;
  configDir?: string;
}

export const doUpgrade = async (allOptions: UpgradeOptions) => {
  const {
    skipCheck,
    packageManager: packageManagerName,
    dryRun,
    configDir: userSpecifiedConfigDir,
    yes,
    ...options
  } = allOptions;
  const packageManager = JsPackageManagerFactory.getPackageManager({ force: packageManagerName });

  // If we can't determine the existing version fallback to v0.0.0 to not block the upgrade
  const beforeVersion = (await getInstalledStorybookVersion(packageManager)) ?? '0.0.0';

  const currentCLIVersion = versions.storybook;
  const isCanary =
    currentCLIVersion.startsWith('0.0.0') ||
    beforeVersion.startsWith('portal:') ||
    beforeVersion.startsWith('workspace:');

  if (!(await hasStorybookDependencies(packageManager))) {
    throw new UpgradeStorybookInWrongWorkingDirectory();
  }
  if (!isCanary && lt(currentCLIVersion, beforeVersion)) {
    throw new UpgradeStorybookToLowerVersionError({
      beforeVersion,
      currentVersion: currentCLIVersion,
    });
  }

  if (!isCanary && eq(currentCLIVersion, beforeVersion)) {
    // Not throwing, as the beforeVersion calculation doesn't always work in monorepos.
    logger.warn(new UpgradeStorybookToSameVersionError({ beforeVersion }).message);
  }

  const latestCLIVersionOnNPM = await packageManager.latestVersion('storybook');
  const latestPrereleaseCLIVersionOnNPM = await packageManager.latestVersion('storybook@next');

  const isCLIOutdated = lt(currentCLIVersion, latestCLIVersionOnNPM);
  const isCLIExactLatest = currentCLIVersion === latestCLIVersionOnNPM;
  const isCLIPrerelease = prerelease(currentCLIVersion) !== null;
  const isCLIExactPrerelease = currentCLIVersion === latestPrereleaseCLIVersionOnNPM;

  const isUpgrade = lt(beforeVersion, currentCLIVersion);

  const borderColor = isCLIOutdated ? '#FC521F' : '#F1618C';

  const messages = {
    welcome: `Upgrading Storybook from version ${picocolors.bold(
      beforeVersion
    )} to version ${picocolors.bold(currentCLIVersion)}..`,
    notLatest: picocolors.red(dedent`
      This version is behind the latest release, which is: ${picocolors.bold(
        latestCLIVersionOnNPM
      )}!
      You likely ran the upgrade command through a remote command like npx, which can use a locally cached version. To upgrade to the latest version please run:
      ${picocolors.bold(`${packageManager.getRemoteRunCommand()} storybook@latest upgrade`)}
      
      You may want to CTRL+C to stop, and run with the latest version instead.
    `),
    prerelease: picocolors.yellow('This is a pre-release version.'),
  };

  logger.plain(
    boxen(
      [messages.welcome]
        .concat(isCLIOutdated && !isCLIPrerelease ? [messages.notLatest] : [])
        .concat(isCLIPrerelease ? [messages.prerelease] : [])
        .join('\n'),
      { borderStyle: 'round', padding: 1, borderColor }
    )
  );

  let results;

  const { configDir, mainConfig, mainConfigPath, previewConfigPath, packageJson } =
    await getStorybookData({
      packageManager,
      configDir: userSpecifiedConfigDir,
    });

  // GUARDS
  if (!beforeVersion) {
    throw new UpgradeStorybookUnknownCurrentVersionError();
  }

  // BLOCKERS
  if (
    !results &&
    typeof mainConfig !== 'boolean' &&
    typeof mainConfigPath !== 'undefined' &&
    !options.force
  ) {
    const blockResult = await autoblock({
      packageManager,
      configDir,
      packageJson,
      mainConfig,
      mainConfigPath,
    });
    if (blockResult) {
      results = { preCheckFailure: blockResult };
    }
  }

  // INSTALL UPDATED DEPENDENCIES
  if (!dryRun && !results) {
    const upgradedDependencies = await toUpgradedDependencies(
      packageJson.dependencies as Record<string, string>,
      packageManager,
      {
        isCanary,
        isCLIOutdated,
        isCLIPrerelease,
        isCLIExactPrerelease,
        isCLIExactLatest,
      }
    );

    const upgradedDevDependencies = await toUpgradedDependencies(
      packageJson.devDependencies as Record<string, string>,
      packageManager,
      {
        isCanary,
        isCLIOutdated,
        isCLIPrerelease,
        isCLIExactPrerelease,
        isCLIExactLatest,
      }
    );

    // Add Storybook overrides to package.json when using npm to prevent peer dependency conflicts
    if (packageManager.type === 'npm') {
      try {
        // Add overrides section if it doesn't exist
        if (!packageJson.overrides) {
          packageJson.overrides = {};
        }

        // Add Storybook overrides
        packageJson.overrides.storybook = `$storybook`;

        if (!dryRun) {
          await packageManager.writePackageJson(packageJson);
          logger.info(
            `Added Storybook overrides to ${picocolors.cyan(
              'package.json'
            )} to ensure consistent dependency resolution`
          );
        }
      } catch (err) {
        logger.warn('Failed to add Storybook overrides to package.json');
      }
    }

    // Users struggle to upgrade Storybook with npm because of conflicting peer-dependencies
    // GitHub Issue: https://github.com/storybookjs/storybook/issues/30306
    // Solution: Remove all Storybook packages (except 'storybook') from the package.json and install them again
    if (packageManager.type === 'npm') {
      const getPackageName = (dep: string) => {
        const lastAtIndex = dep.lastIndexOf('@');
        return lastAtIndex > 0 ? dep.slice(0, lastAtIndex) : dep;
      };

      // Remove all Storybook packages except 'storybook'
      await packageManager.removeDependencies(
        { skipInstall: false },
        [...upgradedDependencies, ...upgradedDevDependencies]
          .map(getPackageName)
          .filter((dep) => dep !== 'storybook')
      );

      // Handle 'storybook' package separately to maintain peer dependencies
      const findStorybookPackage = (deps: string[]) =>
        deps.find((dep) => getPackageName(dep) === 'storybook');

      const storybookDep = findStorybookPackage(upgradedDependencies);
      const storybookDevDep = findStorybookPackage(upgradedDevDependencies);

      if (storybookDep) {
        await packageManager.addDependencies({ installAsDevDependencies: false }, [storybookDep]);
      }
      if (storybookDevDep) {
        await packageManager.addDependencies({ installAsDevDependencies: true }, [storybookDevDep]);
      }
    }

    // Update all dependencies
    logger.info(`Updating dependencies in ${picocolors.cyan('package.json')}..`);
    const addDeps = async (deps: string[], isDev: boolean) => {
      if (deps.length > 0) {
        await packageManager.addDependencies(
          { installAsDevDependencies: isDev, skipInstall: true, packageJson },
          deps
        );
      }
    };

    await addDeps(upgradedDependencies, false);
    await addDeps(upgradedDevDependencies, true);
    await packageManager.installDependencies();
  }

  // AUTOMIGRATIONS
  if (!skipCheck && !results && mainConfigPath) {
    checkVersionConsistency();
    results = await automigrate({
      dryRun,
      yes,
      packageManager,
      packageJson,
      mainConfig,
      configDir,
      previewConfigPath,
      mainConfigPath,
      beforeVersion,
      storybookVersion: currentCLIVersion,
      isUpgrade,
      isLatest: isCLIExactLatest,
    });
  }

  // TELEMETRY
  if (!options.disableTelemetry) {
    const { preCheckFailure, fixResults } = results || {};
    const automigrationTelemetry = {
      automigrationResults: preCheckFailure ? null : fixResults,
      automigrationPreCheckFailure: preCheckFailure || null,
    };

    await telemetry('upgrade', {
      beforeVersion,
      afterVersion: currentCLIVersion,
      ...automigrationTelemetry,
    });
  }

  await doctor(allOptions);
};

export async function upgrade(options: UpgradeOptions): Promise<void> {
  await withTelemetry('upgrade', { cliOptions: options }, () => doUpgrade(options));
}
