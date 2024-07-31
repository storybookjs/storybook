import { describe, it, expect } from 'vitest';
import { create } from '../create';

describe('create base', () => {
  it('should create a theme with minimal viable theme', () => {
    const result = create({ base: 'light' });

    expect(result).toBeDefined();
  });
  it('should pick `light` when `base` is missing', () => {
    const result = create({ base: undefined });

    expect(result.base).toBe('light');
  });
  it('should pick `light` when nothing is given', () => {
    const result = create();

    expect(result.base).toBe('light');
  });
  it('should pick `dark` when base is dark', () => {
    const result = create({ base: 'dark' });

    expect(result.base).toBe('dark');
  });
  it('should pick `light` when base is a unknown value', () => {
    const result = create({ base: 'foobar' });

    expect(result.base).toBe('light');
  });
});

describe('create merge', () => {
  it('should merge colorPrimary', () => {
    const result = create({ base: 'light', colorPrimary: 'orange' });

    expect(result).toHaveProperty('colorPrimary', 'orange');
  });
  it('should merge colorSecondary', () => {
    const result = create({ base: 'light', colorSecondary: 'orange' });

    expect(result).toHaveProperty('colorSecondary', 'orange');
  });
  it('should merge appBg', () => {
    const result = create({ base: 'light', appBg: 'orange' });

    expect(result).toHaveProperty('appBg', 'orange');
  });
});

describe('create brand', () => {
  it('should have default', () => {
    const result = create({ base: 'light' });

    expect(result.brandImage).not.toBeDefined();
    expect(result.brandTitle).not.toBeDefined();
    expect(result.brandUrl).not.toBeDefined();
    expect(result.brandTarget).not.toBeDefined();
  });
  it('should accept null', () => {
    const result = create({
      base: 'light',
      brandTitle: null,
      brandUrl: null,
      brandImage: null,
      brandTarget: null,
    });

    expect(result).toMatchObject({
      brandImage: null,
      brandTitle: null,
      brandUrl: null,
      brandTarget: null,
    });
  });
  it('should accept values', () => {
    const result = create({
      base: 'light',
      brandImage: 'https://storybook.js.org/images/placeholders/350x150.png',
      brandTitle: 'my custom storybook',
      brandUrl: 'https://example.com',
      brandTarget: '_top',
    });

    expect(result).toMatchObject({
      brandImage: 'https://storybook.js.org/images/placeholders/350x150.png',
      brandTitle: 'my custom storybook',
      brandUrl: 'https://example.com',
      brandTarget: '_top',
    });
  });
});

describe('create grid', () => {
  it('should have default', () => {
    const result = create({ base: 'light' });

    expect(result.gridCellSize).not.toBeDefined();
  });
  it('should accept null', () => {
    const result = create({ base: 'light', gridCellSize: null });

    expect(result).toMatchObject({
      gridCellSize: null,
    });
  });
  it('should accept values', () => {
    const result = create({
      base: 'light',
      gridCellSize: 12,
    });

    expect(result).toMatchObject({
      gridCellSize: 12,
    });
  });
});

describe('create extend', () => {
  it('should allow custom props', () => {
    const result = create(
      {
        base: 'light',
      },
      {
        myCustomProperty: 42,
      }
    );

    expect(result.myCustomProperty).toEqual(42);
  });
  it('should not allow overriding known properties with custom props', () => {
    const result = create(
      {
        base: 'light',
      },
      {
        base: 42,
      }
    );

    expect(result.base).toEqual('light');
  });
});
