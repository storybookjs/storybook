import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import { x } from 'tinyexec';

import { ROOT_DIRECTORY } from '../../utils/constants';
import { getBenchmarkById } from './benchmarks';
import { selectCandidateComponents } from './candidate-components';
import { executeAgent } from './agents';
import { resolveModel } from './models';
import { detectSetupPatterns } from './setup-patterns';
import type {
  AgentName,
  BenchmarkProject,
  ChangedFileSummary,
  CleanupSummary,
  CommandRecord,
  EvalResult,
  GhostStoriesResult,
  PackageManager,
  PackageJsonCleanup,
  PreparedProject,
  PromptVariant,
  RunOptions,
  StepResult,
} from './types';
import { getVariantById } from './variants';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIRECTORY = join(__dirname, 'prompts');

const DEFAULT_WORKSPACE_ROOT = resolve(ROOT_DIRECTORY, '../storybook-setup-evals');
const STORYBOOK_STARTER_FILES = new Set([
  'Button.tsx',
  'Button.stories.ts',
  'Button.stories.tsx',
  'button.tsx',
  'button.stories.ts',
  'button.stories.tsx',
  'Header.tsx',
  'Header.stories.ts',
  'Header.stories.tsx',
  'header.tsx',
  'header.stories.ts',
  'header.stories.tsx',
  'Page.tsx',
  'Page.stories.ts',
  'Page.stories.tsx',
  'page.tsx',
  'page.stories.ts',
  'page.stories.tsx',
]);

type TrialPaths = {
  trialDir: string;
  repoDir: string;
  logsDir: string;
  artifactsDir: string;
  promptPath: string;
  resultPath: string;
  tempDir: string;
};

function createTrialId(
  benchmarkId: string,
  variantId: string,
  agent: AgentName,
  model: string,
  timestamp = new Date()
) {
  const iso = timestamp.toISOString().slice(0, 19).replace(/[:]/g, '-');
  return `${iso}-${benchmarkId}-${variantId}-${agent}-${model.replace(/[^\w.-]/g, '-')}`;
}

async function ensureDir(pathName: string) {
  await mkdir(pathName, { recursive: true });
}

function getWorkspaceRoot(workspaceRoot?: string) {
  return resolve(workspaceRoot ?? DEFAULT_WORKSPACE_ROOT);
}

async function runCommand(
  name: string,
  logsDir: string,
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>
): Promise<CommandRecord> {
  const logPath = join(logsDir, `${name}.log`);
  const startedAt = Date.now();
  const result = await x(command, args, {
    nodeOptions: {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
    },
  });
  const durationMs = Date.now() - startedAt;

  await writeFile(logPath, `${result.stdout}${result.stderr}`);

  if (result.exitCode !== 0) {
    throw new Error(
      `${name} failed with exit code ${result.exitCode}. See ${logPath} for details.`
    );
  }

  return {
    name,
    command: [command, ...args].join(' '),
    cwd,
    durationMs,
    exitCode: result.exitCode,
    logPath,
  };
}

