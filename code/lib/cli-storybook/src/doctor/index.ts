import { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logTracker, logger } from 'storybook/internal/node-logger';
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

/** Collects deduplicated diagnostic results across multiple projects */
export function collectDeduplicatedDiagnostics(
  projectResults: Record<string, ProjectDoctorResults>
): DiagnosticResult[] {
  const diagnosticMap = new Map<DiagnosticType, DiagnosticResult>();

  Object.entries(projectResults).forEach(([configDir, result]) => {
    Object.entries(result.diagnostics).forEach(([type, status]) => {
      if (status !== DiagnosticStatus.PASSED) {
        const diagnosticType = type as DiagnosticType;
        const message = result.messages[diagnosticType];

        if (message) {
          const existing = diagnosticMap.get(diagnosticType);
          if (existing) {
            // Add project to existing diagnostic
            existing.projects.push({ configDir });
          } else {
            // Create new diagnostic entry
            diagnosticMap.set(diagnosticType, {
              type: diagnosticType,
              title: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
              message,
              projects: [{ configDir }],
            });
          }
        }
      }
    });
  });

  return Array.from(diagnosticMap.values());
}

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
      logger.log(`Your Storybook project looks good!`);
    } else {
      logger.log(`All ${projectCount} Storybook projects look good!`);
    }
    return false;
  }

  // For single project, display per-project results
  if (projectCount === 1) {
    const [configDir, result] = Object.entries(projectResults)[0];
    const projectName = shortenPath(configDir) || '.';

    if (result.status === 'healthy') {
      logger.log(`✅ ${projectName}: No issues found`);
    } else {
      const issueCount = Object.values(result.diagnostics).filter(
        (status) => status !== DiagnosticStatus.PASSED
      ).length;
      if (result.status === 'check_error') {
        logger.error(
          `${projectName}: ${issueCount} ${issueCount === 1 ? 'problem' : 'problems'} found`
        );
      } else {
        logger.warn(`${projectName}: ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'} found`);
      }

      // Display each diagnostic issue
      Object.entries(result.diagnostics).forEach(([type, status]) => {
        if (status !== DiagnosticStatus.PASSED) {
          const message = result.messages[type as DiagnosticType];
          if (message) {
            const title = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            logger.logBox(message, {
              title:
                status === DiagnosticStatus.CHECK_ERROR
                  ? CLI_COLORS.error(title)
                  : CLI_COLORS.warning(title),
            });
          }
        }
      });
    }
  } else {
    // For multiple projects, use deduplicated approach
    const deduplicatedDiagnostics = collectDeduplicatedDiagnostics(projectResults);

    const totalIssues = deduplicatedDiagnostics.length;
    const errorCount = Object.values(projectResults).filter(
      (result) => result.status === 'check_error'
    ).length;

    if (errorCount > 0) {
      logger.error(
        `Found ${totalIssues} ${totalIssues === 1 ? 'issue' : 'issues'} across ${projectCount} projects`
      );
    } else {
      logger.warn(
        `Found ${totalIssues} ${totalIssues === 1 ? 'issue' : 'issues'} across ${projectCount} projects`
      );
    }

    // Display deduplicated diagnostics
    deduplicatedDiagnostics.forEach((diagnostic) => {
      let messageWithProjects = diagnostic.message;

      if (diagnostic.projects.length > 1) {
        const projectNames = diagnostic.projects
          .map((p) => shortenPath(p.configDir) || '.')
          .join(', ');
        messageWithProjects += `\n\nAffected projects: ${projectNames}`;
      } else {
        const projectName = shortenPath(diagnostic.projects[0].configDir) || '.';
        messageWithProjects += `\n\nAffected project: ${projectName}`;
      }

      logger.logBox(messageWithProjects, {
        title: CLI_COLORS.warning(diagnostic.title),
      });
    });
  }

  logger.step('Storybook doctor is complete!');

  const commandMessage = `You can always recheck the health of your project(s) by running:\n${picocolors.cyan(
    'npx storybook doctor'
  )}`;

  logger.log(commandMessage);

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
  logger.step('Checking the health of your Storybook..');

  const diagnosticResults: DiagnosticResult[] = [];

  let packageManager!: JsPackageManager;
  let configDir!: string;
  let versionInstalled: string | undefined;
  let mainConfig!: StorybookConfigRaw;

  try {
    ({ packageManager, configDir, versionInstalled, mainConfig } = await getStorybookData({
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
      storybookVersion: versionInstalled,
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
  storybookVersion?: string;
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
      title: `Package "storybook" not found`,
      message: dedent`
        The "storybook" package was not found in your package.json.
        Installing "storybook" as a direct dev dependency in your package.json is required.
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

  const installationMetadata = await packageManager.findInstallations([
    '@storybook/*',
    'storybook',
  ]);

  // If we found incompatible packages, we let the users fix that first
  // If they run doctor again and there are still issues, we show the other warnings
  if (!incompatiblePackagesMessage) {
    const mismatchingVersionMessage = getMismatchingVersionsWarnings(installationMetadata);

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
          diagnostics[checkResult.type] = DiagnosticStatus.CHECK_ERROR;
          hasErrors = true;
        } else {
          diagnostics[checkResult.type] = DiagnosticStatus.HAS_ISSUES;
          hasIssues = true;
        }
        messages[checkResult.type] = checkResult.message;
      }

      const status = hasErrors ? 'check_error' : hasIssues ? 'has_issues' : 'healthy';

      projectResults[configDir] = {
        configDir,
        status,
        diagnostics,
        messages,
      };
    } catch (error) {
      logger.error(`Failed to run doctor checks for project ${configDir}:\n${error}`);

      // Mark as error state
      const diagnostics: Record<DiagnosticType, DiagnosticStatus> = {} as Record<
        DiagnosticType,
        DiagnosticStatus
      >;
      const messages: Record<DiagnosticType, string> = {} as Record<DiagnosticType, string>;

      Object.values(DiagType).forEach((type) => {
        diagnostics[type] = DiagnosticStatus.PASSED;
      });

      diagnostics[DiagType.CONFIGURATION_ERROR] = DiagnosticStatus.CHECK_ERROR;
      messages[DiagType.CONFIGURATION_ERROR] =
        `Failed to run doctor checks: ${error instanceof Error ? error.message : String(error)}`;

      projectResults[configDir] = {
        configDir,
        status: 'check_error',
        diagnostics,
        messages,
      };
    }
  }

  return projectResults;
}
