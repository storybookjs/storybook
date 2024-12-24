import { styled } from '@storybook/core/theming';

import { withMargin, withReset } from '../lib/common';

export const Table = styled.table(withReset, withMargin, ({ theme }) => ({
  fontSize: theme.typography.size.s2,
  lineHeight: '24px',
  padding: 0,
  borderCollapse: 'collapse',
  '& tr': {
    borderTop: `1px solid ${theme.appBorderColor}`,
    backgroundColor: theme.appContentBg,
    margin: 0,
    padding: 0,
  },
  '& tr:nth-of-type(2n)': {
    backgroundColor: theme.base === 'dark' ? theme.color.darker : theme.color.lighter,
  },
  '& tr th': {
    fontWeight: 'bold',
    color: theme.color.defaultText,
    border: `1px solid ${theme.appBorderColor}`,
    margin: 0,
    padding: '6px 13px',
  },
  '& tr td': {
    border: `1px solid ${theme.appBorderColor}`,
    color: theme.color.defaultText,
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
