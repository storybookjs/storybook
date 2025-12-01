export const color = {
  // Official color palette
  primary: '#FF4785', // coral
  secondary: '#006DEB', // ocean
  tertiary: '#FAFBFC',
  ancillary: '#22a699',

  // Complimentary
  orange: '#FC521F',
  gold: '#FFAE00',
  green: '#66BF3C',
  seafoam: '#37D5D3',
  purple: '#6F2CAC',
  ultraviolet: '#2A0481',

  // Monochrome
  lightest: '#FFFFFF',
  lighter: '#F6F9FC',
  light: '#EEF2F6',
  mediumlight: '#ECF2F9',
  medium: '#D9E5F2',
  mediumdark: '#737F8C',
  dark: '#5C6570',
  darker: '#454C54',
  darkest: '#2E3338',

  // For borders
  border: 'hsl(212 50% 30% / 0.15)',

  // Status
  positive: '#66BF3C',
  warning: '#E69D00',
  negative: '#FF4400',
  critical: '#FFFFFF',

  // Text
  defaultText: '#2E3338',
  inverseText: '#FFFFFF',
  positiveText: '#427C27',
  warningText: '#955B1E',
  negativeText: '#C23400',
};

export const background = {
  app: '#F6F9FC',
  bar: color.lightest,
  content: color.lightest,
  preview: color.lightest,
  gridCellSize: 10,
  hoverable: '#DBECFF',

  // Notification, error, and warning backgrounds
  positive: '#F1FFEB',
  warning: '#FFF9EB',
  negative: '#FFF0EB',
  critical: '#D13800',
};

export const typography = {
  fonts: {
    base: [
      '"Nunito Sans"',
      '-apple-system',
      '".SFNSText-Regular"',
      '"San Francisco"',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      '"Helvetica Neue"',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(', '),
    mono: [
      'ui-monospace',
      'Menlo',
      'Monaco',
      '"Roboto Mono"',
      '"Oxygen Mono"',
      '"Ubuntu Monospace"',
      '"Source Code Pro"',
      '"Droid Sans Mono"',
      '"Courier New"',
      'monospace',
    ].join(', '),
  },
  weight: {
    regular: 400,
    bold: 700,
  },
  size: {
    s1: 12,
    s2: 14,
    s3: 16,
    m1: 20,
    m2: 24,
    m3: 28,
    l1: 32,
    l2: 40,
    l3: 48,
    code: 90,
  },
};

export const tokens = {
  light: {
    fgColor: {
      default: color.darkest,
      muted: color.dark,
      accent: color.secondary,
      inverse: color.lightest,
      // TODO: add 'disabled'
      positive: '#427C27',
      warning: '#7A4100',
      negative: '#C23400',
      critical: '#FFFFFF',
    },
    bgColor: {
      default: color.lightest,
      muted: background.app,
      // TODO: add 'accent'? white or blue?
      positive: '#F1FFEB',
      warning: '#FFF7EB',
      negative: '#FFF0EB',
      critical: '#D13800',
    },
    borderColor: {
      default: color.border,
      muted: 'hsl(0 0% 0% / 0.1)',
      inverse: 'hsl(0 0% 100% / 0.1)',
      positive: '#BFE7AC',
      warning: '#FFCE85',
      negative: '#FFC3AD',
      critical: 'hsl(16 100% 100% / 0)',
    },
  },
  dark: {
    fgColor: {
      default: '#C9CCCF',
      muted: '#95999D',
      accent: '#479DFF',
      inverse: '#1B1C1D',
      // TODO: add 'disabled'
      positive: '#86CE64',
      warning: '#FFAD33',
      negative: '#FF6933',
      critical: '#FF6933',
    },
    bgColor: {
      default: '#222325',
      muted: '#1B1C1D',
      // TODO: add 'accent'? white or blue?
      positive: 'hsl(101 100% 100% / 0)',
      warning: 'hsl(101 100% 100% / 0)',
      negative: 'hsl(101 100% 100% / 0)',
      critical: 'hsl(101 100% 100% / 0)',
    },
    borderColor: {
      default: 'hsl(0 0% 100% / 0.1)',
      muted: 'hsl(0 0% 100% / 0.5)',
      inverse: 'hsl(0 0% 0% / 0.1)',
      positive: 'hsl(101 52% 64% / 0.15)',
      warning: 'hsl(36 100% 64% / 0.15)',
      negative: 'hsl(16 100% 64% / 0.15)',
      critical: '#FF6933',
    },
  },
};
