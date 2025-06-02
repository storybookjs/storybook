import { JsPackageManager } from 'storybook/internal/common';
import { logTracker, prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile';
import { shortenPath } from '../util';
import { getDuplicatedDepsWarnings } from './getDuplicatedDepsWarnings';
import {
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from './getIncompatibleStorybookPackages';
import { getMismatchingVersionsWarnings } from './getMismatchingVersionsWarning';
import { DiagnosticType as DiagType, DiagnosticStatus } from './types';
import type {
  DiagnosticResult,
  DiagnosticType,
  DoctorCheckResult,
  DoctorOptions,
  ProjectDoctorData,
  ProjectDoctorResults,
} from './types';

/** Displays project-based doctor results (similar to automigration pattern) */
export function displayDoctorResults(
  projectResults: Record<string, ProjectDoctorResults>
): boolean {
  const projectCount = Object.keys(projectResults).length;

  if (projectCount === 0) {
    return false;
  }

  const hasAnyIssues = Object.values(projectResults).some((result) => result.status !== 'healthy');

  if (!hasAnyIssues) {
    if (projectCount === 1) {
      prompt.log(`🥳 Your Storybook project looks good!`);
    } else {
      prompt.log(`🥳 All ${projectCount} Storybook projects look good!`);
    }
    return false;
  }

  // Display results for each project
  Object.entries(projectResults).forEach(([configDir, result]) => {
    const projectName = picocolors.cyan(shortenPath(configDir) || '.');

    if (result.status === 'healthy') {
      prompt.log(`✅ ${projectName}: No issues found`);
    } else {
      const issueCount = Object.values(result.diagnostics).filter(
        (status) => status !== DiagnosticStatus.PASSED
      ).length;
      if (result.status == 'error') {
        prompt.error(`${projectName}: ${issueCount} problem(s) found`);
      } else {
        prompt.warn(`${projectName}: ${issueCount} issue(s) found`);
      }

      // Display each diagnostic issue
      Object.entries(result.diagnostics).forEach(([type, status]) => {
        if (status !== DiagnosticStatus.PASSED) {
          const message = result.messages[type as DiagnosticType];
          if (message) {
            prompt.logBox(message, {
              title: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            });
          }
        }
      });
    }
  });

  const commandMessage = `You can always recheck the health of your project(s) by running:\n${picocolors.cyan(
    'npx storybook doctor'
  )}`;

  prompt.log(commandMessage);

  return true;
}

/** Runs doctor checks across multiple projects */
export async function runMultiProjectDoctor(
  projects: ProjectDoctorData[]
): Promise<Record<string, ProjectDoctorResults>> {
  if (projects.length === 0) {
    return {};
  }

  const projectOptions: ProjectDoctorData[] = projects.map((project) => ({
    configDir: project.configDir,
    packageManager: project.packageManager,
    storybookVersion: project.storybookVersion,
    mainConfig: project.mainConfig,
  }));

  // Always return the project-based results structure
  return await collectDoctorResultsByProject(projectOptions);
}

/** Doctor function that can handle both single and multiple projects */
export const doctor = async ({
  configDir: userSpecifiedConfigDir,
  packageManager: packageManagerName,
}: DoctorOptions) => {
  prompt.step('🩺 Checking the health of your Storybook..');

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

  const doctorResults = await collectDoctorResultsByProject([
    {
      configDir,
      packageManager,
      storybookVersion,
      mainConfig,
    },
  ]);

  const foundIssues = displayDoctorResults(doctorResults);

  if (foundIssues) {
    logTracker.enableLogWriting();
  }
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

export async function collectDoctorResultsByProject(
  projectOptions: ProjectDoctorData[]
): Promise<Record<string, ProjectDoctorResults>> {
  const projectResults: Record<string, ProjectDoctorResults> = {};

  for (const options of projectOptions) {
    const { configDir } = options;

    try {
      const checkResults = await getDoctorDiagnostics(options);

      const diagnostics: Record<DiagnosticType, DiagnosticStatus> = {} as Record<
        DiagnosticType,
        DiagnosticStatus
      >;
      const messages: Record<DiagnosticType, string> = {} as Record<DiagnosticType, string>;

      // Initialize all diagnostic types as passed
      Object.values(DiagType).forEach((type) => {
        diagnostics[type] = DiagnosticStatus.PASSED;
      });

      let hasIssues = false;
      let hasErrors = false;

      // Process each check result
      for (const checkResult of checkResults) {
        if (checkResult.type === DiagType.CONFIGURATION_ERROR) {
          diagnostics[checkResult.type] = DiagnosticStatus.ERROR;
          hasErrors = true;
        } else {
          diagnostics[checkResult.type] = DiagnosticStatus.FAILED;
          hasIssues = true;
        }
        messages[checkResult.type] = checkResult.message;
      }

      const status = hasErrors ? 'error' : hasIssues ? 'issues' : 'healthy';

      projectResults[configDir] = {
        configDir,
        status,
        diagnostics,
        messages,
      };
    } catch (error) {
      console.error(`Failed to run doctor checks for project ${configDir}:`, error);

      // Mark as error state
      const diagnostics: Record<DiagnosticType, DiagnosticStatus> = {} as Record<
        DiagnosticType,
        DiagnosticStatus
      >;
      const messages: Record<DiagnosticType, string> = {} as Record<DiagnosticType, string>;

      Object.values(DiagType).forEach((type) => {
        diagnostics[type] = DiagnosticStatus.PASSED;
      });

      diagnostics[DiagType.CONFIGURATION_ERROR] = DiagnosticStatus.ERROR;
      messages[DiagType.CONFIGURATION_ERROR] =
        `Failed to run doctor checks: ${error instanceof Error ? error.message : String(error)}`;

      projectResults[configDir] = {
        configDir,
        status: 'error',
        diagnostics,
        messages,
      };
    }
  }

  return projectResults;
}
