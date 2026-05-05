// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import React from 'react';

import { ThemeProvider, ensure, themes } from 'storybook/theming';

import { Brand } from '../Brand.tsx';

const renderBrand = (brandTheme: Record<string, unknown>) => {
  const theme = { ...ensure(themes.light), brand: brandTheme };
  return render(
    <ThemeProvider theme={theme as any}>
      <Brand />
    </ThemeProvider>
  );
};

describe('Brand – XSS sanitization', () => {
  test('strips script tags from title when image is null', () => {
    const { container } = renderBrand({
      image: null,
      title: 'Hello<script>alert("xss")</script>',
      url: '',
    });
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('Hello');
  });

  test('strips inline event handlers from title when image is null', () => {
    const { container } = renderBrand({
      image: null,
      title: '<img src=x onerror="alert(1)">',
      url: '',
    });
    expect(container.innerHTML).not.toContain('onerror');
  });

  test('preserves safe inline HTML in title when image is null', () => {
    const { container } = renderBrand({
      image: null,
      title: '<strong>My Brand</strong>',
      url: '',
    });
    expect(container.innerHTML).toContain('<strong>My Brand</strong>');
  });

  test('sanitizes title when rendered inside a link', () => {
    const { container } = renderBrand({
      image: null,
      title: 'Brand<script>alert(1)</script>',
      url: 'https://example.com',
    });
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('Brand');
  });
});
