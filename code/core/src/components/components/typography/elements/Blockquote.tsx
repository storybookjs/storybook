import { styled } from 'storybook/theming';

import { withMargin, withReset } from '../lib/common';

export const Blockquote = styled.blockquote(withReset, withMargin, {
  borderLeft: `4px solid var(--sb-color-medium)`,
  padding: '0 15px',
  color: 'var(--sb-color-dark)',
  '& > :first-of-type': {
    marginTop: 0,
  },
  '& > :last-child': {
    marginBottom: 0,
  },
});
