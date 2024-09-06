import { transparentize } from './utils';

export const color = {
  // Official color palette
  primary: '#FF4785', // coral
  secondary: '#029CFD', // ocean
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
  lighter: '#F7FAFC',
  light: '#EEF3F6',
  mediumlight: '#ECF4F9',
  medium: '#D9E8F2',
  mediumdark: '#73828C',
  dark: '#5C6870',
  darker: '#454E54',
  darkest: '#2E3438',

  // For borders
  border: 'hsla(203, 50%, 30%, 0.15)',

  // Status
  positive: '#66BF3C',
  negative: '#FF4400',
  warning: '#E69D00',
  critical: '#FFFFFF',

  // Text
  defaultText: '#2E3438',
  inverseText: '#FFFFFF',
  positiveText: '#448028',
  negativeText: '#D43900',
  warningText: '#A15C20',
};

export const background = {
  app: '#F6F9FC',
  bar: color.lightest,
  content: color.lightest,
  preview: color.lightest,
  gridCellSize: 10,
  hoverable: transparentize(0.9, color.secondary), // hover state for items in a list

  // Notification, error, and warning backgrounds
  positive: '#E1FFD4',
  negative: '#FEDED2',
  warning: '#FFF5CF',
  critical: '#FF4400',
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
