import React, { type ComponentProps, forwardRef } from 'react';

import type { CSSObject, color } from 'storybook/theming';
import { keyframes, styled } from 'storybook/theming';

const fadeInOut = keyframes({
  '0%': { opacity: 0 },
  '5%': { opacity: 1 },
  '25%': { opacity: 1 },
  '30%': { opacity: 0 },
});

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(10deg)' },
  '40%': { transform: 'rotate(170deg)' },
  '50%': { transform: 'rotate(180deg)' },
  '60%': { transform: 'rotate(190deg)' },
  '90%': { transform: 'rotate(350deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const slide = keyframes({
  to: {
    backgroundPositionX: '36%',
  },
});

const CardContent = styled.div(({ theme }) => ({
  borderRadius: theme.appBorderRadius,
  backgroundColor: theme.background.content,
  position: 'relative',
}));

const CardOutline = styled.div<{
  animation?: 'none' | 'rainbow' | 'spin';
  color?: keyof typeof color;
  styles?: CSSObject;
}>(({ animation = 'none', color, styles, theme }) => ({
  position: 'relative',
  width: '100%',
  padding: 1,
  overflow: 'hidden',
  backgroundColor: theme.background.content,
  borderRadius: theme.appBorderRadius + 1,
  boxShadow: `inset 0 0 0 1px ${(animation === 'none' && color && theme.color[color]) || theme.appBorderColor}, var(--card-box-shadow, transparent 0 0)`,
  transition: 'box-shadow 1s',
  ...styles,

  '@supports (interpolate-size: allow-keywords)': {
    interpolateSize: 'allow-keywords',
    transition: 'all var(--transition-duration, 0.2s), box-shadow 1s',
    transitionBehavior: 'allow-discrete',
  },

  '@media (prefers-reduced-motion: reduce)': {
    transition: 'box-shadow 1s',
  },

  '&.enter': {
    opacity: 0,
    blockSize: 0,
    contentVisibility: 'hidden',
  },
  '&.enter-active': {
    opacity: 1,
    blockSize: 'auto',
    contentVisibility: 'visible',
  },
  '&.exit': {
    opacity: 1,
    blockSize: 'auto',
    contentVisibility: 'visible',
  },
  '&.exit-active, &.exit-done': {
    opacity: 0,
    blockSize: 0,
    contentVisibility: 'hidden',
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
      animation: `${spin} 3s linear infinite`,
      backgroundImage:
        color === 'negative'
          ? // Hardcoded colors to prevent themes from messing with them (orange+gold, secondary+seafoam)
            `conic-gradient(transparent 90deg, #FC521F 150deg, #FFAE00 210deg, transparent 270deg)`
          : `conic-gradient(transparent 90deg, #029CFD 150deg, #37D5D3 210deg, transparent 270deg)`,
    }),

    ...(styles && typeof styles['&:before'] === 'object' ? styles['&:before'] : {}),
  },
}));

interface CardProps extends ComponentProps<typeof CardContent> {
  outlineAnimation?: 'none' | 'rainbow' | 'spin';
  outlineColor?: keyof typeof color;
  outlineStyles?: CSSObject;
}

export const Card = Object.assign(
  forwardRef<HTMLDivElement, CardProps>(function Card(
    { outlineAnimation = 'none', outlineColor, outlineStyles, ...props },
    ref
  ) {
    return (
      <CardOutline
        animation={outlineAnimation}
        color={outlineColor}
        styles={outlineStyles}
        ref={ref}
      >
        <CardContent {...props} />
      </CardOutline>
    );
  }),
  {
    Content: CardContent,
    Outline: CardOutline,
  }
);
