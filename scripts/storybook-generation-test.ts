import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

type ProjectConfig = {
  name: string;
  repo: string;
  branch?: string;
};

type StepName =
  | 'clone'
  | 'uninstall-storybook'
  | 'init-storybook'
  | 'generate-stories'
  | 'vitest-storybook';

type StepResult = {
  step: StepName;
  command: string;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
  stdout?: string;
};

type VitestSummary = {
  total: number;
  passed: number;
  failed: number;
  successRate: number;
  uniqueErrors: string[];
};

type ProjectRunResult = {
  project: ProjectConfig;
  workdir: string;
  success: boolean;
  steps: StepResult[];
  vitestSummary?: VitestSummary;
};

const filename = fileURLToPath(import.meta.url);
const __dirname = dirname(filename);

const rootDir = resolve(__dirname, '..');
const dispatcherPath = resolve(rootDir, 'code/core/dist/bin/dispatcher.js');

const defaultProjects: ProjectConfig[] = [
  {
    name: 'MealDrop',
    repo: 'https://github.com/yannbf/mealdrop',
    branch: 'without-storybook',
  },
];

function getProjectsFromEnv(): ProjectConfig[] | undefined {
  const repo = process.env.PROJECT_REPO;

  if (!repo) {
    return undefined;
  }

  const name = process.env.PROJECT_NAME || basename(repo).replace(/\.git$/, '') || 'CustomProject';

  const branch = process.env.PROJECT_BRANCH || 'main';

  return [
    {
      name,
      repo,
      branch,
    },
  ];
}

async function runStep(step: StepName, command: string, cwd: string): Promise<StepResult> {
  const start = Date.now();

  try {
    // eslint-disable-next-line no-console
    console.log(`\n➤ [${step}] ${command}`);

    const result = await execaCommand(command, {
      cwd,
      shell: true,
    });

    const durationMs = Date.now() - start;

    return {
      step,
      command,
      success: true,
      durationMs,
      stdout: result.stdout,
    };
  } catch (error) {
    const durationMs = Date.now() - start;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    const stdout =
      typeof error === 'object' &&
      error &&
      'stdout' in error &&
      typeof (error as { stdout?: unknown }).stdout === 'string'
        ? (error as { stdout?: string }).stdout
        : undefined;

    // eslint-disable-next-line no-console
    console.error(`✖ [${step}] failed: ${errorMessage}`);

    return {
      step,
      command,
      success: false,
      durationMs,
      errorMessage,
      stdout,
    };
  }
}

async function runProject(project: ProjectConfig): Promise<ProjectRunResult> {
  const branch = project.branch || 'main';

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const workdir = join(
    __dirname,
    '..',
    '..',
    'sb-experiments',
    `sb-ecosystem-${slug || 'project'}`
  );

  const steps: StepResult[] = [];

  // Ensure a clean workdir for this slug by deleting if it exists
  if (existsSync(workdir)) {
    await rm(workdir, { recursive: true, force: true });
  }

  // Clone repository
  const cloneCommand = `git clone --depth 1 --branch ${branch} ${project.repo} "${workdir}"`;
  const cloneResult = await runStep('clone', cloneCommand, rootDir);
  steps.push(cloneResult);

  // Check whether ./debug-storybook.log exists, if it does, check whether it contains [ERROR] and report it
  const debugLogPath = join(workdir, 'debug-storybook.log');
  if (existsSync(debugLogPath)) {
    const debugLogContent = await readFile(debugLogPath, { encoding: 'utf8' });
    if (debugLogContent.includes('[ERROR]')) {
      const result: ProjectRunResult = {
        project,
        workdir,
        success: false,
        steps,
      };

      await writeProjectReport(result);

      return result;
    }
  }

  if (!cloneResult.success) {
    const result: ProjectRunResult = {
      project,
      workdir,
      success: false,
      steps,
    };

    await writeProjectReport(result);

    return result;
  }

  // Uninstall Storybook from the target project
  const uninstallResult = await runStep(
    'uninstall-storybook',
    'npx @hipster/sb-utils uninstall --yes',
    workdir
  );
  steps.push(uninstallResult);

  if (!uninstallResult.success) {
    const result: ProjectRunResult = {
      project,
      workdir,
      success: false,
      steps,
    };

    await writeProjectReport(result);

    return result;
  }

  // Initialize Storybook using the dispatcher built in this monorepo
  const initCommand = `node "${dispatcherPath}" init --yes --no-dev --features test docs a11y`;
  const initResult = await runStep('init-storybook', initCommand, workdir);
  steps.push(initResult);

  if (!initResult.success) {
    const result: ProjectRunResult = {
      project,
      workdir,
      success: false,
      steps,
    };

    await writeProjectReport(result);

    return result;
  }

  // Generate stories using the Storybook CLI in the target project
  const generateStoriesCommand = `node "${dispatcherPath}" generate-stories`;
  const generateStoriesResult = await runStep('generate-stories', generateStoriesCommand, workdir);
  steps.push(generateStoriesResult);

  if (!generateStoriesResult.success) {
    const result: ProjectRunResult = {
      project,
      workdir,
      success: false,
      steps,
    };

    await writeProjectReport(result);

    return result;
  }

  // Run Vitest for the "storybook" project in the target repo
  const vitestJsonPath = join(workdir, 'vitest-report.json');

  const vitestResult = await runStep(
    'vitest-storybook',
    `npx vitest run --project=storybook --reporter=json --outputFile="${vitestJsonPath}"`,
    workdir
  );
  steps.push(vitestResult);

  const success = vitestResult.success;

  let vitestSummary: VitestSummary | undefined;

  if (existsSync(vitestJsonPath)) {
    try {
      const json = await readFile(vitestJsonPath, { encoding: 'utf8' });
      vitestSummary = parseVitestJsonReport(json) ?? undefined;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error while parsing Vitest JSON file';

      // eslint-disable-next-line no-console
      console.warn(`Failed to parse Vitest JSON report at ${vitestJsonPath}: ${errorMessage}`);
    }
  }

  const result: ProjectRunResult = {
    project,
    workdir,
    success,
    steps,
    vitestSummary,
  };

  await writeProjectReport(result);

  return result;
}

