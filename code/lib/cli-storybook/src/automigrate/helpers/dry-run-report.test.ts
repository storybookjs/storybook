import { describe, expect, it } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import { join } from 'pathe';

import { addSimulatedOutcomes, createDryRunReport } from './dry-run-report.ts';

describe('addSimulatedOutcomes', () => {
  it('gives a fix that would fail on the main config the reason a failing run gives, with the path from the project root', () => {
    const report = createDryRunReport();

    addSimulatedOutcomes(
      report,
      new Map([
        [
          'fails-on-main',
          {
            status: 'fail' as const,
            changed: [],
            fileFailures: [
              {
                file: join(getProjectRoot(), '.storybook/main.js'),
                kind: 'main' as const,
                message: 'cannot migrate',
              },
            ],
          },
        ],
      ])
    );

    expect(report.fail).toEqual([
      { fixId: 'fails-on-main', reason: '.storybook/main.js: cannot migrate' },
    ]);
  });
});
