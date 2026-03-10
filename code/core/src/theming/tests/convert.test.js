import { describe, expect, it } from 'vitest';

import { convert } from '../convert';
import { create } from '../create';
import darkThemeVars from '../themes/dark';
import lightThemeVars from '../themes/light';

describe('convert', () => {
  it('should return the default theme when no params', () => {
    const result = convert();

    expect(result.base).toEqual('light');
  });
  it('should return a valid dark theme', () => {
    const result = convert(darkThemeVars);

    expect(result.base).toEqual('dark');
    expect(result).toMatchObject({
      color: expect.objectContaining({
        ancillary: '#22a699',
        border: 'hsl(212 50% 30% / 0.15)',
        critical: '#FFFFFF',
        dark: '#5C6570',
        darker: '#454C54',
        darkest: '#2E3338',
        defaultText: '#C9CCCF',
        gold: '#FFAE00',
        green: '#66BF3C',
        inverseText: '#1B1C1D',
        light: '#EEF2F6',
        lighter: '#F6F9FC',
        lightest: '#FFFFFF',
        medium: '#D9E5F2',
        mediumdark: '#737F8C',
        mediumlight: '#ECF2F9',
        negative: '#FF4400',
        negativeText: '#C23400',
        orange: '#FC521F',
        positive: '#66BF3C',
        positiveText: '#427C27',
        primary: '#FF4785',
        purple: '#6F2CAC',
        seafoam: '#37D5D3',
        secondary: '#479DFF',
        tertiary: '#FAFBFC',
        ultraviolet: '#2A0481',
        warning: '#E69D00',
        warningText: '#955B1E',
      }),
      background: expect.objectContaining({
        app: '#1B1C1D',
        bar: '#222325',
        content: '#222325',
        critical: '#D13800',
        gridCellSize: 10,
        hoverable: '#233952',
        negative: '#FFF0EB',
        positive: '#F1FFEB',
        preview: '#FFFFFF',
        warning: '#FFF9EB',
      }),
    });
  });
  it('should return a valid light theme', () => {
    const result = convert(lightThemeVars);

    expect(result.base).toEqual('light');
    expect(result).toMatchObject({
      color: expect.objectContaining({
        ancillary: '#22a699',
        border: 'hsl(212 50% 30% / 0.15)',
        critical: '#FFFFFF',
        dark: '#5C6570',
        darker: '#454C54',
        darkest: '#2E3338',
        defaultText: '#2E3338',
        gold: '#FFAE00',
        green: '#66BF3C',
        inverseText: '#FFFFFF',
        light: '#EEF2F6',
        lighter: '#F6F9FC',
        lightest: '#FFFFFF',
        medium: '#D9E5F2',
        mediumdark: '#737F8C',
        mediumlight: '#ECF2F9',
        negative: '#FF4400',
        negativeText: '#C23400',
        orange: '#FC521F',
        positive: '#66BF3C',
        positiveText: '#427C27',
        primary: '#FF4785',
        purple: '#6F2CAC',
        seafoam: '#37D5D3',
        secondary: '#006DEB',
        tertiary: '#FAFBFC',
        ultraviolet: '#2A0481',
        warning: '#E69D00',
        warningText: '#955B1E',
      }),
      background: expect.objectContaining({
        app: '#F6F9FC',
        bar: '#FFFFFF',
        content: '#FFFFFF',
        critical: '#D13800',
        gridCellSize: 10,
        hoverable: '#DBECFF',
        negative: '#FFF0EB',
        positive: '#F1FFEB',
        preview: '#FFFFFF',
        warning: '#FFF9EB',
      }),
    });
  });
  it('should map optional vars', () => {
    const customVars = create({
      base: 'light',
      brandTitle: 'my custom storybook',
      brandTarget: '_self',
      gridCellSize: 12,
    });

    const result = convert(customVars);
    expect(result.base).toEqual('light');
    expect(result).toMatchObject({
      background: expect.objectContaining({
        gridCellSize: 12,
      }),
      brand: expect.objectContaining({
        title: 'my custom storybook',
        target: '_self',
      }),
    });
  });
});
