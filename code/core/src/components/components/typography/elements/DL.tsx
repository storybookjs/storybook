import { styled } from '@storybook/core/theming';
import { withReset, withMargin } from '../lib/common';

export const DL = styled.dl(withReset, withMargin, {
  padding: 0,
  '& dt': {
    fontSize: '14px',
    fontWeight: 'bold',
    fontStyle: 'italic',
    padding: 0,
    margin: '16px 0 4px',
  },
  '& dt:first-of-type': {
    padding: 0,
  },
  '& dt > :first-of-type': {
    marginTop: 0,
  },

  '& dt > :last-child': {
    marginBottom: 0,
  },

  '& dd': {
    margin: '0 0 16px',
    padding: '0 15px',
  },

  '& dd > :first-of-type': {
    marginTop: 0,
  },

  '& dd > :last-child': {
    marginBottom: 0,
  },
});
