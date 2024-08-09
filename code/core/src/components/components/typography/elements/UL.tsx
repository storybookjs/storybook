import { styled } from '@storybook/core/theming';
import type { Interpolation } from '@storybook/core/theming';

import { withMargin, withReset } from '../lib/common';

const listCommon: Interpolation = {
  paddingLeft: 30,
  '& :first-of-type': {
    marginTop: 0,
  },
  '& :last-child': {
    marginBottom: 0,
  },
};

export const UL = styled.ul(withReset, withMargin, listCommon, { listStyle: 'disc' });
