import type { CSSObject } from '@storybook/ui/theming';
import { styled } from '@storybook/ui/theming';

import { withMargin, withReset } from '../lib/common.tsx';

const listCommon = {
  paddingLeft: 30,
  '& :first-of-type': {
    marginTop: 0,
  },
  '& :last-child': {
    marginBottom: 0,
  },
};

export const UL = styled.ul(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...withMargin,
  ...listCommon,
  listStyle: 'disc',
}));
