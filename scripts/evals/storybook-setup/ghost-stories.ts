import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { x } from 'tinyexec';

import { selectCandidateComponents } from './candidate-components';
import type { GhostStoriesSummary } from './types';

type VitestAssertion = {
  status?: string;
  fullName?: string;
  failureMessages?: string[];
  meta?: {
    storyId?: string;
    reports?: Array<{
      type?: string;
      result?: {
        emptyRender?: boolean;
      };
    }>;
  };
};

type VitestSuite = {
  assertionResults?: VitestAssertion[];
};

type VitestJsonReport = {
  numTotalTests?: number;
  numPassedTests?: number;
  testResults?: VitestSuite[];
};

export type GhostStoriesExecutionResult =
  | {
      ok: true;
      summary: GhostStoriesSummary;
    }
  | {
      ok: false;
      summary: GhostStoriesSummary;
    };

function categorizeError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('cannot find module') || normalized.includes('failed to resolve import')) {
    return 'module-resolution';
  }

  if (normalized.includes('context') || normalized.includes('provider')) {
    return 'missing-provider';
  }

  if (normalized.includes('css') || normalized.includes('tailwind') || normalized.includes('styled')) {
    return 'styling';
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'data-fetching';
  }

  return 'other';
}

function parseVitestReport(report: VitestJsonReport, candidateCount: number): GhostStoriesSummary {
  const testResults = report.testResults ?? [];
  const categorizedErrors = new Map<
    string,
    {
      count: number;
      uniqueErrors: Set<string>;
      matchedDependencies: Set<string>;
    }
  >();
  const uniqueErrorMessages = new Set<string>();
  let passedButEmptyRender = 0;

  for (const suite of testResults) {
    for (const assertion of suite.assertionResults ?? []) {
      const hasEmptyRender = assertion.meta?.reports?.some(
        (entry) => entry.type === 'render-analysis' && entry.result?.emptyRender === true
      );
      if (assertion.status === 'passed' && hasEmptyRender) {
        passedButEmptyRender += 1;
      }

      if (assertion.status !== 'failed') {
        continue;
      }

      const error = assertion.failureMessages?.[0]?.split('\n')[0];
      if (!error) {
        continue;
      }

      const category = categorizeError(error);
      const current = categorizedErrors.get(category) ?? {
        count: 0,
        uniqueErrors: new Set<string>(),
        matchedDependencies: new Set<string>(),
      };
      current.count += 1;
      current.uniqueErrors.add(error);
      uniqueErrorMessages.add(error);
      categorizedErrors.set(category, current);
    }
  }

  const total = report.numTotalTests ?? 0;
  const passed = report.numPassedTests ?? 0;

  return {
    candidateCount,
    total,
    passed,
    passedButEmptyRender,
    successRate: total > 0 ? Number((passed / total).toFixed(2)) : 0,
    successRateWithoutEmptyRender:
      total > 0 ? Number(((passed - passedButEmptyRender) / total).toFixed(2)) : 0,
    uniqueErrorCount: uniqueErrorMessages.size,
    categorizedErrors: Object.fromEntries(
      Array.from(categorizedErrors.entries()).map(([category, data]) => [
        category,
        {
          count: data.count,
          uniqueCount: data.uniqueErrors.size,
          matchedDependencies: Array.from(data.matchedDependencies).sort(),
        },
      ])
    ),
  };
}

export async function runGhostStoriesEval(projectRoot: string): Promise<GhostStoriesExecutionResult> {
  const candidates = await selectCandidateComponents(projectRoot, 20);
  const baseSummary: GhostStoriesSummary = {
    candidateCount: candidates.length,
    analyzedCount: candidates.length,
    avgComplexity:
      candidates.length > 0
        ? Number(
            (
              candidates.reduce((sum, candidate) => sum + candidate.complexity, 0) / candidates.length
            ).toFixed(2)
          )
        : 0,
  };

  if (candidates.length === 0) {
    return {
      ok: false,
      summary: {
        ...baseSummary,
        runError: 'No candidate components found for ghost-stories.',
      },
    };
  }

  const cacheDir = join(projectRoot, '.storybook-setup-eval');
  const outputFile = join(cacheDir, `ghost-stories-${Date.now()}.json`);
  await mkdir(cacheDir, { recursive: true });

  const vitestResult = await x(
    'npx',
    [
      '--no-install',
      'vitest',
      'run',
      '--reporter=json',
      '--testTimeout=1000',
      `--outputFile=${outputFile}`,
      ...candidates.map((candidate) => candidate.path),
    ],
    {
      nodeOptions: {
        cwd: projectRoot,
        env: {
          ...process.env,
          STORYBOOK_COMPONENT_PATHS: candidates.map((candidate) => candidate.path).join(';'),
        },
      },
    }
  );

  if (vitestResult.exitCode !== 0) {
    const output = `${vitestResult.stdout}\n${vitestResult.stderr}`.toLowerCase();
    const runError =
      output.includes('no tests found')
        ? 'No tests found'
        : output.includes('playwright')
          ? 'Playwright is not installed'
          : 'Vitest ghost-stories run failed';

    return {
      ok: false,
      summary: {
        ...baseSummary,
        runError,
      },
    };
  }

  try {
    const report = JSON.parse(await readFile(outputFile, 'utf8')) as VitestJsonReport;
    return {
      ok: true,
      summary: {
        ...baseSummary,
        ...parseVitestReport(report, candidates.length),
      },
    };
  } catch {
    return {
      ok: false,
      summary: {
        ...baseSummary,
        runError: 'Failed to read or parse Vitest JSON report',
      },
    };
  }
}
