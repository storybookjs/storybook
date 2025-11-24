import { color } from '../primitive/color';

interface FgColor {
  default: string;
  mute: string;
  inverse: string;
  accent: string;
  positive: string;
  warning: string;
  negative: string;
  // do we also need a white and black color?
}

interface BgColor {
  default: string;
  mute: string;
  accent: string;
  positive: string;
  warning: string;
  negative: string;
}

interface BorderColor {
  default: string;
  accent: string;
  positive: string;
  warning: string;
  negative: string;
}

interface Colors {
  fgColor: FgColor;
  bgColor: BgColor;
  borderColor: BorderColor;
}

interface Theme {
  light: Colors;
  dark: Colors;
}

export const theme: Theme = {
  light: {
    fgColor: {
      default: color.neutral.l20,
      mute: color.neutral.l40,
      inverse: color.neutral.white,
      accent: color.blue.l44,
      positive: color.green.l32,
      warning: color.gold.l36, // Needs a better hue
      negative: color.red.l36,
    },
    bgColor: {
      default: color.neutral.white,
      mute: color.neutral.l96, // might need to add 98 as an option
      accent: color.blue.l44,
      positive: color.green.l96,
      warning: color.gold.l96,
      negative: color.red.l96, // double check
    },
    borderColor: {
      default: `hsl(from ${color.blue.l44} / 15%)`,
      // need a muted color?
      accent: color.blue.l84, // rename?
      positive: color.green.l80,
      warning: color.gold.l84,
      negative: color.red.l80,
    },
  },
  dark: {
    fgColor: {
      default: color.neutral.l80,
      mute: color.neutral.l60,
      inverse: color.neutral.l12, // maybe a touch darker
      accent: color.blue.l64,
      positive: color.green.l60,
      warning: color.gold.l60,
      negative: color.red.l60,
    },
    bgColor: {
      default: color.neutral.l12,
      mute: color.neutral.l12,
      accent: color.blue.l44,
      positive: 'unset',
      warning: 'unset',
      negative: 'unset',
    },
    borderColor: {
      default: `hsl(from ${color.neutral.white} / 10%)`,
      accent: `hsl(from ${color.blue.l64} / 15%)`,
      positive: `hsl(from ${color.green.l64} / 15%)`,
      warning: `hsl(from ${color.gold.l64} / 15%)`,
      negative: `hsl(from ${color.red.l64} / 15%)`,
    },
  },
};

// test should pass
// const passingTest = theme.light.fgColor.default;

// test should fail
// const failingTest = theme.light.fgColor.mutes;

// Needs more research
// const sizes = {
//   padding: {},
//   gap: {},
// };

// const typography = {};

// export const semantic = {
//   colors: colors,
//   sizes: sizes,
//   typography: typography,
// };