async function writeProjectReport(result: ProjectRunResult): Promise<void> {
  const { project, workdir, success, steps, vitestSummary } = result;

  const report = {
    project: {
      name: project.name,
      repo: project.repo,
      branch: project.branch || 'main',
    },
    success,
    steps: steps.map((step) => ({
      step: step.step,
      command: step.command,
      success: step.success,
      durationMs: step.durationMs,
      errorMessage: step.errorMessage,
    })),
    vitestSummary,
    generatedAt: new Date().toISOString(),
  };

  const reportPath = join(workdir, 'storybook-generation-report.json');

  try {
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error while writing project report';

    // eslint-disable-next-line no-console
    console.warn(`Failed to write Storybook generation report at ${reportPath}: ${errorMessage}`);
  }
}

function parseVitestJsonReport(jsonText: string): VitestSummary | null {
  let data: unknown;

  try {
    data = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  type JsonAssertionResult = {
    status?: string;
    failureMessages?: string[];
  };

  type JsonSuite = {
    assertionResults?: JsonAssertionResult[];
  };

  const report = data as {
    numTotalTests?: number;
    numPassedTests?: number;
    numFailedTests?: number;
    testResults?: JsonSuite[];
  };

  let total = typeof report.numTotalTests === 'number' ? report.numTotalTests : 0;
  let passed = typeof report.numPassedTests === 'number' ? report.numPassedTests : 0;
  let failed = typeof report.numFailedTests === 'number' ? report.numFailedTests : 0;

  const uniqueErrors = new Set<string>();

  if (Array.isArray(report.testResults)) {
    for (const suite of report.testResults) {
      if (!suite || !Array.isArray(suite.assertionResults)) {
        continue;
      }

      for (const assertion of suite.assertionResults) {
        if (!assertion) {
          continue;
        }

        if (!total) {
          total += 1;
        }

        if (!passed && !failed) {
          if (assertion.status === 'passed') {
            passed += 1;
          } else if (assertion.status === 'failed') {
            failed += 1;
          }
        }

        if (Array.isArray(assertion.failureMessages)) {
          for (const message of assertion.failureMessages) {
            if (typeof message === 'string' && message.trim()) {
              // Extract just the first line (error message) without stack trace
              const firstLine = message.trim().split('\n')[0].trim();
              if (firstLine) {
                uniqueErrors.add(firstLine);
              }
            }
          }
        }
      }
    }
  }

  // If the root counters were missing but we iterated tests, compute them.
  if (!report.numTotalTests && total === 0 && (passed > 0 || failed > 0)) {
    total = passed + failed;
  }

  const successRate = total > 0 ? passed / total : 0;

  return {
    total,
    passed,
    failed,
    successRate,
    uniqueErrors: Array.from(uniqueErrors),
  };
}

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1_000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

async function main() {
  const envProjects = getProjectsFromEnv();
  const projectsToRun = envProjects && envProjects.length > 0 ? envProjects : defaultProjects;

  // eslint-disable-next-line no-console
  console.log(`Running Storybook story generation tests for ${projectsToRun.length} project(s)...`);

  const results: ProjectRunResult[] = [];

  for (const project of projectsToRun) {
    // eslint-disable-next-line no-console
    console.log(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nProject: ${project.name}\nRepo:    ${
        project.repo
      }\nBranch:  ${project.branch || 'main'}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );

    // eslint-disable-next-line no-await-in-loop
    const result = await runProject(project);
    results.push(result);
  }

  // Report summary
  // eslint-disable-next-line no-console
  console.log('\n\nStorybook story generation test results:');

  for (const result of results) {
    const projectLabel = `${result.project.name} (${result.project.repo}@${
      result.project.branch || 'main'
    })`;

    // eslint-disable-next-line no-console
    console.log(`\n- ${projectLabel}`);

    for (const step of result.steps) {
      const status = step.success ? '✅' : '❌';
      const duration = formatDuration(step.durationMs);

      // eslint-disable-next-line no-console
      console.log(
        `  ${status} ${step.step} (${duration}) - ${step.command}${
          step.errorMessage ? `\n      → ${step.errorMessage}` : ''
        }`
      );
    }

    if (result.vitestSummary) {
      const { total, passed, failed, successRate, uniqueErrors } = result.vitestSummary;

      // eslint-disable-next-line no-console
      console.log(
        `  Vitest summary: total=${total}, passed=${passed}, failed=${failed}, successRate=${(
          successRate * 100
        ).toFixed(1)}%`
      );

      if (uniqueErrors.length > 0) {
        // eslint-disable-next-line no-console
        console.log('  Unique error messages:');

        for (const message of uniqueErrors) {
          // eslint-disable-next-line no-console
          console.log(`    - ${message}`);
        }
      }
    }
  }

  const hasFailure = results.some((result) => !result.success);

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await main();
