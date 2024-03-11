import { sync as spawnSync } from 'cross-spawn';
import { telemetry } from '@storybook/telemetry';
import semver, { coerce, eq, lt } from 'semver';
import { deprecate, logger } from '@storybook/node-logger';
import { withTelemetry } from '@storybook/core-server';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookToSameVersionError,
} from '@storybook/core-events/server-errors';

import chalk from 'chalk';
import dedent from 'ts-dedent';
import boxen from 'boxen';
import type {
  JsPackageManager,
  PackageJsonWithMaybeDeps,
  PackageManagerName,
} from './js-package-manager';
import { JsPackageManagerFactory, getPackageDetails, useNpmWarning } from './js-package-manager';
import { commandLog } from './helpers';
import { automigrate } from './automigrate';
import { isCorePackage } from './utils';
import versions from './versions';

type Package = {
  package: string;
  version: string;
};

const versionRegex = /(@storybook\/[^@]+)@(\S+)/;
export const getStorybookVersion = (line: string) => {
  if (line.startsWith('npm ')) return null;
  const match = versionRegex.exec(line);
  if (!match || !semver.clean(match[2])) return null;
  return {
    package: match[1],
    version: match[2],
  };
};

const getInstalledStorybookVersion = async (packageManager: JsPackageManager) => {
  const installations = await packageManager.findInstallations(['storybook', '@storybook/cli']);
  if (!installations) {
    return undefined;
  }
  const cliVersion = installations.dependencies['@storybook/cli']?.[0].version;
  if (cliVersion) {
    return cliVersion;
  }
  return installations.dependencies['storybook']?.[0].version;
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
    .filter(Boolean)
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

// #region DEPRECATED BEHAVIOR SECTION

type ExtraFlags = Record<string, string[]>;
const EXTRA_FLAGS: ExtraFlags = {
  'react-scripts@<5': ['--reject', '/preset-create-react-app/'],
};

export const addExtraFlags = (
  extraFlags: ExtraFlags,
  flags: string[],
  { dependencies, devDependencies }: PackageJsonWithMaybeDeps
) => {
  return Object.entries(extraFlags).reduce(
    (acc, entry) => {
      const [pattern, extra] = entry;
      const [pkg, specifier] = getPackageDetails(pattern);
      const pkgVersion = dependencies[pkg] || devDependencies[pkg];

      if (pkgVersion && semver.satisfies(semver.coerce(pkgVersion), specifier)) {
        return [...acc, ...extra];
      }

      return acc;
    },
    [...flags]
  );
};

export const addNxPackagesToReject = (flags: string[]) => {
  const newFlags = [...flags];
  const index = flags.indexOf('--reject');
  if (index > -1) {
    // Try to understand if it's in the format of a regex pattern
    if (newFlags[index + 1].endsWith('/') && newFlags[index + 1].startsWith('/')) {
      // Remove last and first slash so that I can add the parentheses
      newFlags[index + 1] = newFlags[index + 1].substring(1, newFlags[index + 1].length - 1);
      newFlags[index + 1] = `/(${newFlags[index + 1]}|@nrwl/storybook|@nx/storybook)/`;
    } else {
      // Adding the two packages as comma-separated values
      // If the existing rejects are in regex format, they will be ignored.
      // Maybe we need to find a more robust way to treat rejects?
      newFlags[index + 1] = `${newFlags[index + 1]},@nrwl/storybook,@nx/storybook`;
    }
  } else {
    newFlags.push('--reject');
    newFlags.push('@nrwl/storybook,@nx/storybook');
  }
  return newFlags;
};

export const deprecatedUpgrade = async ({
  tag,
  prerelease,
  skipCheck,
  useNpm,
  packageManager: pkgMgr,
  dryRun,
  configDir,
  yes,
  ...options
}: UpgradeOptions) => {
  if (useNpm) {
    useNpmWarning();
    // eslint-disable-next-line no-param-reassign
    pkgMgr = 'npm';
  }
  if (tag) {
    deprecate(
      'The --tag flag is deprecated. Specify the version you want to upgrade to with `npx storybook@<version> upgrade` instead'
    );
  } else if (prerelease) {
    deprecate(
      'The --prerelease flag is deprecated. Specify the version you want to upgrade to with `npx storybook@<version> upgrade` instead'
    );
  }
  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr });

  // If we can't determine the existing version fallback to v0.0.0 to not block the upgrade
  const beforeVersion = (await getInstalledStorybookVersion(packageManager)) ?? '0.0.0';

  commandLog(`Checking for latest versions of '@storybook/*' packages`);

  if (tag && prerelease) {
    throw new Error(
      `Cannot set both --tag and --prerelease. Use --tag next to get the latest prereleae`
    );
  }

  let target = 'latest';
  if (prerelease) {
    // '@next' is storybook's convention for the latest prerelease tag.
    // This used to be 'greatest', but that was not reliable and could pick canaries, etc.
    // and random releases of other packages with storybook in their name.
    target = '@next';
  } else if (tag) {
    target = `@${tag}`;
  }

  let flags = [];
  if (!dryRun) flags.push('--upgrade');
  flags.push('--target');
  flags.push(target);
  flags = addExtraFlags(EXTRA_FLAGS, flags, await packageManager.retrievePackageJson());
  flags = addNxPackagesToReject(flags);
  const check = spawnSync('npx', ['npm-check-updates@latest', '/storybook/', ...flags], {
    stdio: 'pipe',
    shell: true,
  });
  logger.info(check.stdout.toString());
  logger.info(check.stderr.toString());

  const checkSb = spawnSync('npx', ['npm-check-updates@latest', 'sb', ...flags], {
    stdio: 'pipe',
    shell: true,
  });
  logger.info(checkSb.stdout.toString());
  logger.info(checkSb.stderr.toString());

  if (!dryRun) {
    commandLog(`Installing upgrades`);
    await packageManager.installDependencies();
  }

  let automigrationResults;
  if (!skipCheck) {
    checkVersionConsistency();
    automigrationResults = await automigrate({ dryRun, yes, packageManager: pkgMgr, configDir });
  }
  if (!options.disableTelemetry) {
    const afterVersion = await getInstalledStorybookVersion(packageManager);
    const { preCheckFailure, fixResults } = automigrationResults || {};
    const automigrationTelemetry = {
      automigrationResults: preCheckFailure ? null : fixResults,
      automigrationPreCheckFailure: preCheckFailure || null,
    };
    telemetry('upgrade', {
      prerelease,
      tag,
      beforeVersion,
      afterVersion,
      ...automigrationTelemetry,
    });
  }
};

