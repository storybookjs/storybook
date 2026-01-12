import { styled } from 'storybook/theming';

import { withMargin, withReset } from '../lib/common';

export const Table = styled.table(withReset, withMargin, ({ theme }) => ({
  fontSize: 'var(--sb-typography-size-s2)',
  lineHeight: '24px',
  padding: 0,
  borderCollapse: 'collapse',
  '& tr': {
    borderTop: `1px solid var(--sb-appBorderColor)`,
    backgroundColor: 'var(--sb-appContentBg)',
    margin: 0,
    padding: 0,
  },
  '& tr:nth-of-type(2n)': {
    backgroundColor: theme.base === 'dark' ? 'var(--sb-color-darker)' : 'var(--sb-color-lighter)',
  },
  '& tr th': {
    fontWeight: 'bold',
    color: 'var(--sb-color-defaultText)',
    border: `1px solid var(--sb-appBorderColor)`,
    margin: 0,
    padding: '6px 13px',
  },
  '& tr td': {
    border: `1px solid var(--sb-appBorderColor)`,
    color: 'var(--sb-color-defaultText)',
    margin: 0,
    padding: '6px 13px',
  },
  '& tr th :first-of-type, & tr td :first-of-type': {
    marginTop: 0,
  },
  '& tr th :last-child, & tr td :last-child': {
    marginBottom: 0,
  },
}));
