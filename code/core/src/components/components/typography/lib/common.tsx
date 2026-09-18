import { transparentize } from 'polished';
import type { CSSObject, FunctionInterpolation } from 'storybook/theming';

export const headerCommon: FunctionInterpolation = ({ theme }) => ({
  margin: '20px 0 8px',
  padding: 0,
  cursor: 'text',
  position: 'relative',
  color: theme.color.defaultText,
  '&:first-of-type': {
    marginTop: 0,
    paddingTop: 0,
  },
  '&:hover a.anchor': {
    textDecoration: 'none',
  },
  '& tt, & code': {
    fontSize: 'inherit',
  },
});

export const codeCommon: FunctionInterpolation = ({ theme }) => ({
  lineHeight: 1,
  margin: '0 2px',
  padding: '3px 5px',
  whiteSpace: 'nowrap',

  borderRadius: 3,
  fontSize: theme.typography.size.s2 - 1,

  border: theme.base === 'light' ? '1px solid hsl(0 0 0 / 0.05)' : '1px solid hsl(0 0 100 / 0.05)',
  color: theme.color.defaultText,
  backgroundColor: theme.base === 'light' ? 'hsl(0 0 0 / 0.01)' : 'hsl(0 0 100 / 0.02)',
});

export const withReset: FunctionInterpolation = ({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s3,
  margin: 0,

  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
  WebkitOverflowScrolling: 'touch',
});

export const withMargin: CSSObject = {
  margin: '16px 0',
};