// #endregion DEPRECATED BEHAVIOR SECTION

export interface UpgradeOptions {
  /**
   * @deprecated
   */
  tag: string;
  /**
   * @deprecated
   */
  prerelease: boolean;
  skipCheck: boolean;
  useNpm: boolean;
  packageManager: PackageManagerName;
  dryRun: boolean;
  yes: boolean;
  disableTelemetry: boolean;
  configDir?: string;
}

export const doUpgrade = async ({
  tag,
  prerelease,
  skipCheck,
  useNpm,
  packageManager: pkgMgr,
  dryRun,
  configDir,
  yes,
  ...options
}: UpgradeOptions) => {
  if (useNpm) {
    useNpmWarning();
    // eslint-disable-next-line no-param-reassign
    pkgMgr = 'npm';
  }
  if (tag || prerelease) {
    await deprecatedUpgrade({
      tag,
      prerelease,
      skipCheck,
      useNpm,
      packageManager: pkgMgr,
      dryRun,
      configDir,
      yes,
      ...options,
    });
    return;
  }

  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr });

  // If we can't determine the existing version fallback to v0.0.0 to not block the upgrade
  const beforeVersion = (await getInstalledStorybookVersion(packageManager)) ?? '0.0.0';

  const currentVersion = versions['@storybook/cli'];
  const isCanary = currentVersion.startsWith('0.0.0');

  if (!isCanary && lt(currentVersion, beforeVersion)) {
    throw new UpgradeStorybookToLowerVersionError({ beforeVersion, currentVersion });
  }
  if (!isCanary && eq(currentVersion, beforeVersion)) {
    throw new UpgradeStorybookToSameVersionError({ beforeVersion });
  }

  const latestVersion = await packageManager.latestVersion('@storybook/cli');
  const isOutdated = lt(currentVersion, latestVersion);
  const isPrerelease = semver.prerelease(currentVersion) !== null;

  const borderColor = isOutdated ? '#FC521F' : '#F1618C';

  const messages = {
    welcome: `Upgrading Storybook from version ${chalk.bold(beforeVersion)} to version ${chalk.bold(
      currentVersion
    )}..`,
    notLatest: chalk.red(dedent`
      This version is behind the latest release, which is: ${chalk.bold(latestVersion)}!
      You likely ran the upgrade command through npx, which can use a locally cached version, to upgrade to the latest version please run:
      ${chalk.bold('npx storybook@latest upgrade')}
      
      You may want to CTRL+C to stop, and run with the latest version instead.
    `),
    prelease: chalk.yellow('This is a pre-release version.'),
  };

  logger.plain(
    boxen(
      [messages.welcome]
        .concat(isOutdated && !isPrerelease ? [messages.notLatest] : [])
        .concat(isPrerelease ? [messages.prelease] : [])
        .join('\n'),
      { borderStyle: 'round', padding: 1, borderColor }
    )
  );

  const packageJson = await packageManager.retrievePackageJson();

  const toUpgradedDependencies = (deps: Record<string, any>) => {
    const monorepoDependencies = Object.keys(deps || {}).filter((dependency) => {
      // don't upgrade @storybook/preset-create-react-app if react-scripts is < v5
      if (dependency === '@storybook/preset-create-react-app') {
        const reactScriptsVersion =
          packageJson.dependencies['react-scripts'] ?? packageJson.devDependencies['react-scripts'];
        if (reactScriptsVersion && lt(coerce(reactScriptsVersion), '5.0.0')) {
          return false;
        }
      }

      // only upgrade packages that are in the monorepo
      return dependency in versions;
    }) as Array<keyof typeof versions>;
    return monorepoDependencies.map((dependency) => {
      /* add ^ modifier to the version if this is the latest stable or prerelease version
         example outputs: @storybook/react@^8.0.0 */
      const maybeCaret = (!isOutdated || isPrerelease) && !isCanary ? '^' : '';
      return `${dependency}@${maybeCaret}${versions[dependency]}`;
    });
  };

  const upgradedDependencies = toUpgradedDependencies(packageJson.dependencies);
  const upgradedDevDependencies = toUpgradedDependencies(packageJson.devDependencies);

  if (!dryRun) {
    commandLog(`Updating dependencies in ${chalk.cyan('package.json')}..`);
    logger.plain('');
    if (upgradedDependencies.length > 0) {
      await packageManager.addDependencies(
        { installAsDevDependencies: false, skipInstall: true, packageJson },
        upgradedDependencies
      );
    }
    if (upgradedDevDependencies.length > 0) {
      await packageManager.addDependencies(
        { installAsDevDependencies: true, skipInstall: true, packageJson },
        upgradedDevDependencies
      );
    }
    await packageManager.installDependencies();
  }

  let automigrationResults;
  if (!skipCheck) {
    checkVersionConsistency();
    automigrationResults = await automigrate({ dryRun, yes, packageManager: pkgMgr, configDir });
  }
  if (!options.disableTelemetry) {
    const afterVersion = await getInstalledStorybookVersion(packageManager);
    const { preCheckFailure, fixResults } = automigrationResults || {};
    const automigrationTelemetry = {
      automigrationResults: preCheckFailure ? null : fixResults,
      automigrationPreCheckFailure: preCheckFailure || null,
    };
    telemetry('upgrade', {
      beforeVersion,
      afterVersion,
      ...automigrationTelemetry,
    });
  }
};

export async function upgrade(options: UpgradeOptions): Promise<void> {
  await withTelemetry('upgrade', { cliOptions: options }, () => doUpgrade(options));
}
