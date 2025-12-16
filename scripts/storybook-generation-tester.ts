import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path, { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLI_COLORS } from 'storybook/internal/node-logger';

import type { ComponentComplexity } from '@hipster/sb-utils/component-analyzer';
import { getComponentComplexity } from '@hipster/sb-utils/component-analyzer';
import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import picocolors from 'picocolors';
import dedent from 'ts-dedent';
import type { PackageJson } from 'type-fest';

const LOCK_FILES = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  bun: ['bun.lock', 'bun.lockb'],
} as const;

type PM = 'npm' | 'pnpm' | 'yarn' | 'bun';

function detectPackageManager(projectDir: string): PM {
  if (find.up(LOCK_FILES.yarn, { cwd: projectDir })) {
    return 'yarn';
  }
  if (find.up(LOCK_FILES.pnpm, { cwd: projectDir })) {
    return 'pnpm';
  }
  if (find.up(LOCK_FILES.npm, { cwd: projectDir })) {
    return 'npm';
  }

  if (
    find.up(LOCK_FILES.bun[0], { cwd: projectDir }) ||
    find.up(LOCK_FILES.bun[1], { cwd: projectDir })
  ) {
    return 'bun';
  }

  return 'npm';
}

function protocolFor(pm: PM): string {
  return pm === 'pnpm' ? 'link:' : 'file:';
}

async function addStorybookResolutions(projectDir: string): Promise<PackageJson> {
  const pm = detectPackageManager(projectDir);
  const protocol = protocolFor(pm);

  const packageJsonPath = join(projectDir, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw);

  const sb = '../../storybook/code';

  const resolutions = {
    '@storybook/addon-a11y': `${protocol}${sb}/addons/a11y`,
    '@storybook/addon-docs': `${protocol}${sb}/addons/docs`,
    '@storybook/addon-links': `${protocol}${sb}/addons/links`,
    '@storybook/addon-themes': `${protocol}${sb}/addons/themes`,
    '@storybook/angular': `${protocol}${sb}/frameworks/angular`,
    '@storybook/builder-vite': `${protocol}${sb}/builders/builder-vite`,
    '@storybook/builder-webpack5': `${protocol}${sb}/builders/builder-webpack5`,
    '@storybook/codemod': `${protocol}${sb}/lib/codemod`,
    'eslint-plugin-storybook': `${protocol}${sb}/lib/eslint-plugin`,
    storybook: `${protocol}${sb}/core`,
    '@storybook/core-webpack': `${protocol}${sb}/lib/core-webpack`,
    '@storybook/csf-plugin': `${protocol}${sb}/lib/csf-plugin`,
    '@storybook/ember': `${protocol}${sb}/frameworks/ember`,
    '@storybook/addon-vitest': `${protocol}${sb}/addons/vitest`,
    '@storybook/html': `${protocol}${sb}/renderers/html`,
    '@storybook/nextjs': `${protocol}${sb}/frameworks/nextjs`,
    '@storybook/preact': `${protocol}${sb}/renderers/preact`,
    '@storybook/preact-vite': `${protocol}${sb}/frameworks/preact-vite`,
    '@storybook/preset-create-react-app': `${protocol}${sb}/presets/create-react-app`,
    '@storybook/preset-react-webpack': `${protocol}${sb}/presets/react-webpack`,
    '@storybook/preset-server-webpack': `${protocol}${sb}/presets/server-webpack`,
    '@storybook/react': `${protocol}${sb}/renderers/react`,
    '@storybook/react-dom-shim': `${protocol}${sb}/lib/react-dom-shim`,
    '@storybook/react-vite': `${protocol}${sb}/frameworks/react-vite`,
    '@storybook/react-webpack5': `${protocol}${sb}/frameworks/react-webpack5`,
    '@storybook/server': `${protocol}${sb}/renderers/server`,
    '@storybook/server-webpack5': `${protocol}${sb}/frameworks/server-webpack5`,
    '@storybook/svelte': `${protocol}${sb}/renderers/svelte`,
    '@storybook/svelte-vite': `${protocol}${sb}/frameworks/svelte-vite`,
    '@storybook/sveltekit': `${protocol}${sb}/frameworks/sveltekit`,
    '@storybook/vue3': `${protocol}${sb}/renderers/vue3`,
    '@storybook/vue3-vite': `${protocol}${sb}/frameworks/vue3-vite`,
    '@storybook/web-components': `${protocol}${sb}/renderers/web-components`,
    '@storybook/web-components-vite': `${protocol}${sb}/frameworks/web-components-vite`,
  };

  if (pm === 'yarn') {
    pkg.resolutions = { ...(pkg.resolutions ?? {}), ...resolutions };
  } else if (pm === 'pnpm') {
    pkg.pnpm = pkg.pnpm ?? {};
    pkg.pnpm.overrides = { ...(pkg.pnpm.overrides ?? {}), ...resolutions };
  } else {
    pkg.overrides = { ...(pkg.overrides ?? {}), ...resolutions };
  }

  await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');

  return pkg;
}

