// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { createDocsSlugger, DocsSluggerContext } from './DocsSluggerContext';
import { Heading } from './Heading';
import { Subheading } from './Subheading';

const renderWithSlugger = (children: React.ReactNode) => {
  return render(
    <ThemeProvider theme={convert(themes.light)}>
      <DocsSluggerContext.Provider value={createDocsSlugger()}>
        {children}
      </DocsSluggerContext.Provider>
    </ThemeProvider>
  );
};

describe('Heading and Subheading', () => {
  afterEach(() => {
    cleanup();
  });

  it('deduplicates repeated subheading IDs across heading groups', () => {
    const { container } = renderWithSlugger(
      <>
        {['Button', 'Input', 'Tooltip'].map((section) => (
          <React.Fragment key={section}>
            <Heading>{section}</Heading>
            <Subheading>Properties</Subheading>
            <Subheading>Slots</Subheading>
            <Subheading>Events</Subheading>
          </React.Fragment>
        ))}
      </>
    );

    expect(Array.from(container.querySelectorAll('h2, h3')).map((heading) => heading.id)).toEqual([
      'button',
      'properties',
      'slots',
      'events',
      'input',
      'properties-1',
      'slots-1',
      'events-1',
      'tooltip',
      'properties-2',
      'slots-2',
      'events-2',
    ]);
  });
});
