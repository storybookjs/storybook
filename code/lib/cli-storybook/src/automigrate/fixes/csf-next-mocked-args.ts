import { wrapArgsMocks } from '../../codemod/helpers/wrap-args-mocks.ts';
import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const introducedIn = '11.0.0';

export const csfNextMockedArgs: Fix = {
  id: 'csf-next-mocked-args',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#csf-next-use-mocked-for-the-mock-api-on-args',

  prompt: () => 'Wrap mock API calls on args in mocked() in CSF Next stories',

  async check({ beforeVersion, storybookVersion, requested }) {
    if (!isAtOrPastVersion(storybookVersion, introducedIn)) {
      return null;
    }
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn))
    ) {
      return null;
    }
    return {};
  },

  transform: () => [
    {
      filter: { kind: ['story'], code: /mock|withImplementation/i },
      editCsf: (csf) => {
        if (csf._metaIsFactory) {
          wrapArgsMocks(csf._ast);
        }
      },
    },
  ],
};
