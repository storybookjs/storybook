// @vitest-environment happy-dom
// The Storybook Vitest project excludes `blocks/**`, so the docs blocks are covered here.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { DocsContextProps } from 'storybook/internal/types';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { ArgTypes } from './ArgTypes.tsx';
import { DocsContext } from './DocsContext.ts';

/** Stands in for a component that documentation names but no story file declares. */
const NeverStoried = () => null;

const renderArgTypes = (componentId: string | undefined) => {
  const context = {
    resolveOf: () => ({
      type: 'component',
      component: NeverStoried,
      projectAnnotations: {
        parameters: { docs: { extractArgTypes: () => ({ label: { name: 'label' } }) } },
      },
    }),
    getComponentId: () => componentId,
  } as unknown as DocsContextProps;

  return render(
    <ThemeProvider theme={convert(themes.light)}>
      <DocsContext.Provider value={context}>
        <ArgTypes of={NeverStoried} />
      </DocsContext.Provider>
    </ThemeProvider>
  );
};

afterEach(() => cleanup());

describe('with the docgen server on', () => {
  beforeEach(() => vi.stubGlobal('FEATURES', { experimentalDocgenServer: true }));
  afterEach(() => vi.unstubAllGlobals());

  it('says the component is unreachable from this page, not that no story declares it', () => {
    // `getComponentId` only searches the CSF files this docs page imports (DocsContext.ts), so
    // `undefined` here means "not reachable from this page", not "no story anywhere declares it" -
    // a distinction the message must not blur into telling the reader to add a story they may
    // already have.
    renderArgTypes(undefined);
    expect(screen.queryByText(/No docs found for this component on this page/)).not.toBeNull();
    expect(screen.queryByText(/Add a story whose/)).toBeNull();
  });
});

describe('with the docgen server off', () => {
  beforeEach(() => vi.stubGlobal('FEATURES', { experimentalDocgenServer: false }));
  afterEach(() => vi.unstubAllGlobals());

  it("renders the renderer extractor's rows for the same component", () => {
    renderArgTypes(undefined);
    expect(screen.queryByText('label')).not.toBeNull();
    expect(screen.queryByText(/No docs found for this component/)).toBeNull();
  });
});
