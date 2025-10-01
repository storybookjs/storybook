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
  border: 'hsla(212, 50%, 30%, 0.15)',

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
