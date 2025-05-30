import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { temporaryFile } from 'storybook/internal/common';
import { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { cleanLog } from '../automigrate/helpers/cleanLog';
import { getStorybookData } from '../automigrate/helpers/mainConfigFile';
import { shortenPath } from '../util';
import { getDuplicatedDepsWarnings } from './getDuplicatedDepsWarnings';
import {
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from './getIncompatibleStorybookPackages';
import { getMismatchingVersionsWarnings } from './getMismatchingVersionsWarning';
import { DiagnosticType as DiagType } from './types';
import type {
  DiagnosticDoctorData,
  DiagnosticResult,
  DiagnosticType,
  DoctorCheckResult,
  DoctorOptions,
  ProjectDoctorData,
} from './types';

const LOG_FILE_NAME = 'doctor-storybook.log';
const LOG_FILE_PATH = join(process.cwd(), LOG_FILE_NAME);
let TEMP_LOG_FILE_PATH = '';

const originalStdOutWrite = process.stdout.write.bind(process.stdout);
const originalStdErrWrite = process.stderr.write.bind(process.stdout);

const augmentLogsToFile = async () => {
  TEMP_LOG_FILE_PATH = await temporaryFile({ name: LOG_FILE_NAME });
  const logStream = createWriteStream(TEMP_LOG_FILE_PATH);

  process.stdout.write = (d: string) => {
    originalStdOutWrite(d);
    return logStream.write(cleanLog(d));
  };
  process.stderr.write = (d: string) => {
    return logStream.write(cleanLog(d));
  };
};

const cleanup = () => {
  process.stdout.write = originalStdOutWrite;
  process.stderr.write = originalStdErrWrite;
};

/** Collects all diagnostic results across multiple projects */
export async function collectDoctorResultsAcrossProjects(
  projectOptions: ProjectDoctorData[]
): Promise<DiagnosticResult[]> {
  const diagnosticMap = new Map<DiagnosticType, DiagnosticResult>();

  for (const options of projectOptions) {
    try {
      const checkResults = await getDoctorDiagnostics(options);

      for (const checkResult of checkResults) {
        const existing = diagnosticMap.get(checkResult.type);
        if (existing) {
          // Add project to existing diagnostic
          existing.projects.push(checkResult.project);
        } else {
          // Create new diagnostic entry
          diagnosticMap.set(checkResult.type, {
            type: checkResult.type,
            title: checkResult.title,
            message: checkResult.message,
            projects: [checkResult.project],
          });
        }
      }
    } catch (error) {
      console.error(`Failed to run doctor checks for project ${options.configDir}:`, error);
    }
  }

  return Array.from(diagnosticMap.values());
}

/** Displays consolidated doctor results across all projects */
export function displayDoctorResults(diagnosticResults: DiagnosticResult[]): boolean {
  if (diagnosticResults.length === 0) {
    prompt.log(`🥳 Your Storybook project looks good!`);
    return false;
  }

  // Format project directories relative to git root
  const formatProjectDirs = (projects: DiagnosticDoctorData[]) => {
    const relativeDirs = projects.map((p) => {
      const relativeDir = shortenPath(p.configDir) || '.';
      return relativeDir.startsWith('/') ? relativeDir.slice(1) : relativeDir;
    });

    if (relativeDirs.length <= 3) {
      return relativeDirs.join(', ');
    }
    const remaining = relativeDirs.length - 3;
    return `${relativeDirs.slice(0, 3).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
  };

  diagnosticResults.forEach((diagnostic) => {
    const projectsText = formatProjectDirs(diagnostic.projects);
    const title = `${diagnostic.title} (${picocolors.cyan(projectsText)})`;

    prompt.logBox(diagnostic.message, { title });
  });

  const commandMessage = `You can always recheck the health of your project by running:\n${picocolors.cyan(
    'npx storybook doctor'
  )}`;

  prompt.log(commandMessage);

  return true;
}

/** Runs doctor checks across multiple projects */
export async function runMultiProjectDoctor(projects: ProjectDoctorData[]): Promise<boolean> {
  if (projects.length === 0) {
    return false;
  }

  const projectOptions: ProjectDoctorData[] = projects.map((project) => ({
    configDir: project.configDir,
    packageManager: project.packageManager,
    storybookVersion: project.storybookVersion,
    mainConfig: project.mainConfig,
  }));

  const diagnosticResults = await collectDoctorResultsAcrossProjects(projectOptions);
  return displayDoctorResults(diagnosticResults);
}

/** Doctor function that can handle both single and multiple projects */
export const doctor = async ({
  configDir: userSpecifiedConfigDir,
  packageManager: packageManagerName,
}: DoctorOptions) => {
  await augmentLogsToFile();

  prompt.log('🩺 Checking the health of your Storybook..');

  try {
    const diagnosticResults: DiagnosticResult[] = [];

    let packageManager!: JsPackageManager;
    let configDir!: string;
    let storybookVersion!: string;
    let mainConfig!: StorybookConfigRaw;

    try {
      ({ packageManager, configDir, storybookVersion, mainConfig } = await getStorybookData({
        configDir: userSpecifiedConfigDir,
        packageManagerName,
      }));
    } catch (err: any) {
      const title = 'Configuration Error';
      let message: string;

      if (err.message.includes('No configuration files have been found')) {
        message = dedent`
          Could not find or evaluate your Storybook main.js config directory at ${picocolors.blue(
            configDir || '.storybook'
          )} so the doctor command cannot proceed. You might be running this command in a monorepo or a non-standard project structure. If that is the case, please rerun this command by specifying the path to your Storybook config directory via the --config-dir option.
        `;
      } else {
        message = `❌ ${err.message}`;
      }

      diagnosticResults.push({
        type: DiagType.CONFIGURATION_ERROR,
        title,
        message,
        projects: [{ configDir }],
      });
    }

    const doctorResults = await collectDoctorResultsAcrossProjects([
      {
        configDir,
        packageManager,
        storybookVersion,
        mainConfig,
      },
    ]);

    diagnosticResults.push(...doctorResults);

    const foundIssues = displayDoctorResults(diagnosticResults);

    // if diagnosis found issues, display a log file in the users cwd
    if (foundIssues) {
      prompt.log(`Full logs are available in ${picocolors.cyan(LOG_FILE_PATH)}`);
      await rename(TEMP_LOG_FILE_PATH, join(process.cwd(), LOG_FILE_NAME));
    } else {
      await rm(TEMP_LOG_FILE_PATH, { recursive: true, force: true });
    }
  } catch (error) {
    prompt.error('Doctor failed:' + String(error));
    await rename(TEMP_LOG_FILE_PATH, join(process.cwd(), LOG_FILE_NAME));
  }

  cleanup();
};

/** Gets doctor diagnostic results for a single project */
export async function getDoctorDiagnostics({
  configDir,
  packageManager,
  storybookVersion,
  mainConfig,
}: {
  configDir: string;
  packageManager: JsPackageManager;
  storybookVersion: string;
  mainConfig: StorybookConfigRaw;
}): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  if (!storybookVersion) {
    results.push({
      type: DiagType.CONFIGURATION_ERROR,
      title: 'Version Detection Failed',
      message: dedent`
        ❌ Unable to determine Storybook version so the command will not proceed.
        🤔 Are you running storybook doctor from your project directory? Please specify your Storybook config directory with the --config-dir flag.
      `,
      project: { configDir },
    });
    return results;
  }

  if (!mainConfig) {
    results.push({
      type: DiagType.CONFIGURATION_ERROR,
      title: 'Main Config Error',
      message: 'mainConfig is undefined',
      project: { configDir },
    });
    return results;
  }

  // Check for missing storybook dependency
  const hasStorybookDependency = packageManager.packageJsonPaths.some(
    JsPackageManager.hasStorybookDependency
  );

  if (!hasStorybookDependency) {
    results.push({
      type: DiagType.MISSING_STORYBOOK_DEPENDENCY,
      title: `Package ${picocolors.cyan('storybook')} not found`,
      message: dedent`
        The ${picocolors.cyan('storybook')} package was not found in your package.json.
        Installing ${picocolors.cyan('storybook')} as a direct dev dependency in your package.json is required.
      `,
      project: { configDir },
    });
  }

  // Check for incompatible packages
  const incompatibleStorybookPackagesList = await getIncompatibleStorybookPackages({
    currentStorybookVersion: storybookVersion,
    packageManager,
  });
  const incompatiblePackagesMessage = getIncompatiblePackagesSummary(
    incompatibleStorybookPackagesList,
    storybookVersion
  );

  if (incompatiblePackagesMessage) {
    results.push({
      type: DiagType.INCOMPATIBLE_PACKAGES,
      title: 'Incompatible packages found',
      message: incompatiblePackagesMessage,
      project: { configDir },
    });
  }

  const allDependencies = packageManager.getAllDependencies() as Record<string, string>;
  const installationMetadata = await packageManager.findInstallations([
    '@storybook/*',
    'storybook',
  ]);

  // If we found incompatible packages, we let the users fix that first
  // If they run doctor again and there are still issues, we show the other warnings
  if (!incompatiblePackagesMessage) {
    const mismatchingVersionMessage = getMismatchingVersionsWarnings(
      installationMetadata,
      allDependencies
    );

    if (mismatchingVersionMessage) {
      results.push({
        type: DiagType.MISMATCHING_VERSIONS,
        title: 'Diagnostics',
        message: mismatchingVersionMessage,
        project: { configDir },
      });
    } else {
      const list = installationMetadata
        ? getDuplicatedDepsWarnings(installationMetadata)
        : getDuplicatedDepsWarnings();

      if (Array.isArray(list) && list.length > 0) {
        results.push({
          type: DiagType.DUPLICATED_DEPENDENCIES,
          title: 'Duplicated dependencies found',
          message: list.join('\n'),
          project: { configDir },
        });
      }
    }
  }

  return results;
}