async function detectCliVersion(binary: string) {
  try {
    const result = await x(binary, ['--version']);
    if (result.exitCode !== 0) {
      return undefined;
    }
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

function detectPackageManager(repoRoot: string): PackageManager {
  if (existsSync(join(repoRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (existsSync(join(repoRoot, 'yarn.lock')) || existsSync(join(repoRoot, '.yarnrc.yml'))) {
    return 'yarn';
  }

  return 'npm';
}

function getInstallCommand(packageManager: PackageManager): [string, string[]] {
  switch (packageManager) {
    case 'pnpm':
      return ['pnpm', ['install']];
    case 'yarn':
      return ['yarn', ['install']];
    default:
      return ['npm', ['install']];
  }
}

async function findPackageJsonFiles(repoRoot: string) {
  return glob('**/package.json', {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  });
}

function isStorybookDependency(name: string) {
  return name === 'storybook' || name.startsWith('@storybook/') || name === 'eslint-plugin-storybook';
}

async function removeStorybookFromPackageJson(filePath: string): Promise<PackageJsonCleanup | undefined> {
  const packageJson = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
  const removedDependencies: string[] = [];
  const removedScripts: string[] = [];

  for (const sectionName of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const section = packageJson[sectionName];
    if (!section || typeof section !== 'object') {
      continue;
    }

    for (const dependencyName of Object.keys(section)) {
      if (!isStorybookDependency(dependencyName)) {
        continue;
      }

      delete (section as Record<string, unknown>)[dependencyName];
      removedDependencies.push(`${sectionName}:${dependencyName}`);
    }
  }

  if (packageJson.scripts && typeof packageJson.scripts === 'object') {
    for (const scriptName of Object.keys(packageJson.scripts as Record<string, unknown>)) {
      if (!scriptName.includes('storybook')) {
        continue;
      }

      delete (packageJson.scripts as Record<string, unknown>)[scriptName];
      removedScripts.push(scriptName);
    }
  }

  if (removedDependencies.length === 0 && removedScripts.length === 0) {
    return undefined;
  }

  await writeFile(filePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  return {
    path: filePath,
    removedDependencies,
    removedScripts,
  };
}

async function maybeRemoveStarterStoriesDirectory(directoryPath: string) {
  if (!existsSync(directoryPath)) {
    return false;
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  if (entries.length === 0) {
    await rm(directoryPath, { recursive: true, force: true });
    return true;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'assets') {
      return false;
    }

    if (entry.isDirectory()) {
      continue;
    }

    if (!STORYBOOK_STARTER_FILES.has(entry.name)) {
      return false;
    }
  }

  await rm(directoryPath, { recursive: true, force: true });
  return true;
}

async function cleanupStorybookFiles(repoRoot: string): Promise<CleanupSummary> {
  const removedFiles: string[] = [];
  const removedDirectories: string[] = [];
  const updatedPackageJsons: PackageJsonCleanup[] = [];

  for (const filePath of await glob('**/*.{stories,story}.{js,jsx,ts,tsx,mdx}', {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  })) {
    await rm(filePath, { force: true });
    removedFiles.push(filePath);
  }

  for (const directoryPath of await glob('**/.storybook', {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  })) {
    await rm(directoryPath, { recursive: true, force: true });
    removedDirectories.push(directoryPath);
  }

  for (const directoryPath of await glob('**/storybook-static', {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  })) {
    await rm(directoryPath, { recursive: true, force: true });
    removedDirectories.push(directoryPath);
  }

  for (const starterDirectory of [
    join(repoRoot, 'stories'),
    join(repoRoot, 'src', 'stories'),
    join(repoRoot, 'packages', 'lib', 'stories'),
  ]) {
    if (await maybeRemoveStarterStoriesDirectory(starterDirectory)) {
      removedDirectories.push(starterDirectory);
    }
  }

  for (const packageJsonPath of await findPackageJsonFiles(repoRoot)) {
    const cleanup = await removeStorybookFromPackageJson(packageJsonPath);
    if (cleanup) {
      updatedPackageJsons.push(cleanup);
    }
  }

  return {
    removedFiles: removedFiles.sort(),
    removedDirectories: removedDirectories.sort(),
    updatedPackageJsons: updatedPackageJsons.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

async function getChangedFiles(repoRoot: string, baselineCommit: string): Promise<ChangedFileSummary[]> {
  const statusResult = await x('git', ['diff', '--name-status', baselineCommit], {
    nodeOptions: { cwd: repoRoot },
  });
  const summaries: ChangedFileSummary[] = [];

  for (const line of statusResult.stdout.split('\n').filter(Boolean)) {
    const [rawStatus, ...fileParts] = line.split('\t');
    const filePath = fileParts.at(-1);
    if (!rawStatus || !filePath) {
      continue;
    }

    const numstat = await x('git', ['diff', '--numstat', baselineCommit, '--', filePath], {
      nodeOptions: { cwd: repoRoot },
    });
    const [added, removed] = (numstat.stdout.split('\t') || []) as [string?, string?];

    summaries.push({
      path: filePath,
      status: rawStatus[0] as ChangedFileSummary['status'],
      addedLines: Number(added) || 0,
      removedLines: Number(removed) || 0,
    });
  }

  return summaries.sort((left, right) => left.path.localeCompare(right.path));
}

function filterStorybookFiles(files: ChangedFileSummary[]) {
  return files.filter((entry) => {
    return (
      entry.path.includes('.storybook/') ||
      entry.path.includes('storybook/') ||
      entry.path.includes('preview.') ||
      entry.path.includes('manager.') ||
      entry.path.includes('.stories.') ||
      entry.path.includes('.story.')
    );
  });
}

async function buildPrompt(
  variant: PromptVariant,
  benchmark: BenchmarkProject,
  projectRoot: string,
  targetDirLabel: string,
  candidateComponents: Array<{ path: string; complexity: number }>
) {
  const promptParts: string[] = [];

  for (const promptFile of variant.promptFiles) {
    const promptPath = join(PROMPTS_DIRECTORY, promptFile);
    promptParts.push(await readFile(promptPath, 'utf8'));
  }

  const candidateList =
    candidateComponents.length === 0
      ? '- No obvious candidate components were detected automatically. Inspect the project and choose representative components yourself.'
      : candidateComponents
          .map((candidate, index) => {
            const relativePath = relative(projectRoot, candidate.path);
            return `${index + 1}. ${relativePath} (complexity ${candidate.complexity})`;
          })
          .join('\n');

  promptParts.push(`
<benchmark_context>
- Benchmark project: ${benchmark.name}
- Repository: ${benchmark.repo}
- Repository branch: ${benchmark.branch ?? 'default'}
- Target project directory: ${targetDirLabel}
- Repository tags: ${benchmark.tags.join(', ')}
- A clean \`npx storybook@latest init --yes\` has already been run. Do not rerun \`storybook init\`.
- Keep the work focused on making Storybook usable for the real application code, not the demo files generated by init.
</benchmark_context>

<candidate_components>
${candidateList}
</candidate_components>
`.trim());

  return `${promptParts.join('\n\n')}\n`;
}

async function cloneBenchmark(
  benchmark: BenchmarkProject,
  trialPaths: TrialPaths,
  logsDir: string
): Promise<string> {
  const args = ['clone', '--depth', '1'];
  if (benchmark.branch) {
    args.push('--branch', benchmark.branch);
  }
  args.push(benchmark.repo, trialPaths.repoDir);

  await runCommand('clone', logsDir, 'git', args, dirname(trialPaths.repoDir));
  return trialPaths.repoDir;
}

async function captureGitCommit(repoRoot: string) {
  const commit = await x('git', ['rev-parse', 'HEAD'], {
    nodeOptions: { cwd: repoRoot },
  });
  return commit.stdout.trim();
}

async function createBaselineCommit(repoRoot: string, logsDir: string) {
  await runCommand('git-add-baseline', logsDir, 'git', ['add', '-A'], repoRoot);
  await runCommand(
    'git-commit-baseline',
    logsDir,
    'git',
    [
      '-c',
      'user.name=storybook-eval',
      '-c',
      'user.email=storybook-eval@example.com',
      'commit',
      '--no-gpg-sign',
      '-m',
      'eval baseline after storybook init',
    ],
    repoRoot
  );
  return captureGitCommit(repoRoot);
}

async function prepareProject(
  benchmark: BenchmarkProject,
  trialPaths: TrialPaths
): Promise<PreparedProject> {
  await ensureDir(trialPaths.trialDir);
  await ensureDir(dirname(trialPaths.repoDir));
  await ensureDir(trialPaths.logsDir);
  await ensureDir(trialPaths.artifactsDir);
  await ensureDir(trialPaths.tempDir);

  const repoRoot = await cloneBenchmark(benchmark, trialPaths, trialPaths.logsDir);
  const packageManager = detectPackageManager(repoRoot);
  const projectRoot = resolve(repoRoot, benchmark.projectDir ?? '.');
  const targetDirLabel = relative(repoRoot, projectRoot) || '.';

  const cleanup = await cleanupStorybookFiles(repoRoot);

  const [installCommandName, installArgs] = getInstallCommand(packageManager);
  const installEnv = {
    CI: '1',
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  };
  const install = await runCommand(
    'install',
    trialPaths.logsDir,
    installCommandName,
    installArgs,
    repoRoot,
    installEnv
  );

  const init = await runCommand(
    'storybook-init',
    trialPaths.logsDir,
    'npx',
    ['storybook@latest', 'init', '--yes'],
    projectRoot,
    { CI: '1' }
  );

  const postInitInstall = await runCommand(
    'post-init-install',
    trialPaths.logsDir,
    installCommandName,
    installArgs,
    repoRoot,
    installEnv
  );

  const candidateComponents = await selectCandidateComponents(projectRoot);
  const baselineCommit = await createBaselineCommit(repoRoot, trialPaths.logsDir);

  return {
    benchmark,
    packageManager,
    repoRoot,
    projectRoot,
    targetDirLabel,
    candidateComponents,
    cleanup,
    install,
    init,
    postInitInstall,
    baselineCommit,
  };
}

async function createBaselineWorktree(
  repoRoot: string,
  baselineCommit: string,
  trialPaths: TrialPaths
) {
  const baselineDir = join(trialPaths.tempDir, 'baseline-worktree');
  await runCommand(
    'git-worktree-baseline',
    trialPaths.logsDir,
    'git',
    ['worktree', 'add', '--detach', baselineDir, baselineCommit],
    repoRoot
  );
  return baselineDir;
}

async function createFinalCopy(preparedProject: PreparedProject, trialPaths: TrialPaths) {
  const finalDir = join(trialPaths.tempDir, 'final-copy');
  await cp(preparedProject.repoRoot, finalDir, {
    recursive: true,
    filter: (source) => {
      const relativePath = relative(preparedProject.repoRoot, source);
      return !relativePath.startsWith('.git') && !relativePath.startsWith('node_modules');
    },
  });
  return finalDir;
}

async function ensureAddonVitest(projectRoot: string, logsDir: string, label: string) {
  const mainConfigCandidates = await glob('.storybook/main.@(js|ts|mjs|cjs)', {
    cwd: projectRoot,
    absolute: true,
  });
  const mainConfigPath = mainConfigCandidates[0];
  const mainConfig = mainConfigPath ? await readFile(mainConfigPath, 'utf8') : '';
  if (mainConfig.includes('@storybook/addon-vitest')) {
    return;
  }

  await runCommand(
    `${label}-addon-vitest`,
    logsDir,
    'npx',
    ['storybook@latest', 'add', '@storybook/addon-vitest', '--yes'],
    projectRoot,
    { CI: '1' }
  );
}

async function getStorybookBuildRunner(
  projectRoot: string,
  packageManager: PackageManager
): Promise<[string, string[]]> {
  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    if (packageJson.scripts?.['build-storybook']) {
      switch (packageManager) {
        case 'pnpm':
          return ['pnpm', ['run', 'build-storybook']];
        case 'yarn':
          return ['yarn', ['build-storybook']];
        default:
          return ['npm', ['run', 'build-storybook']];
      }
    }
  }

  return ['npx', ['--no-install', 'storybook', 'build']];
}

async function runGhostStories(
  _repoRoot: string,
  projectRoot: string,
  logsDir: string,
  label: string
): Promise<GhostStoriesResult> {
  try {
    await ensureAddonVitest(projectRoot, logsDir, label);
  } catch (error) {
    return {
      status: 'skipped',
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const candidatesModule = await import(
      pathToFileURL(
        resolve(ROOT_DIRECTORY, 'code/core/src/core-server/utils/ghost-stories/get-candidates.ts')
      ).href
    );
    const runStoryTestsModule = await import(
      pathToFileURL(
        resolve(ROOT_DIRECTORY, 'code/core/src/core-server/utils/ghost-stories/run-story-tests.ts')
      ).href
    );

    const previousCwd = process.cwd();
    process.chdir(projectRoot);

    try {
      const candidatesResult = await candidatesModule.getComponentCandidates({ sampleSize: 20 });
      if (candidatesResult.error) {
        return {
          status: 'failed',
          reason: candidatesResult.error,
          summary: {
            candidateCount: candidatesResult.candidates.length,
            analyzedCount: candidatesResult.analyzedCount,
            avgComplexity: candidatesResult.avgComplexity,
            runError: candidatesResult.error,
          },
        };
      }

      if (candidatesResult.candidates.length === 0) {
        return {
          status: 'skipped',
          reason: 'No candidate components found for ghost-stories.',
          summary: {
            candidateCount: 0,
            analyzedCount: candidatesResult.analyzedCount,
            avgComplexity: candidatesResult.avgComplexity,
          },
        };
      }

      const runResult = await runStoryTestsModule.runStoryTests(candidatesResult.candidates);
      return {
        status: runResult.runError ? 'failed' : 'passed',
        reason: runResult.runError,
        summary: {
          candidateCount: candidatesResult.candidates.length,
          analyzedCount: candidatesResult.analyzedCount,
          avgComplexity: candidatesResult.avgComplexity,
          total: runResult.summary?.total,
          passed: runResult.summary?.passed,
          passedButEmptyRender: runResult.summary?.passedButEmptyRender,
          successRate: runResult.summary?.successRate,
          successRateWithoutEmptyRender: runResult.summary?.successRateWithoutEmptyRender,
          uniqueErrorCount: runResult.summary?.uniqueErrorCount,
          categorizedErrors: runResult.summary?.categorizedErrors,
          runError: runResult.runError,
        },
      };
    } finally {
      process.chdir(previousCwd);
    }
  } catch (error) {
    return {
      status: 'skipped',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runStorybookBuild(
  projectRoot: string,
  packageManager: PackageManager,
  logsDir: string
): Promise<StepResult> {
  try {
    const [commandName, commandArgs] = await getStorybookBuildRunner(projectRoot, packageManager);
    const command = await runCommand(
      'storybook-build',
      logsDir,
      commandName,
      commandArgs,
      projectRoot,
      { CI: '1' }
    );
    return {
      status: 'passed',
      command,
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readInterestingFiles(repoRoot: string, changedFiles: ChangedFileSummary[]) {
  const interestingFiles = changedFiles
    .map((entry) => join(repoRoot, entry.path))
    .filter((filePath) => {
      const lower = filePath.toLowerCase();
      return (
        lower.includes('.storybook/') ||
        lower.endsWith('package.json') ||
        lower.includes('preview.') ||
        lower.includes('manager.') ||
        lower.includes('.stories.') ||
        lower.includes('.story.') ||
        lower.endsWith('.css') ||
        lower.endsWith('.scss')
      );
    });

  return Array.from(new Set(interestingFiles));
}

async function cleanTemporaryDirectories(repoRoot: string, baselineWorktree?: string) {
  if (baselineWorktree) {
    await x('git', ['worktree', 'remove', '--force', baselineWorktree], {
      nodeOptions: { cwd: repoRoot },
    });
  }
}

export async function runEval(options: RunOptions) {
  const benchmark = getBenchmarkById(options.benchmarkId);
  const variant = getVariantById(options.variantId);
  const modelConfig = resolveModel(options.agent, options.tier, options.model);
  const trialId = createTrialId(benchmark.id, variant.id, options.agent, modelConfig.id);
  const workspaceRoot = getWorkspaceRoot(options.workspaceRoot);
  const trialPaths: TrialPaths = {
    trialDir: join(workspaceRoot, 'trials', trialId),
    repoDir: join(workspaceRoot, 'trials', trialId, 'repo'),
    logsDir: join(workspaceRoot, 'trials', trialId, 'logs'),
    artifactsDir: join(workspaceRoot, 'trials', trialId, 'artifacts'),
    promptPath: join(workspaceRoot, 'trials', trialId, 'artifacts', 'prompt.md'),
    resultPath: join(workspaceRoot, 'trials', trialId, 'artifacts', 'result.json'),
    tempDir: join(workspaceRoot, 'trials', trialId, 'tmp'),
  };

  const preparedProject = await prepareProject(benchmark, trialPaths);
  const prompt = await buildPrompt(
    variant,
    benchmark,
    preparedProject.projectRoot,
    preparedProject.targetDirLabel,
    preparedProject.candidateComponents
  );
  await writeFile(trialPaths.promptPath, prompt);

  const cliVersions = {
    claude: await detectCliVersion('claude'),
    codex: await detectCliVersion('codex'),
  };

  if (options.prepareOnly) {
    const result: EvalResult = {
      schemaVersion: 1,
      benchmark: {
        id: benchmark.id,
        name: benchmark.name,
        repo: benchmark.repo,
        branch: benchmark.branch ?? 'default',
        projectDir: benchmark.projectDir ?? '.',
        tags: benchmark.tags,
      },
      variant: {
        id: variant.id,
        label: variant.label,
        description: variant.description,
      },
      agent: {
        name: options.agent,
        model: modelConfig.id,
        tier: modelConfig.tier,
      },
      environment: {
        nodeVersion: process.version,
        packageManager: preparedProject.packageManager,
        repoRoot: preparedProject.repoRoot,
        projectRoot: preparedProject.projectRoot,
        cliVersions,
      },
      preparation: {
        cleanup: preparedProject.cleanup,
        install: preparedProject.install,
        init: preparedProject.init,
        postInitInstall: preparedProject.postInitInstall,
        baselineCommit: preparedProject.baselineCommit,
        candidateComponents: preparedProject.candidateComponents,
      },
      changes: {
        files: [],
        storybookFiles: [],
        setupPatterns: [],
      },
      grading: {
        storybookBuild: {
          status: 'skipped',
          reason: 'Preparation-only run.',
        },
        ghostStories: {
          before: {
            status: 'skipped',
            reason: 'Preparation-only run.',
          },
          after: {
            status: 'skipped',
            reason: 'Preparation-only run.',
          },
        },
      },
      artifacts: {
        trialDir: trialPaths.trialDir,
        logsDir: trialPaths.logsDir,
        promptPath: trialPaths.promptPath,
        resultPath: trialPaths.resultPath,
      },
    };

    await writeFile(trialPaths.resultPath, `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }

  const execution = await executeAgent({
    agent: options.agent,
    model: modelConfig.id,
    prompt,
    repoRoot: preparedProject.repoRoot,
    logsDir: trialPaths.logsDir,
  });

  const changedFiles = await getChangedFiles(preparedProject.repoRoot, preparedProject.baselineCommit);
  const storybookFiles = filterStorybookFiles(changedFiles);
  const setupPatterns = await detectSetupPatterns(
    preparedProject.repoRoot,
    await readInterestingFiles(preparedProject.repoRoot, changedFiles)
  );
  const storybookBuild = await runStorybookBuild(
    preparedProject.projectRoot,
    preparedProject.packageManager,
    trialPaths.logsDir
  );

  let baselineWorktree: string | undefined;
  try {
    baselineWorktree = await createBaselineWorktree(
      preparedProject.repoRoot,
      preparedProject.baselineCommit,
      trialPaths
    );
    const baselineProjectRoot = resolve(baselineWorktree, benchmark.projectDir ?? '.');
    const finalCopyRoot = await createFinalCopy(preparedProject, trialPaths);
    const finalProjectRoot = resolve(finalCopyRoot, benchmark.projectDir ?? '.');

    const beforeGhostStories = await runGhostStories(
      baselineWorktree,
      baselineProjectRoot,
      trialPaths.logsDir,
      'ghost-stories-before'
    );
    const afterGhostStories = await runGhostStories(
      finalCopyRoot,
      finalProjectRoot,
      trialPaths.logsDir,
      'ghost-stories-after'
    );

    const result: EvalResult = {
      schemaVersion: 1,
      benchmark: {
        id: benchmark.id,
        name: benchmark.name,
        repo: benchmark.repo,
        branch: benchmark.branch ?? 'default',
        projectDir: benchmark.projectDir ?? '.',
        tags: benchmark.tags,
      },
      variant: {
        id: variant.id,
        label: variant.label,
        description: variant.description,
      },
      agent: {
        name: options.agent,
        model: modelConfig.id,
        tier: modelConfig.tier,
      },
      environment: {
        nodeVersion: process.version,
        packageManager: preparedProject.packageManager,
        repoRoot: preparedProject.repoRoot,
        projectRoot: preparedProject.projectRoot,
        cliVersions,
      },
      preparation: {
        cleanup: preparedProject.cleanup,
        install: preparedProject.install,
        init: preparedProject.init,
        postInitInstall: preparedProject.postInitInstall,
        baselineCommit: preparedProject.baselineCommit,
        candidateComponents: preparedProject.candidateComponents,
      },
      execution,
      changes: {
        files: changedFiles,
        storybookFiles,
        setupPatterns,
      },
      grading: {
        storybookBuild,
        ghostStories: {
          before: beforeGhostStories,
          after: afterGhostStories,
        },
      },
      artifacts: {
        trialDir: trialPaths.trialDir,
        logsDir: trialPaths.logsDir,
        promptPath: trialPaths.promptPath,
        resultPath: trialPaths.resultPath,
      },
    };

    await writeFile(trialPaths.resultPath, `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await cleanTemporaryDirectories(preparedProject.repoRoot, baselineWorktree);
  }
}

export function getDefaultWorkspaceRoot() {
  return DEFAULT_WORKSPACE_ROOT;
}
