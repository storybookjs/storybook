import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { expect, it, vi } from 'vitest';

import type { ReportNode } from 'istanbul-lib-report';
import { dirname, join, relative } from 'pathe';

import StorybookCoverageReporter from './coverage-reporter.ts';
import type { TestManager } from './test-manager.ts';
import { getCoverageReporterId } from './vitest-manager.ts';

const BUILT = existsSync(new URL('../../dist/node/coverage-reporter.js', import.meta.url));
const BARE_REPORTER_ID = '@storybook/addon-vitest/internal/coverage-reporter';

it.runIf(process.env.CI)('is built before the loader tests run', () => {
  expect(BUILT).toBe(true);
});

it.runIf(BUILT).each([
  ['Vitest 4', ['istanbul-reports'], 'require'],
  ['Vitest 5', ['@vitest/istanbul-lib-report', '@vitest/istanbul-lib-coverage'], 'import'],
])(
  'loads the built coverage reporter through the %s loader',
  async (_version, packages, moduleSystem) => {
    // The copy sits outside this package, so a bare specifier cannot resolve the addon.
    const directory = mkdtempSync(join(tmpdir(), 'sb-coverage-reporter-'));
    try {
      let loaderFile = '';
      for (const packageName of packages) {
        const entryFile = fileURLToPath(import.meta.resolve(packageName));
        let packageDirectory = dirname(entryFile);
        while (!packageDirectory.endsWith(packageName)) {
          packageDirectory = dirname(packageDirectory);
        }
        cpSync(packageDirectory, join(directory, 'node_modules', packageName), {
          recursive: true,
          dereference: true,
        });
        if (loaderFile === '') {
          loaderFile = join(
            directory,
            'node_modules',
            packageName,
            relative(packageDirectory, entryFile)
          );
        }
      }
      const loader =
        moduleSystem === 'import'
          ? `(await import(${JSON.stringify(pathToFileURL(loaderFile).href)})).createAsync`
          : `require(${JSON.stringify(loaderFile)}).create`;

      await expect(
        promisify(execFile)(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            `
          import { strict as assert } from 'node:assert';
          import { createRequire } from 'node:module';
          const require = createRequire(${JSON.stringify(loaderFile)});
          const summaries = [];
          const reporter = await (${loader})(
            ${JSON.stringify(getCoverageReporterId())},
            {
              getTestManager: () => ({
                onCoverageCollected: (summary) => summaries.push(summary),
                vitestManager: { vitest: { config: { coverage: { watermarks: { statements: [50, 90] } } } } },
              }),
            }
          );
          reporter.onSummary({
            isRoot: () => true,
            getCoverageSummary: () => ({ data: { statements: { pct: 87.4 } } }),
          });
          assert.deepEqual(summaries, [{ percentage: 87, status: 'warning' }]);
          await assert.rejects(
            async () => (${loader})(${JSON.stringify(BARE_REPORTER_ID)}, {}),
            /@storybook\\/addon-vitest/
          );
        `,
          ],
          { cwd: directory }
        )
      ).resolves.toMatchObject({ stdout: '' });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
);

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
    const reporter = new StorybookCoverageReporter({ getTestManager: () => testManager });
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
    getTestManager: () => ({ onCoverageCollected }) as unknown as TestManager,
  });
  reporter.onSummary({ isRoot: () => false } as ReportNode);
  expect(onCoverageCollected).not.toHaveBeenCalled();
});
