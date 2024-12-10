// Source: https://github.com/chaance/vitest-axe/blob/main/src/to-have-no-violations.ts
import * as matchers from 'vitest-axe/matchers';

import type { AfterEach } from 'storybook/internal/types';

import { expect } from '@storybook/test';

import { run } from './a11yRunner';
import { A11Y_TEST_TAG } from './constants';
import type { A11yParameters } from './params';
import { getIsVitestRunning, getIsVitestStandaloneRun } from './utils';

expect.extend(matchers);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_afterEach: AfterEach<any> = async ({
  reporting,
  parameters,
  globals,
  tags,
}) => {
  const a11yParameter: A11yParameters | undefined = parameters.a11y;
  const a11yGlobals = globals.a11y;
  const warnings = a11yParameter?.warnings ?? [];

  const shouldRunEnvironmentIndependent =
    a11yParameter?.manual !== true &&
    a11yParameter?.disable !== true &&
    a11yGlobals?.manual !== true;

  if (shouldRunEnvironmentIndependent) {
    if (getIsVitestRunning() && !tags.includes(A11Y_TEST_TAG)) {
      return;
    }
    try {
      const result = await run(a11yParameter);

      if (result) {
        const hasViolations = (result?.violations.length ?? 0) > 0;

        const hasErrors = result?.violations.some(
          (violation) => !warnings.includes(violation.impact!)
        );

        reporting.addReport({
          type: 'a11y',
          version: 1,
          result: result,
          status: hasErrors ? 'failed' : hasViolations ? 'warning' : 'passed',
        });

        /**
         * When Vitest is running outside of Storybook, we need to throw an error to fail the test
         * run when there are accessibility issues.
         *
         * @todo In the future, we want to always throw an error when there are accessibility
         *   issues. This is a temporary solution. Later, portable stories and Storybook should
         *   implement proper try catch handling.
         */
        if (getIsVitestStandaloneRun()) {
          if (hasErrors) {
            // @ts-expect-error - todo - fix type extension of expect from @storybook/test
            expect(result).toHaveNoViolations();
          }
        }
      }
      /**
       * @todo Later we don't want to catch errors here. Instead, we want to throw them and let
       *   Storybook/portable stories handle them on a higher level.
       */
    } catch (e) {
      reporting.addReport({
        type: 'a11y',
        version: 1,
        result: {
          error: e,
        },
        status: 'failed',
      });

      if (getIsVitestStandaloneRun()) {
        throw e;
      }
    }
  }
};

export const initialGlobals = {
  a11y: {
    manual: false,
  },
};

// A11Y_TEST_TAG constant in ./constants.ts. Has to be statically analyzable.
export const tags = ['a11ytest'];