type ProjectConfig = {
  name: string;
  repo: string;
  branch?: string;
  projectDir?: string;
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
  passing: Record<
    string,
    {
      componentPath: string;
      componentName?: string;
      storyId: string;
    }
  >;
  failing: Record<
    string,
    {
      componentPath: string;
      componentName?: string;
      storyId: string;
      message: string;
      stack: string;
    }
  >;
};

type ProjectRunResult = {
  project: ProjectConfig;
  projectDir: string;
  workdir: string;
  success: boolean;
  steps: StepResult[];
  vitestSummary?: VitestSummary;
  componentAnalysis?: ComponentAnalysisResult;
};

type ComponentWithFile = ComponentComplexity & {
  fileName: string;
  filePath: string;
  componentName?: string;
};

type ComponentAnalysisResult = {
  analyzedComponentsCount: number;
  allComponents: ComponentWithFile[];
  successfulComponents: ComponentWithFile[];
  failedComponents: ComponentWithFile[];
  errorPatterns: ErrorPattern[];
};

type ErrorPattern = {
  error: string;
  components: ComponentWithFile[];
  commonComplexityFactors: string[];
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
  // {
  //   name: 'echarts',
  //   repo: 'https://github.com/tmkx/echarts-react',
  // },
  // {
  //   name: 'baklava',
  //   repo: 'https://github.com/fortanix/baklava',
  //   branch: 'master',
  // },
  // {
  //   name: 'Primer',
  //   repo: 'https://github.com/storybook-tmp/primer-react',
  //   projectDir: 'packages/react',
  // },
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
    console.log(`\n${picocolors.bold(CLI_COLORS.info(`➤ [${step}]`))} ${command}`);

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

    console.error(picocolors.bold(CLI_COLORS.error(`✖ [${step}] failed:`)), errorMessage);

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

  console.log(`Project: ${project.name} (${project.repo}@${branch})`);

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const workdir = join(__dirname, '..', '..', 'sb-experiments', `sb-project-${slug || 'test'}`);
  const projectDir = project.projectDir ? path.join(workdir, project.projectDir) : workdir;

  const steps: StepResult[] = [];

  // Ensure a clean workdir for this slug by deleting if it exists
  await rm(workdir, { recursive: true, force: true });

  if (!existsSync(workdir)) {
    // Clone repository
    const cloneCommand = `git clone --depth 1 --branch ${branch} ${project.repo} "${workdir}"`;
    const cloneResult = await runStep('clone', cloneCommand, rootDir);
    steps.push(cloneResult);

    if (!cloneResult.success) {
      const result: ProjectRunResult = {
        project,
        workdir,
        projectDir,
        success: false,
        steps,
      };

      await writeProjectReport(result);

      return result;
    }

    // Uninstall Storybook from the target project
    const uninstallResult = await runStep(
      'uninstall-storybook',
      'npx @hipster/sb-utils@0.0.7-canary.13.8a33848.0 uninstall --yes --keep-storybook-dir',
      projectDir
    );
    steps.push(uninstallResult);

    if (!uninstallResult.success) {
      const result: ProjectRunResult = {
        project,
        workdir,
        projectDir,
        success: false,
        steps,
      };

      await writeProjectReport(result);

      return result;
    }

    await addStorybookResolutions(projectDir);

    // Initialize Storybook using the dispatcher built in this monorepo
    const initCommand = `node "${dispatcherPath}" init --disable-telemetry --yes --no-dev --features test docs a11y --type=react --logfile`;
    const initResult = await runStep('init-storybook', initCommand, projectDir);

    // Check whether ./debug-storybook.log exists, if it does, check whether it contains [ERROR] and report it
    const debugLogPath = join(projectDir, 'debug-storybook.log');
    if (existsSync(debugLogPath)) {
      const debugLogContent = await readFile(debugLogPath, { encoding: 'utf8' });
      if (debugLogContent.includes('[ERROR]')) {
        const errorMessage = `🚨 Storybook has errors, please check ${debugLogPath}\n`;
        initResult.errorMessage = [initResult.errorMessage, errorMessage]
          .filter(Boolean)
          .join('\n');
        console.error(errorMessage);
        if (!!process.env.CI) {
          console.error(debugLogContent);
        }
      }
    }
    steps.push(initResult);

    if (!initResult.success) {
      const result: ProjectRunResult = {
        project,
        workdir,
        projectDir,
        success: false,
        steps,
      };

      await writeProjectReport(result);

      return result;
    }

    const shouldTakeScreenshots = true;

    if (shouldTakeScreenshots) {
      const vitestSetupPath = join(projectDir, '.storybook/vitest.setup.ts');
      const newContent = dedent`
      import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
      import { setProjectAnnotations } from '@storybook/react-vite'
      import * as projectAnnotations from './preview'

      setProjectAnnotations([
        a11yAddonAnnotations,
        projectAnnotations,
        {
          afterEach: async ({ title, name, canvasElement, ...rest}) => {
            if (!(globalThis as any).__vitest_browser__) {
              return;
            }
            try {
              const { page } = await import('@vitest/browser/context');
              const screenshotPath = \`\${(globalThis as any).__vitest_worker__.config.root}/screenshots/\${title}/\${name}.png\`
              await page.screenshot({
                path: screenshotPath,
                element: canvasElement.firstChild,
              });
            } catch (error) {
              console.error('Error taking screenshot', error);
            }
          },
        },
      ])
      `;
      await writeFile(vitestSetupPath, newContent, 'utf8');
    }

    // Clean up example stories from Storybook
    let storiesDir = join(projectDir, 'src/stories');
    if (existsSync(storiesDir)) {
      await rm(storiesDir, { recursive: true, force: true });
    }
    storiesDir = join(projectDir, 'stories');
    if (existsSync(storiesDir)) {
      await rm(storiesDir, { recursive: true, force: true });
    }

    // Generate stories using the Storybook CLI in the target project - can also add --sample=15 to generate 15 stories
    const generateStoriesCommand = `node "${dispatcherPath}" generate-stories --force`;
    const generateStoriesResult = await runStep(
      'generate-stories',
      generateStoriesCommand,
      projectDir
    );
    steps.push(generateStoriesResult);

    if (!generateStoriesResult.success) {
      const result: ProjectRunResult = {
        project,
        workdir,
        projectDir,
        success: false,
        steps,
      };

      await writeProjectReport(result);

      return result;
    }
  } else {
    console.log(
      'Workdir already exists, skipping generation step and going straight to running tests'
    );
  }

  const vitestJsonPath = join(projectDir, 'vitest-report.json');

  const vitestResult = await runStep(
    'vitest-storybook',
    `npx vitest run --project=storybook --testTimeout=1500 --reporter=json --outputFile="${vitestJsonPath}"`,
    projectDir
  );
  steps.push(vitestResult);

  const success = vitestResult.success;

  let vitestSummary: VitestSummary | undefined;

  if (existsSync(vitestJsonPath)) {
    try {
      const json = await readFile(vitestJsonPath, { encoding: 'utf8' });
      vitestSummary = parseVitestJsonReport(json) ?? undefined;
      // write the summary into a file for debugging purposes
      await writeFile(
        join(projectDir, 'vitest-summary.json'),
        JSON.stringify(vitestSummary, null, 2),
        'utf8'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error while parsing Vitest JSON file';

      console.warn(`Failed to parse Vitest JSON report at ${vitestJsonPath}: ${errorMessage}`);
    }
  }

  // Analyze components for complexity and correlate with test results
  const componentAnalysis: ComponentAnalysisResult | undefined = vitestSummary
    ? await analyzeComplexityCorrelation(vitestSummary)
    : undefined;

  const result: ProjectRunResult = {
    project,
    workdir,
    projectDir,
    success,
    steps,
    vitestSummary,
    componentAnalysis,
  };

  await writeProjectReport(result);

  return result;
}

async function writeProjectReport(result: ProjectRunResult): Promise<void> {
  const { project, projectDir, success, steps, vitestSummary } = result;

  const report = {
    project: {
      name: project.name,
      repo: project.repo,
      branch: project.branch || 'main',
      projectDir: project.projectDir,
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

  const reportPath = join(projectDir, 'storybook-generation-report.json');

  try {
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error while writing project report';

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
    meta?: {
      storyId?: string;
      componentPath?: string;
      componentName?: string;
    };
  };

  type JsonSuite = {
    name?: string;
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

  const passing: VitestSummary['passing'] = {};
  const failing: VitestSummary['failing'] = {};

  if (Array.isArray(report.testResults)) {
    for (const suite of report.testResults) {
      if (!suite || !Array.isArray(suite.assertionResults)) {
        continue;
      }

      const suiteName = typeof suite.name === 'string' ? suite.name : undefined;

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

        const meta = assertion.meta;
        const storyId = meta && typeof meta.storyId === 'string' ? meta.storyId : '';
        const rawComponentPath =
          meta && typeof meta.componentPath === 'string' ? meta.componentPath : '';
        const componentName =
          meta && typeof meta.componentName === 'string' ? meta.componentName : undefined;

        let resolvedComponentPath = rawComponentPath;

        if (suiteName && rawComponentPath) {
          const storyDir = dirname(suiteName);

          // Normalize leading "./" or ".\" from the meta component path
          const cleaned =
            rawComponentPath.startsWith('./') || rawComponentPath.startsWith('.\\')
              ? rawComponentPath.slice(2)
              : rawComponentPath;

          // If the path already has a JS/TS extension, use it directly
          const hasExtension = /\.[jt]sx?$/.test(cleaned);

          if (hasExtension) {
            resolvedComponentPath = join(storyDir, cleaned);
          } else {
            // Try likely JS/TS extensions in order and pick the first that exists
            const candidates = ['.tsx', '.ts', '.jsx', '.js'].map((ext) =>
              join(storyDir, `${cleaned}${ext}`)
            );

            const found = candidates.find((candidate) => existsSync(candidate));

            resolvedComponentPath = found ?? join(storyDir, cleaned);
          }
        }

        if (suiteName && assertion.status === 'passed') {
          passing[suiteName] = {
            componentPath: resolvedComponentPath || rawComponentPath || '',
            componentName,
            storyId,
          };
        }

        if (suiteName && assertion.status === 'failed') {
          let message = '';
          let stack = '';

          if (Array.isArray(assertion.failureMessages) && assertion.failureMessages.length > 0) {
            const raw = assertion.failureMessages[0];
            if (typeof raw === 'string' && raw.trim()) {
              const trimmed = raw.trim();
              const [firstLine, ...rest] = trimmed.split('\n');
              message = firstLine.trim();
              stack = rest.join('\n').trim();
            }
          }

          failing[suiteName] = {
            componentPath: resolvedComponentPath || rawComponentPath || '',
            componentName,
            storyId,
            message,
            stack,
          };
        }
      }
    }
  }

  // If the root counters were missing but we iterated tests, compute them.
  if (!report.numTotalTests && total === 0 && (passed > 0 || failed > 0)) {
    total = passed + failed;
  }

  // Derive unique error messages from the failing map
  for (const failure of Object.values(failing)) {
    if (failure.message) {
      uniqueErrors.add(failure.message);
    }
  }

  const successRate = total > 0 ? passed / total : 0;

  return {
    total,
    passed,
    failed,
    successRate,
    uniqueErrors: Array.from(uniqueErrors),
    passing,
    failing,
  };
}

async function analyzeComplexityCorrelation(
  vitestSummary: VitestSummary
): Promise<ComponentAnalysisResult> {
  const components: ComponentWithFile[] = [];

  try {
    const componentPaths = new Set<string>();
    const componentNamesByPath = new Map<string, Set<string>>();

    // Collect component paths and names from passing and failing tests in the Vitest summary
    for (const entry of Object.values(vitestSummary.passing)) {
      if (entry.componentPath) {
        componentPaths.add(entry.componentPath);
        if (entry.componentName) {
          if (!componentNamesByPath.has(entry.componentPath)) {
            componentNamesByPath.set(entry.componentPath, new Set());
          }
          componentNamesByPath.get(entry.componentPath)!.add(entry.componentName);
        }
      }
    }

    for (const entry of Object.values(vitestSummary.failing)) {
      if (entry.componentPath) {
        componentPaths.add(entry.componentPath);
        if (entry.componentName) {
          if (!componentNamesByPath.has(entry.componentPath)) {
            componentNamesByPath.set(entry.componentPath, new Set());
          }
          componentNamesByPath.get(entry.componentPath)!.add(entry.componentName);
        }
      }
    }

    // Analyze each unique file once, but create separate ComponentWithFile entries for each component
    const fileAnalysisCache = new Map<string, ComponentComplexity>();

    for (const componentPath of componentPaths) {
      try {
        if (!existsSync(componentPath)) {
          continue;
        }

        // Get or compute file analysis
        let analysis = fileAnalysisCache.get(componentPath);
        if (!analysis) {
          analysis = await getComponentComplexity(componentPath);
          fileAnalysisCache.set(componentPath, analysis);
        }

        const componentNames = componentNamesByPath.get(componentPath) || new Set();

        // If no component names, create one entry for the file
        if (componentNames.size === 0) {
          components.push({
            ...analysis,
            fileName: basename(componentPath),
            filePath: componentPath,
            componentName: undefined,
          });
        } else {
          // Create separate entries for each component
          for (const componentName of componentNames) {
            components.push({
              ...analysis,
              fileName: basename(componentPath),
              filePath: componentPath,
              componentName,
            });
          }
        }
      } catch {
        console.warn(`Failed to analyze component: ${componentPath}`);
      }
    }
  } catch (error) {
    console.warn(`Failed to analyze tested components: ${error}`);
  }

  // Try to correlate actual test results with components
  const successfulComponents: ComponentWithFile[] = [];
  const failedComponents: ComponentWithFile[] = [];

  // Build a per-component pass/fail map directly from Vitest summary
  // Use composite key of componentPath + componentName for better granularity
  const componentTestMap = new Map<string, { passed: number; failed: number }>();

  for (const entry of Object.values(vitestSummary.passing)) {
    if (!entry.componentPath) {
      continue;
    }
    const key = entry.componentName
      ? `${entry.componentPath}:${entry.componentName}`
      : entry.componentPath;
    const stats = componentTestMap.get(key) ?? { passed: 0, failed: 0 };
    stats.passed += 1;
    componentTestMap.set(key, stats);
  }

  for (const entry of Object.values(vitestSummary.failing)) {
    if (!entry.componentPath) {
      continue;
    }
    const key = entry.componentName
      ? `${entry.componentPath}:${entry.componentName}`
      : entry.componentPath;
    const stats = componentTestMap.get(key) ?? { passed: 0, failed: 0 };
    stats.failed += 1;
    componentTestMap.set(key, stats);
  }

  // Calculate success/failure for each component
  for (const component of components) {
    const key = component.componentName
      ? `${component.filePath}:${component.componentName}`
      : component.filePath;

    const results = componentTestMap.get(key);
    if (results) {
      const totalTests = results.passed + results.failed;
      if (totalTests > 0) {
        const successRate = results.passed / totalTests;
        if (successRate >= 0.5) {
          successfulComponents.push(component);
        } else {
          failedComponents.push(component);
        }
      }
    }
  }

  // Error patterns based on actual failing tests and component analysis
  const errorPatterns: ErrorPattern[] = vitestSummary.uniqueErrors.map((error) => {
    // Find components that actually failed with this error
    const affectedKeys = new Set<string>();
    for (const failure of Object.values(vitestSummary.failing)) {
      if (failure.message === error && failure.componentPath) {
        const key = failure.componentName
          ? `${failure.componentPath}:${failure.componentName}`
          : failure.componentPath;
        affectedKeys.add(key);
      }
    }

    const relevantComponents = components.filter((c) => {
      const key = c.componentName ? `${c.filePath}:${c.componentName}` : c.filePath;
      return affectedKeys.has(key);
    });

    const commonFactorsSet = new Set<string>();
    for (const comp of relevantComponents) {
      for (const factor of comp.factors) {
        commonFactorsSet.add(factor);
      }
    }

    return {
      error,
      components: relevantComponents,
      commonComplexityFactors: Array.from(commonFactorsSet),
    };
  });

  const analyzedComponentsCount = components.length;

  function orderByType(arr: ComponentWithFile[]): ComponentWithFile[] {
    return arr.slice().sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  }

  return {
    analyzedComponentsCount,
    errorPatterns,
    allComponents: orderByType(components),
    successfulComponents: orderByType(successfulComponents),
    failedComponents: orderByType(failedComponents),
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

  console.log(`Running Story generation tests for ${projectsToRun.length} project(s)...`);

  const results: ProjectRunResult[] = [];

  for (const project of projectsToRun) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runProject(project);
    results.push(result);
  }

  // Report summary
  console.log(
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nStory generation research steps completed:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );

  for (const result of results) {
    const projectLabel = `${result.project.name} (${result.project.repo}@${
      result.project.branch || 'main'
    })`;

    console.log(picocolors.bold(CLI_COLORS.success(`\n➤ ${projectLabel}`)));
    if(result.workdir == result.projectDir) {
      console.log(picocolors.bold(CLI_COLORS.success(`\n  → ${result.workdir}`)));
    } else {
      console.log(picocolors.bold(CLI_COLORS.success(`\n  → ${result.workdir}`)));
      console.log(picocolors.bold(CLI_COLORS.success(`\n  → Storybook at: ${result.projectDir}`)));
    }

    for (const step of result.steps) {
      const status = step.success ? (step.errorMessage ? '⛔️' : '✅') : '❌';
      const duration = formatDuration(step.durationMs);

      console.log(
        `  ${status} ${step.step} (${duration}) - ${step.command}${
          step.errorMessage ? `\n      → ${step.errorMessage}` : ''
        }`
      );
    }
    // Success analysis with component correlation
    if (result.vitestSummary && result.componentAnalysis) {
      // Report summary
      console.log(
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nStory generation research results:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );

      const analysis = result.componentAnalysis;
      const { total, passed, failed, successRate, uniqueErrors } = result.vitestSummary;

      console.log('👉 Test results:');
      console.log(`  • total = ${total}`);
      console.log(`  • passed = ${passed}`);
      console.log(`  • failed = ${failed}`);
      console.log(`  • uniqueFailures = ${uniqueErrors.length}`);
      console.log(`  • successRate = ${(successRate * 100).toFixed(1)}%`);

      console.log('');
      console.log('📊 Component Analysis');

      if (analysis.allComponents && analysis.allComponents.length > 0) {
        console.log('');
        console.log(
          picocolors.bold(`  📋 Components sampled for testing (${analysis.allComponents.length}):`)
        );
        for (const component of analysis.allComponents) {
          const isSuccessful = analysis.successfulComponents.some(
            (successComp) =>
              successComp.filePath === component.filePath &&
              successComp.componentName === component.componentName
          );
          const statusSymbol = isSuccessful ? '✓' : '✗';
          const statusColor = isSuccessful ? picocolors.green : picocolors.red;

          console.log(`    ${statusColor(statusSymbol)} ${picocolors.bold(component.fileName)}`);
          if (component.componentName) {
            console.log(`      - component: ${component.componentName}`);
          }
          console.log(
            `      - complexity: ${component.score} (${component.level}) (${component.type})`
          );
          if (component.factors.length > 0) {
            console.log(`      - factors: ${CLI_COLORS.info(component.factors.join(', '))}`);
          }
        }
      }

      if (analysis.successfulComponents.length > 0) {
        console.log('');
        console.log(
          picocolors.bold(
            `  ✅ Success Analysis ${((analysis.successfulComponents.length / total) * 100).toFixed(1)}% (${analysis.successfulComponents.length}/${total} tests passed):`
          )
        );

        const successfulComponents = analysis.successfulComponents;

        if (successfulComponents.length > 0) {
          for (const comp of successfulComponents) {
            console.log(`    • ${picocolors.bold(comp.fileName)}`);
            if (comp.componentName) {
              console.log(`      - component: ${comp.componentName}`);
            }
            console.log(`      - complexity: ${comp.score} (${comp.level}) (${comp.type})`);
            if (comp.factors.length > 0) {
              console.log(`      - factors: ${CLI_COLORS.info(comp.factors.join(', '))}`);
            }
          }
        }

        console.log('');
      }

      if (uniqueErrors.length > 0) {
        console.log('');
        console.log(
          picocolors.bold(
            `  🚨 Error Analysis (${analysis.failedComponents.length}/${total}) - ${uniqueErrors.length} unique errors:`
          )
        );

        for (const error of uniqueErrors) {
          console.log('');
          console.log(`    ${CLI_COLORS.error(error)}`);

          // Find related error pattern
          const relatedPattern = analysis.errorPatterns.find((p) => p.error === error);
          if (relatedPattern && relatedPattern.components.length > 0) {
            console.log(
              `    Common complexity factors: ${CLI_COLORS.info(relatedPattern.commonComplexityFactors.join(', '))}`
            );
            console.log('    Affected components:');
            for (const comp of relatedPattern.components) {
              console.log(`    • ${picocolors.bold(comp.fileName)}`);
              if (comp.componentName) {
                console.log(`      - component: ${comp.componentName}`);
              }
              console.log(`      - complexity: ${comp.score} (${comp.level}) (${comp.type})`);
              if (comp.factors.length > 0) {
                console.log(`      - factors: ${CLI_COLORS.info(comp.factors.join(', '))}`);
              }
            }
          } else {
            console.log('    No specific component correlation available');
          }
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
