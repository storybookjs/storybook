import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

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
              testManager: { onCoverageCollected: (summary) => summaries.push(summary) },
              coverageOptions: { watermarks: { statements: [50, 90] } },
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
