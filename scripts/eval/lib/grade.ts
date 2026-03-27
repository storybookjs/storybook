import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GradingResult, QualityResult, TrialPaths, ChangedFile } from '../types';
import { logStep, logSuccess, logError, exec } from './utils';
import { detectSetupPatterns } from './setup-patterns';
import { runGhostStories } from './ghost-stories';

/**
 * Grade a trial by measuring what the agent changed and whether the build works.
 */
export async function grade(
  paths: TrialPaths
): Promise<{ grading: GradingResult; quality: QualityResult }> {
  const { repoRoot, projectPath, resultsDir, baselineCommit } = paths;

  // --- Changed Files (diff from baseline) ---
  logStep('Collecting agent changes...');
  const changedFiles = await getChangedFiles(repoRoot, baselineCommit);
  const storybookFiles = changedFiles.filter(
    (f) => f.path.includes('.storybook/') || /\.(stories|story)\.[tj]sx?$/.test(f.path)
  );
  logSuccess(`${changedFiles.length} files changed (${storybookFiles.length} storybook-related)`);

  // --- Setup Patterns ---
  const setupPatterns = detectSetupPatterns(projectPath);
  if (setupPatterns.length > 0) {
    logSuccess(`Detected patterns: ${setupPatterns.map((p) => p.label).join(', ')}`);
  }

  // --- Storybook Build ---
  logStep('Running storybook build...');
  const buildResult = await exec('npx', ['storybook', 'build', '--quiet'], {
    cwd: projectPath,
    timeout: 300_000,
    throwOnError: false,
    env: {
      STORYBOOK_DISABLE_TELEMETRY: '1',
      NODE_OPTIONS: '--max_old_space_size=4096',
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      npm_config_registry: 'https://registry.npmjs.org/',
    },
  });

  const buildSuccess = buildResult.exitCode === 0;
  const buildOutput = buildResult.stdout + '\n' + buildResult.stderr;
  writeFileSync(join(resultsDir, 'build-output.txt'), buildOutput);

  if (buildSuccess) {
    logSuccess('Storybook build succeeded');
  } else {
    logError(`Storybook build failed (exit code ${buildResult.exitCode})`);
  }

  // --- TypeScript Check ---
  logStep('Running typecheck...');
  const tscResult = await exec('npx', ['tsc', '--noEmit'], {
    cwd: projectPath,
    timeout: 120_000,
    throwOnError: false,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      npm_config_registry: 'https://registry.npmjs.org/',
    },
  });

  const typeCheckOutput = tscResult.stdout + '\n' + tscResult.stderr;
  writeFileSync(join(resultsDir, 'typecheck-output.txt'), typeCheckOutput);
  const typeCheckErrors = (typeCheckOutput.match(/error TS\d+/g) || []).length;

  if (typeCheckErrors === 0) {
    logSuccess('No TypeScript errors');
  } else {
    logError(`${typeCheckErrors} TypeScript error(s)`);
  }

  // --- Ghost Stories ---
  const ghostStories = buildSuccess
    ? await runGhostStories(projectPath, resultsDir)
    : undefined;

  const grading: GradingResult = {
    buildSuccess,
    buildError: buildSuccess ? undefined : buildOutput.slice(-2000),
    typeCheckErrors,
    typeCheckOutput: typeCheckErrors > 0 ? typeCheckOutput.slice(-2000) : undefined,
    changedFiles,
    storybookFiles,
    setupPatterns,
    ghostStories,
  };

  const quality = calculateQuality(grading);
  return { grading, quality };
}

async function getChangedFiles(repoRoot: string, baselineCommit: string): Promise<ChangedFile[]> {
  // Stage everything so diff sees new files too
  await exec('git', ['add', '-A'], { cwd: repoRoot });
  const result = await exec('git', ['diff', '--cached', '--name-status', baselineCommit], {
    cwd: repoRoot,
    throwOnError: false,
  });

  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split('\t');
      return {
        path: pathParts.join('\t'),
        status: (status?.charAt(0) || 'M') as ChangedFile['status'],
      };
    });
}

function calculateQuality(grading: GradingResult): QualityResult {
  const buildScore = grading.buildSuccess ? 1 : 0;
  const typeCheckScore = Math.max(0, 1 - grading.typeCheckErrors / 20);
  const score = buildScore * 0.7 + typeCheckScore * 0.3;

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      build: buildScore,
      typecheck: Math.round(typeCheckScore * 100) / 100,
    },
  };
}
