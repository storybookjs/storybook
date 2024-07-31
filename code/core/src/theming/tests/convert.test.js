import { describe, it, expect } from 'vitest';
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
        primary: '#FF4785',
        secondary: '#029CFD',
      }),
      background: expect.objectContaining({
        app: '#222425',
      }),
    });
  });
  it('should return a valid light theme', () => {
    const result = convert(lightThemeVars);

    expect(result.base).toEqual('light');
    expect(result).toMatchObject({
      color: expect.objectContaining({
        primary: '#FF4785',
        secondary: '#029CFD',
      }),
      background: expect.objectContaining({
        app: '#F6F9FC',
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
