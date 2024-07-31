import { styled } from '@storybook/core/theming';
import { withReset, withMargin } from '../lib/common';

export const Pre = styled.pre(withReset, withMargin, ({ theme }) => ({
  // reset
  fontFamily: theme.typography.fonts.mono,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  lineHeight: '18px',
  padding: '11px 1rem',
  whiteSpace: 'pre-wrap',
  color: 'inherit',
  borderRadius: 3,
  margin: '1rem 0',

  '&:not(.prismjs)': {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    margin: 0,
  },
  '& pre, &.prismjs': {
    padding: 15,
    margin: 0,
    whiteSpace: 'pre-wrap',
    color: 'inherit',
    fontSize: '13px',
    lineHeight: '19px',
    code: {
      color: 'inherit',
      fontSize: 'inherit',
    },
  },
  '& code': {
    whiteSpace: 'pre',
  },
  '& code, & tt': {
    border: 'none',
  },
}));
