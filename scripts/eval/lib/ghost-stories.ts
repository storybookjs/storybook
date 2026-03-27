import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { exec } from './utils';
import type { GhostStoriesResult } from '../types';
import { logStep, logSuccess, logError } from './utils';

/**
 * Run ghost stories: discover candidate components, auto-generate stories
 * via the Vitest component transform, and measure rendering success.
 *
 * This leverages the existing @storybook/addon-vitest componentTransform which
 * activates when `STORYBOOK_COMPONENT_PATHS` env var is set. After `storybook init`,
 * the addon is already configured.
 */
export async function runGhostStories(
  projectPath: string,
  resultsDir: string
): Promise<GhostStoriesResult | undefined> {
  logStep('Running ghost stories...');

  // 1. Find candidate React components
  const candidates = await findCandidateComponents(projectPath);
  if (candidates.length === 0) {
    logError('No candidate components found');
    return undefined;
  }
  logStep(`Found ${candidates.length} candidate component(s)`);

  // 2. Run vitest with STORYBOOK_COMPONENT_PATHS to trigger componentTransform
  const reportPath = join(resultsDir, 'ghost-stories-report.json');
  await exec(
    'npx',
    [
      'vitest',
      'run',
      '--project=storybook',
      '--reporter=json',
      `--outputFile=${reportPath}`,
      '--testTimeout=10000',
    ],
    {
      cwd: projectPath,
      timeout: 120_000,
      throwOnError: false,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        npm_config_registry: 'https://registry.npmjs.org/',
        STORYBOOK_COMPONENT_PATHS: candidates.join(','),
      },
    }
  );

  // 3. Parse results
  if (!existsSync(reportPath)) {
    logError('Ghost stories: no Vitest report generated');
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const testResults = report.testResults || [];

    let total = 0;
    let passed = 0;
    for (const suite of testResults) {
      for (const test of suite.assertionResults || []) {
        total++;
        if (test.status === 'passed') passed++;
      }
    }

    const successRate = total > 0 ? Math.round((passed / total) * 100) / 100 : 0;

    if (total > 0) {
      logSuccess(`Ghost stories: ${passed}/${total} passed (${Math.round(successRate * 100)}%)`);
    } else {
      logError('Ghost stories: no tests found in report');
    }

    return { candidateCount: candidates.length, total, passed, successRate };
  } catch {
    logError('Ghost stories: failed to parse Vitest report');
    return { candidateCount: candidates.length, total: 0, passed: 0, successRate: 0 };
  }
}

/**
 * Find candidate React component files in the project.
 *
 * Looks for .tsx/.jsx files that contain JSX and exports,
 * excluding tests, stories, config files, and node_modules.
 */
async function findCandidateComponents(projectPath: string): Promise<string[]> {
  const result = await exec(
    'find',
    [
      projectPath,
      '-type',
      'f',
      '(',
      '-name',
      '*.tsx',
      '-o',
      '-name',
      '*.jsx',
      ')',
      '-not',
      '-path',
      '*/node_modules/*',
      '-not',
      '-path',
      '*/.storybook/*',
      '-not',
      '-path',
      '*/dist/*',
      '-not',
      '-path',
      '*/build/*',
      '-not',
      '-name',
      '*.test.*',
      '-not',
      '-name',
      '*.spec.*',
      '-not',
      '-name',
      '*.stories.*',
      '-not',
      '-name',
      '*.story.*',
      '-not',
      '-name',
      'vite.config.*',
      '-not',
      '-name',
      'vitest.config.*',
    ],
    { cwd: projectPath, throwOnError: false }
  );

  const files = result.stdout.trim().split('\n').filter(Boolean);

  // Filter for files that look like React components (have JSX + exports)
  const candidates: Array<{ path: string; complexity: number }> = [];
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const hasExport = /export\s+(default\s+)?/.test(content);
      const hasJsx = /<[A-Z]/.test(content) || /return\s*\(?\s*</.test(content);
      if (!hasExport || !hasJsx) continue;

      // Simple complexity score: lines + imports, normalized
      const lines = content.split('\n').filter((l) => l.trim()).length;
      const imports = (content.match(/^import\s/gm) || []).length;
      const complexity = Math.min(1, (lines + imports * 0.5) / 100);

      candidates.push({ path: relative(projectPath, file), complexity });
    } catch {
      // skip unreadable files
    }
  }

  // Sort by complexity (simplest first), take top 20
  candidates.sort((a, b) => a.complexity - b.complexity);
  return candidates.slice(0, 20).map((c) => c.path);
}
