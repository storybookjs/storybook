import React, { forwardRef, type ComponentProps, type DOMAttributes } from 'react';

import type { StorybookTheme } from 'storybook/theming';
import { keyframes, styled } from 'storybook/theming';

type ThemeColor = keyof StorybookTheme['color'] | keyof StorybookTheme['fgColor'];

// A ThemeColor may live in any of theme.color / fgColor / bgColor / borderColor, which don't share
// a key space, so each lookup is a presence check rather than a direct index. Returning undefined
// when absent is intentional: it lets the CSS property fall back to inherit/default.
const resolveThemeColor = (
  colors: Partial<Record<string, string>>,
  key?: ThemeColor
): string | undefined => (key && key in colors ? colors[key] : undefined);

const getColor = (theme: StorybookTheme, color?: ThemeColor): string | undefined =>
  resolveThemeColor(theme.fgColor, color) ?? resolveThemeColor(theme.color, color);

const getBorderColor = (
  theme: StorybookTheme,
  color?: ThemeColor,
  outlineColor?: ThemeColor
): string | undefined =>
  resolveThemeColor(theme.borderColor, color) ?? resolveThemeColor(theme.color, outlineColor);

const getBackgroundColor = (theme: StorybookTheme, color?: ThemeColor): string =>
  resolveThemeColor(theme.bgColor, color) ?? theme.background.content;

// Compose the (possibly translucent) themed background over an opaque base. Some
// themed bgColors are intentionally translucent for tinting (e.g. `agentic` in
// dark mode), which would otherwise let the animated outline behind the content
// bleed through the whole card instead of just the 1px ring.
const getOpaqueBackground = (theme: StorybookTheme, color?: ThemeColor): string => {
  const bg = getBackgroundColor(theme, color);
  return `linear-gradient(${bg}, ${bg}), ${theme.background.content}`;
};

// Hardcoded colors to prevent themes from messing with them
// (orange+gold, lavender+pink, secondary+seafoam)
const getSpinColors = (theme: StorybookTheme, outlineColor?: ThemeColor): [string, string] => {
  if (outlineColor === 'negative') {
    return ['#FC521F', '#FFAE00'];
  }
  if (outlineColor === 'agentic') {
    // Agentic is intentionally subtle. Pale lavender stays low-contrast on a
    // light background, but the same colors read as a bright sweep on dark, so
    // dark mode uses low-alpha hues to keep it a faint glow.
    return theme.base === 'dark'
      ? ['rgba(114,58,166,0.65)', 'rgba(157,98,214,0.6)']
      : ['#b6a7ff', '#d8aeff'];
  }
  return ['#029CFD', '#37D5D3'];
};

const pulse = keyframes({
  '50%': { opacity: 0.5 },
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

const hueCycle = keyframes({
  from: { filter: 'hue-rotate(0deg)' },
  to: { filter: 'hue-rotate(360deg)' },
});

const CardContent = styled.div<{ color?: ThemeColor }>(({ color, theme }) => ({
  color: getColor(theme, color),
  borderRadius: theme.appBorderRadius,
  background: getOpaqueBackground(theme, color),
  position: 'relative',
}));

const CardOutline = styled.div<{
  animation?: 'none' | 'rainbow' | 'spin';
  color?: ThemeColor;
  outlineColor?: ThemeColor;
}>(({ animation = 'none', color, outlineColor = color, theme }) => {
  const [spinStart, spinEnd] = getSpinColors(theme, outlineColor);

  return {
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

      // Stops within 5 seconds, with or without reduced motion, to meet
      // WCAG 2.2.2 (Pause, Stop, Hide).
      ...(animation === 'rainbow' && {
        backgroundImage: 'linear-gradient(to top right, rgb(255, 157, 0), rgb(0, 172, 0))',
        animation: `${hueCycle} 5s ease-in-out`,
        '@media (prefers-reduced-motion: reduce)': {
          animation: `${pulse} 2.5s ease-in-out 2`,
        },
      }),

      ...(animation === 'spin' && {
        left: '50%',
        top: '50%',
        marginLeft: 'calc(max(100vw, 100vh) * -0.5)',
        marginTop: 'calc(max(100vw, 100vh) * -0.5)',
        height: 'max(100vw, 100vh)',
        width: 'max(100vw, 100vh)',
        animation: `${spin} 5s linear infinite`,
        backgroundImage: `conic-gradient(transparent 90deg, ${spinStart} 150deg, ${spinEnd} 210deg, transparent 270deg)`,
        '@media (prefers-reduced-motion: reduce)': {
          left: 0,
          top: 0,
          marginLeft: 0,
          marginTop: 0,
          height: '100%',
          width: '100%',
          animation: `${pulse} 2.5s ease-in-out infinite`,
          backgroundImage: `linear-gradient(to top right, ${spinStart}, ${spinEnd})`,
        },
      }),
    },
  };
});

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
