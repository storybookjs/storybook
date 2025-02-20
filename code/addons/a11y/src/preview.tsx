import type { AfterEach } from 'storybook/internal/types';

import { expect } from '@storybook/test';

import { run } from './a11yRunner';
import type { A11yParameters } from './params';
import { getIsVitestStandaloneRun } from './utils';

let vitestMatchersExtended = false;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_afterEach: AfterEach<any> = async ({
  reporting,
  parameters,
  globals,
}) => {
  const a11yParameter: A11yParameters | undefined = parameters.a11y;
  const a11yGlobals = globals.a11y;

  const shouldRunEnvironmentIndependent =
    a11yParameter?.manual !== true &&
    a11yParameter?.disable !== true &&
    a11yParameter?.test !== 'off' &&
    a11yGlobals?.manual !== true;

  const getMode = (): (typeof reporting)['reports'][0]['status'] => {
    switch (a11yParameter?.test) {
      case 'todo':
        return 'warning';
      case 'error':
      default:
        return 'failed';
    }
  };

  if (shouldRunEnvironmentIndependent) {
    try {
      const result = await run(a11yParameter);

      if (result) {
        const hasViolations = (result?.violations.length ?? 0) > 0;

        reporting.addReport({
          type: 'a11y',
          version: 1,
          result: result,
          status: hasViolations ? getMode() : 'passed',
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
          if (hasViolations && getMode() === 'failed') {
            if (!vitestMatchersExtended) {
              const { toHaveNoViolations } = await import('vitest-axe/matchers');
              expect.extend({ toHaveNoViolations });
              vitestMatchersExtended = true;
            }

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

export const parameters = {
  a11y: {
    test: 'todo',
  } as A11yParameters,
};
