import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, it, vi } from 'vitest';

import type { ReportNode } from 'istanbul-lib-report';

import StorybookCoverageReporter from './coverage-reporter.ts';
import type { TestManager } from './test-manager.ts';

it.each([
  ['Vitest 3/4', "require('istanbul-reports').create"],
  ['Vitest 5', "(await import('@vitest/istanbul-lib-report')).createAsync"],
])('loads the built coverage reporter through the %s loader', async (_version, loader) => {
  await expect(
    promisify(execFile)(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { strict as assert } from 'node:assert';
          import { createRequire } from 'node:module';
          const require = createRequire(import.meta.url);
          const summaries = [];
          const reporter = await (${loader})(
            '@storybook/addon-vitest/internal/coverage-reporter',
            {
              testManager: {
                onCoverageCollected: (summary) => summaries.push(summary),
                vitestManager: { vitest: { config: { coverage: { watermarks: { statements: [50, 90] } } } } },
              },
            }
          );
          reporter.onSummary({
            isRoot: () => true,
            getCoverageSummary: () => ({ data: { statements: { pct: 87.4 } } }),
          });
          assert.deepEqual(summaries, [{ percentage: 87, status: 'warning' }]);
        `,
      ],
      { cwd: fileURLToPath(new URL('../../', import.meta.url)) }
    )
  ).resolves.toMatchObject({ stdout: '' });
});

it.each([
  { percentage: 49, watermarks: [50, 90], expected: { percentage: 49, status: 'negative' } },
  { percentage: 50, watermarks: [50, 90], expected: { percentage: 50, status: 'warning' } },
  { percentage: 89.5, watermarks: [50, 90], expected: { percentage: 90, status: 'positive' } },
  { percentage: 79.4, watermarks: undefined, expected: { percentage: 79, status: 'warning' } },
  { percentage: 80, watermarks: [], expected: { percentage: 80, status: 'positive' } },
  { percentage: 60, watermarks: [60], expected: { percentage: 60, status: 'warning' } },
])(
  'reports $expected for $percentage with watermarks $watermarks',
  ({ percentage, watermarks, expected }) => {
    const onCoverageCollected = vi.fn();
    const testManager = {
      onCoverageCollected,
      vitestManager: {
        vitest: { config: { coverage: { watermarks: { statements: watermarks } } } },
      },
    } as unknown as TestManager;
    const reporter = new StorybookCoverageReporter({ testManager });
    reporter.onSummary({
      isRoot: () => true,
      getCoverageSummary: () => ({ data: { statements: { pct: percentage } } }),
    } as unknown as ReportNode);
    expect(onCoverageCollected).toHaveBeenCalledExactlyOnceWith(expected);
  }
);

it('ignores nested coverage summaries', () => {
  const onCoverageCollected = vi.fn();
  const reporter = new StorybookCoverageReporter({
    testManager: { onCoverageCollected } as unknown as TestManager,
  });
  reporter.onSummary({ isRoot: () => false } as ReportNode);
  expect(onCoverageCollected).not.toHaveBeenCalled();
});
