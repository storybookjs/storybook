import React, { type ComponentProps, type DOMAttributes, forwardRef } from 'react';

import type { StorybookTheme } from 'storybook/theming';
import { keyframes, styled } from 'storybook/theming';

type ThemeColor = keyof StorybookTheme['color'] | keyof StorybookTheme['fgColor'];

const getColor = (theme: StorybookTheme, color?: ThemeColor) => {
  if (color && color in theme.fgColor) {
    return theme.fgColor[color as keyof typeof theme.fgColor];
  }
  if (color && color in theme.color) {
    return theme.color[color as keyof typeof theme.color];
  }
};

const getBorderColor = (theme: StorybookTheme, color?: ThemeColor, outlineColor?: ThemeColor) => {
  if (color && color in theme.borderColor) {
    return theme.borderColor[color as keyof typeof theme.borderColor];
  }
  if (outlineColor && outlineColor in theme.color) {
    return theme.color[outlineColor as keyof typeof theme.color];
  }
};

const getBackgroundColor = (theme: StorybookTheme, color?: ThemeColor) => {
  if (color && color in theme.bgColor) {
    return theme.bgColor[color as keyof typeof theme.bgColor];
  }
  return theme.background.content;
};

const fadeInOut = keyframes({
  '0%': { opacity: 0 },
  '5%': { opacity: 1 },
  '25%': { opacity: 1 },
  '30%': { opacity: 0 },
});

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(20deg)' },
  '40%': { transform: 'rotate(170deg)' },
  '50%': { transform: 'rotate(180deg)' },
  '60%': { transform: 'rotate(190deg)' },
  '90%': { transform: 'rotate(340deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const slide = keyframes({
  to: {
    backgroundPositionX: '36%',
  },
});

const CardContent = styled.div<{ color?: ThemeColor }>(({ color, theme }) => ({
  color: getColor(theme, color),
  borderRadius: theme.appBorderRadius,
  backgroundColor: getBackgroundColor(theme, color),
  position: 'relative',
}));

const CardOutline = styled.div<{
  animation?: 'none' | 'rainbow' | 'spin';
  color?: ThemeColor;
  outlineColor?: ThemeColor;
}>(({ animation = 'none', color, outlineColor = color, theme }) => ({
  position: 'relative',
  width: '100%',
  padding: 1,
  overflow: 'hidden',
  backgroundColor: getBackgroundColor(theme, color),
  borderRadius: theme.appBorderRadius + 1,
  boxShadow: `inset 0 0 0 1px ${(animation === 'none' && getBorderColor(theme, color, outlineColor)) || theme.appBorderColor}, var(--card-box-shadow, transparent 0 0)`,
  transition: 'box-shadow 1s',

  '@supports (interpolate-size: allow-keywords)': {
    interpolateSize: 'allow-keywords',
    transition: 'all var(--transition-duration, 0.2s), box-shadow 1s',
    transitionBehavior: 'allow-discrete',
  },

  '@media (prefers-reduced-motion: reduce)': {
    transition: 'box-shadow 1s',
  },

  '&:before': {
    content: '""',
    display: animation === 'none' ? 'none' : 'block',
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: 1,

    ...(animation === 'rainbow' && {
      animation: `${slide} 10s infinite linear, ${fadeInOut} 60s infinite linear`,
      backgroundImage: `linear-gradient(45deg,rgb(234, 0, 0),rgb(255, 157, 0),rgb(255, 208, 0),rgb(0, 172, 0),rgb(0, 166, 255),rgb(181, 0, 181), rgb(234, 0, 0),rgb(255, 157, 0),rgb(255, 208, 0),rgb(0, 172, 0),rgb(0, 166, 255),rgb(181, 0, 181))`,
      backgroundSize: '1000%',
      backgroundPositionX: '100%',
    }),

    ...(animation === 'spin' && {
      left: '50%',
      top: '50%',
      marginLeft: 'calc(max(100vw, 100vh) * -0.5)',
      marginTop: 'calc(max(100vw, 100vh) * -0.5)',
      height: 'max(100vw, 100vh)',
      width: 'max(100vw, 100vh)',
      animation: `${spin} 5s linear infinite`,
      // Hardcoded colors to prevent themes from messing with them
      // (orange+gold, lavender+pink, secondary+seafoam)
      backgroundImage:
        outlineColor === 'negative'
          ? `conic-gradient(transparent 90deg, #FC521F 150deg, #FFAE00 210deg, transparent 270deg)`
          : outlineColor === 'agentic'
            ? `conic-gradient(#e1d2ef 90deg, #b6a7ff 150deg, #d8aeff 210deg, #e1d2ef 270deg)`
            : `conic-gradient(transparent 90deg, #029CFD 150deg, #37D5D3 210deg, transparent 270deg)`,
    }),
  },
}));

interface CardProps extends ComponentProps<typeof CardContent> {
  outlineAnimation?: 'none' | 'rainbow' | 'spin';
  color?: ThemeColor;
  outlineColor?: ThemeColor;
  outlineAttrs?: DOMAttributes<HTMLDivElement>;
}

export const Card = Object.assign(
  forwardRef<HTMLDivElement, CardProps>(function Card(
    { outlineAnimation = 'none', color, outlineColor, outlineAttrs: outlineAttrs = {}, ...props },
    ref
  ) {
    return (
      <CardOutline
        animation={outlineAnimation}
        color={color}
        outlineColor={outlineColor}
        ref={ref}
        {...outlineAttrs}
      >
        <CardContent color={color} {...props} />
      </CardOutline>
    );
  }),
  {
    Content: CardContent,
    Outline: CardOutline,
  }
);
