// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';
import type { FC, PropsWithChildren } from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { Subtitle } from './Subtitle';
import { Title } from './Title';

const Providers: FC<PropsWithChildren<{ context: Partial<DocsContextProps> }>> = ({
  children,
  context,
}) => (
  <ThemeProvider theme={convert(themes.light)}>
    <DocsContext.Provider value={context as DocsContextProps}>{children}</DocsContext.Provider>
  </ThemeProvider>
);

const metaContext = (parameters: Record<string, any>, title = 'My Component') =>
  ({
    resolveOf: vi.fn(() => ({ type: 'meta', preparedMeta: { title, parameters } })),
  }) as unknown as Partial<DocsContextProps>;

afterEach(() => cleanup());

describe('docs prose lang', () => {
  it('languages the Title from docs.lang', () => {
    const { container } = render(
      <Providers context={metaContext({ docs: { lang: 'de' } })}>
        <Title />
      </Providers>
    );
    expect(container.querySelector('h1')?.getAttribute('lang')).toBe('de');
  });

  it('defaults the Title to en when docs.lang is unset', () => {
    const { container } = render(
      <Providers context={metaContext({})}>
        <Title />
      </Providers>
    );
    expect(container.querySelector('h1')?.getAttribute('lang')).toBe('en');
  });

  it('languages the Subtitle from docs.lang', () => {
    const { container } = render(
      <Providers context={metaContext({ docs: { subtitle: 'Untertitel', lang: 'de' } })}>
        <Subtitle />
      </Providers>
    );
    expect(container.querySelector('h2')?.getAttribute('lang')).toBe('de');
  });
});
