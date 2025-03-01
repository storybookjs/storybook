import type { Interpolation } from 'storybook/internal/theming';
import { styled } from 'storybook/internal/theming';

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

export const OL = styled.ol(withReset, withMargin, listCommon, {
  listStyle: 'decimal',
});
