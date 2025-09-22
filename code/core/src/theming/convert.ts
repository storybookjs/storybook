import { opacify } from 'polished';

import { animation, easing } from './animation';
import { background, color, typography } from './base';
import { themes } from './create';
import { chromeDark, chromeLight, create as createSyntax } from './modules/syntax';
import type { Color, StorybookTheme, ThemeVars, ThemeVarsBase, ThemeVarsColors } from './types';
import { getPreferredColorScheme } from './utils';

const syntaxColors = {
  light: {
    fgColor: {
      positive: '#66BF3C',
      warning: '#E69D00',
      negative: '#FF4400',
      critical: '#FFFFFF',
    },
    bgColor: {
      positive: '#F1FFEB',
      warning: '#FFF9EB',
      negative: '#FFF0EB',
      critical: '#D13800',
    },
    borderColor: {
      positive: '#BFE7AC',
      warning: '#F3D491',
      negative: '#FFC3AD',
      critical: 'hsl(16 100 100 / 0)',
    },
  },
  dark: {
    fgColor: {
      positive: '#86CE64',
      warning: '#EBB747',
      negative: '#FF6933',
      critical: '#FF6933',
    },
    bgColor: {
      positive: 'hsl(101 100% 100% / 0)',
      warning: 'hsl(101 100% 100% / 0)',
      negative: 'hsl(101 100% 100% / 0)',
      critical: 'hsl(101 100% 100% / 0)',
    },
    borderColor: {
      positive: 'hsl(101 52 64 / 0.15)',
      warning: 'hsl(41 67 64 / 0.15)',
      negative: 'hsl(16 100 64 / 0.15)',
      critical: 'hsl(16 100 100 / 0)',
    },
  },
};

const lightSyntaxColors = {
  green1: '#008000',
  red1: '#A31515',
  red2: '#9a050f',
  red3: '#800000',
  red4: '#eb0000',
  gray1: '#393A34',
  cyan1: '#008380',
  cyan2: '#007ca0',
  blue1: '#0000ff',
  blue2: '#00009f',
};

const darkSyntaxColors = {
  green1: '#95999D',
  red1: '#92C379',
  red2: '#9a050f',
  red3: '#A8FF60',
  red4: '#96CBFE',
  gray1: '#EDEDED',
  cyan1: '#C6C5FE',
  cyan2: '#FFFFB6',
  blue1: '#B474DD',
  blue2: '#00009f',
};

const createColors = (base: 'light' | 'dark', vars: ThemeVarsColors) => ({
  // Changeable colors
  primary: vars.colorPrimary,
  secondary: vars.colorSecondary,
  tertiary: color.tertiary,
  ancillary: color.ancillary,

  // Complimentary
  orange: color.orange,
  gold: color.gold,
  green: color.green,
  seafoam: color.seafoam,
  purple: color.purple,
  ultraviolet: color.ultraviolet,

  // Monochrome
  lightest: color.lightest,
  lighter: color.lighter,
  light: color.light,
  mediumlight: color.mediumlight,
  medium: color.medium,
  mediumdark: color.mediumdark,
  dark: color.dark,
  darker: color.darker,
  darkest: color.darkest,

  fgColor: {
    default: vars.textColor || color.darkest,
    muted: vars.textMutedColor || color.dark,
    accent: vars.colorSecondary || color.secondary,
    inverted: vars.textInverseColor || color.lightest,
    positive:
      base === 'dark' ? syntaxColors.dark.fgColor.positive : syntaxColors.light.fgColor.positive,
    negative:
      base === 'dark' ? syntaxColors.dark.fgColor.negative : syntaxColors.light.fgColor.negative,
    warning:
      base === 'dark' ? syntaxColors.dark.fgColor.warning : syntaxColors.light.fgColor.warning,
    critical:
      base === 'dark' ? syntaxColors.dark.fgColor.critical : syntaxColors.light.fgColor.critical,
  },
  bgColor: {
    positive:
      base === 'dark' ? syntaxColors.dark.bgColor.positive : syntaxColors.light.bgColor.positive,
    negative:
      base === 'dark' ? syntaxColors.dark.bgColor.negative : syntaxColors.light.bgColor.negative,
    warning:
      base === 'dark' ? syntaxColors.dark.bgColor.warning : syntaxColors.light.bgColor.warning,
    critical:
      base === 'dark' ? syntaxColors.dark.bgColor.critical : syntaxColors.light.bgColor.critical,
  },
  borderColor: {
    // Status borders
    default: color.border,
    positiveBorder:
      base === 'dark' ? syntaxColors.dark.fgColor.positive : syntaxColors.light.fgColor.positive,
    negativeBorder:
      base === 'dark' ? syntaxColors.dark.fgColor.negative : syntaxColors.light.fgColor.negative,
    warningBorder:
      base === 'dark' ? syntaxColors.dark.fgColor.warning : syntaxColors.light.fgColor.warning,
    criticalBorder:
      base === 'dark' ? syntaxColors.dark.fgColor.critical : syntaxColors.light.fgColor.critical,
  },
});

