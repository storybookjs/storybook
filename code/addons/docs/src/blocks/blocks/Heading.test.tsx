// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming/emotion';

import { DocsSluggerContext, createDocsSlugger } from './DocsSluggerContext.ts';
import { Heading } from './Heading.tsx';

afterEach(() => cleanup());

const headingIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('h2')).map((heading) => heading.id);

const withSlugger = (slugger: ReturnType<typeof createDocsSlugger>, children: React.ReactNode) => (
  <ThemeProvider theme={convert(themes.light)}>
    <DocsSluggerContext.Provider value={slugger}>{children}</DocsSluggerContext.Provider>
  </ThemeProvider>
);

describe('Heading', () => {
  it('gives duplicate headings on the same page unique anchors', () => {
    const slugger = createDocsSlugger();
    const { container } = render(
      withSlugger(
        slugger,
        <>
          <Heading>Button</Heading>
          <Heading>Button</Heading>
        </>
      )
    );

    expect(headingIds(container)).toEqual(['button', 'button-1']);
  });

  it('keeps its anchor when the docs tree re-renders', () => {
    const slugger = createDocsSlugger();
    // A docs page re-renders whenever its globals change; that must not change the anchor, or
    // existing links to it break.
    const page = () => withSlugger(slugger, <Heading>Button</Heading>);
    const { container, rerender } = render(page());

    expect(headingIds(container)).toEqual(['button']);

    rerender(page());

    expect(headingIds(container)).toEqual(['button']);
  });
});
