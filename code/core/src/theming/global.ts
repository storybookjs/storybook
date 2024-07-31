import memoize from 'memoizerific';
import type { Color, Background, Typography } from './types';

type Value = string | number;
interface Return {
  [key: string]: {
    [key: string]: Value;
  };
}

export const createReset = memoize(1)(
  ({ typography }: { typography: Typography }): Return => ({
    body: {
      fontFamily: typography.fonts.base,
      fontSize: typography.size.s3,
      margin: 0,

      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
      WebkitOverflowScrolling: 'touch',
    },

    '*': {
      boxSizing: 'border-box',
    },

    'h1, h2, h3, h4, h5, h6': {
      fontWeight: typography.weight.regular,
      margin: 0,
      padding: 0,
    },

    'button, input, textarea, select': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      boxSizing: 'border-box',
    },

    sub: {
      fontSize: '0.8em',
      bottom: '-0.2em',
    },

    sup: {
      fontSize: '0.8em',
      top: '-0.2em',
    },
    'b, strong': {
      fontWeight: typography.weight.bold,
    },

    hr: {
      border: 'none',
      borderTop: '1px solid silver',
      clear: 'both',
      marginBottom: '1.25rem',
    },

    code: {
      fontFamily: typography.fonts.mono,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      display: 'inline-block',
      paddingLeft: 2,
      paddingRight: 2,
      verticalAlign: 'baseline',

      color: 'inherit',
    },

    pre: {
      fontFamily: typography.fonts.mono,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      lineHeight: '18px',
      padding: '11px 1rem',
      whiteSpace: 'pre-wrap',

      color: 'inherit',
      borderRadius: 3,
      margin: '1rem 0',
    },
  })
);

export const createGlobal = memoize(1)(({
  color,
  background,
  typography,
}: {
  color: Color;
  background: Background;
  typography: Typography;
}): Return => {
  const resetStyles = createReset({ typography });
  return {
    ...resetStyles,
    body: {
      ...resetStyles.body,
      color: color.defaultText,
      background: background.app,
      overflow: 'hidden',
    },

    hr: {
      ...resetStyles.hr,
      borderTop: `1px solid ${color.border}`,
    },
  };
});
