import { describe, expect, it } from 'vitest';

import { createPackageMatcher, packageNameOf } from './package-pattern.ts';

describe('packageNameOf', () => {
  it('takes the first segment of an unscoped specifier', () => {
    expect(packageNameOf('react')).toBe('react');
    expect(packageNameOf('react-router-dom')).toBe('react-router-dom');
  });

  it('drops subpaths', () => {
    expect(packageNameOf('react-dom/client')).toBe('react-dom');
    expect(packageNameOf('lodash/fp/curry')).toBe('lodash');
  });

  it('keeps both segments of a scoped package', () => {
    expect(packageNameOf('@base-ui/react')).toBe('@base-ui/react');
    expect(packageNameOf('@base-ui/react/button')).toBe('@base-ui/react');
    expect(packageNameOf('@droppy/theme/styles.css')).toBe('@droppy/theme');
  });
});

describe('createPackageMatcher', () => {
  it('matches exact package names, including subpath imports of them', () => {
    const isDs = createPackageMatcher(['@base-ui/react']);
    expect(isDs('@base-ui/react')).toBe(true);
    expect(isDs('@base-ui/react/button')).toBe(true);
    expect(isDs('@base-ui/react-extras')).toBe(false);
    expect(isDs('react')).toBe(false);
  });

  it('supports * wildcards within a segment', () => {
    const isDs = createPackageMatcher(['@ds/*']);
    expect(isDs('@ds/button')).toBe(true);
    expect(isDs('@ds/button/icon')).toBe(true);
    expect(isDs('@dsx/button')).toBe(false);
    expect(isDs('@ds-legacy/button')).toBe(false);
  });

  it('matches when any of several patterns matches', () => {
    const isDs = createPackageMatcher(['@base-ui/react', '@droppy/*']);
    expect(isDs('@droppy/theme')).toBe(true);
    expect(isDs('@base-ui/react/dialog')).toBe(true);
    expect(isDs('styled-components')).toBe(false);
  });

  it('escapes regex metacharacters in patterns', () => {
    const isDs = createPackageMatcher(['a+b']);
    expect(isDs('a+b')).toBe(true);
    expect(isDs('aab')).toBe(false);
  });

  // A design system is not always a whole package. Storybook ships one at
  // `storybook/internal/components` while the rest of `storybook` is not UI at
  // all, so a pattern has to be able to name a subpath.
  it('matches a pattern that names a subpath rather than a package', () => {
    const isDs = createPackageMatcher(['storybook/internal/components']);
    expect(isDs('storybook/internal/components')).toBe(true);
    expect(isDs('storybook/internal/components/Button')).toBe(true);
    expect(isDs('storybook/internal/theming')).toBe(false);
    expect(isDs('storybook/internal/types')).toBe(false);
    expect(isDs('storybook')).toBe(false);
  });

  it('holds a subpath pattern to a path boundary', () => {
    const isDs = createPackageMatcher(['storybook/internal/components']);
    expect(isDs('storybook/internal/components-legacy')).toBe(false);
    expect(isDs('storybook/internal/componentsx')).toBe(false);
  });

  // A pattern naming the package still covers everything under it, which is
  // what the `@base-ui/react` cases above rely on.
  it('lets a package pattern cover every subpath of that package', () => {
    const isDs = createPackageMatcher(['storybook']);
    expect(isDs('storybook')).toBe(true);
    expect(isDs('storybook/internal/components')).toBe(true);
    expect(isDs('storybook-addon-x')).toBe(false);
  });
});
