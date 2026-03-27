import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GradingResult, QualityResult, TrialPaths } from '../types';
import { logStep, logSuccess, logError, exec } from './utils';

/**
 * Grade a trial by running storybook build and typecheck.
 */
export async function grade(
  paths: TrialPaths
): Promise<{ grading: GradingResult; quality: QualityResult }> {
  const { projectPath, resultsDir } = paths;

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

  const grading: GradingResult = {
    buildSuccess,
    buildError: buildSuccess ? undefined : buildOutput.slice(-2000),
    typeCheckErrors,
    typeCheckOutput: typeCheckErrors > 0 ? typeCheckOutput.slice(-2000) : undefined,
  };

  const quality = calculateQuality(grading);

  return { grading, quality };
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
