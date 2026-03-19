import type { CSSObject } from 'storybook/theming';
import { styled } from 'storybook/theming';

import { withMargin, withReset } from '../lib/common';

const listCommon = {
  paddingLeft: 30,
  '& :first-of-type': {
    marginTop: 0,
  },
  '& :last-child': {
    marginBottom: 0,
  },
};

export const OL = styled.ol(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...withMargin,
  ...listCommon,
  listStyle: 'decimal',
}));