export const convert = (inherit: ThemeVars = themes[getPreferredColorScheme()]): StorybookTheme => {
  const {
    base,
    colorPrimary,
    colorSecondary,
    appBg,
    appContentBg,
    appPreviewBg,
    appBorderColor,
    appBorderRadius,
    fontBase,
    fontCode,
    textColor,
    textInverseColor,
    barTextColor,
    barHoverColor,
    barSelectedColor,
    barBg,
    buttonBg,
    buttonBorder,
    booleanBg,
    booleanSelectedBg,
    inputBg,
    inputBorder,
    inputTextColor,
    inputBorderRadius,
    brandTitle,
    brandUrl,
    brandImage,
    brandTarget,
    gridCellSize,
    ...rest
  } = inherit;

  return {
    ...rest,

    base,
    color: createColors(base, inherit),
    background: {
      app: appBg,
      bar: barBg,
      content: appContentBg,
      preview: appPreviewBg,
      gridCellSize: gridCellSize || background.gridCellSize,
      hoverable: background.hoverable,
    },
    typography: {
      fonts: {
        base: fontBase,
        mono: fontCode,
      },
      weight: typography.weight,
      size: typography.size,
    },
    animation,
    easing,

    input: {
      background: inputBg,
      border: inputBorder,
      borderRadius: inputBorderRadius,
      color: inputTextColor,
    },

    button: {
      background: buttonBg || inputBg,
      border: buttonBorder || inputBorder,
    },

    boolean: {
      background: booleanBg || inputBorder,
      selectedBackground: booleanSelectedBg || inputBg,
    },

    // UI
    layoutMargin: 10,
    appBorderColor,
    appBorderRadius,

    // Toolbar default/active colors
    barTextColor,
    barHoverColor: barHoverColor || colorSecondary,
    barSelectedColor: barSelectedColor || colorSecondary,
    barBg,

    // Brand logo/text
    brand: {
      title: brandTitle,
      url: brandUrl,
      image: brandImage || (brandTitle ? null : undefined),
      target: brandTarget,
    },

    code: createSyntax({
      colors: base === 'light' ? lightSyntaxColors : darkSyntaxColors,
      mono: fontCode,
    }),

    // Addon actions theme
    // API example https://github.com/storybookjs/react-inspector/blob/master/src/styles/themes/chromeLight.tsx
    addonActionsTheme: {
      ...(base === 'light' ? chromeLight : chromeDark),

      BASE_FONT_FAMILY: fontCode,
      BASE_FONT_SIZE: typography.size.s2 - 1,
      BASE_LINE_HEIGHT: '18px',
      BASE_BACKGROUND_COLOR: 'transparent',
      BASE_COLOR: textColor,
      ARROW_COLOR: opacify(0.2, appBorderColor),
      ARROW_MARGIN_RIGHT: 4,
      ARROW_FONT_SIZE: 8,
      TREENODE_FONT_FAMILY: fontCode,
      TREENODE_FONT_SIZE: typography.size.s2 - 1,
      TREENODE_LINE_HEIGHT: '18px',
      TREENODE_PADDING_LEFT: 12,
    },
  };
};
