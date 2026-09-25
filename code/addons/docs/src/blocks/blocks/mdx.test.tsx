// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { NAVIGATE_URL } from 'storybook/internal/core-events';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { HeaderMdx } from './mdx';

const HEADING_ID = 'my-heading';

const renderHeading = () => {
  const emit = vi.fn();

  render(
    <ThemeProvider theme={convert(themes.light)}>
      <DocsContext.Provider value={{ channel: { emit } } as unknown as DocsContextProps}>
        <HeaderMdx as="h2" id={HEADING_ID}>
          Heading
        </HeaderMdx>
      </DocsContext.Provider>
    </ThemeProvider>
  );

  const heading = document.getElementById(HEADING_ID)!;
  // happy-dom does not implement scrollIntoView.
  heading.scrollIntoView = vi.fn();

  return {
    emit,
    heading,
    anchor: screen.getByRole('link', { name: 'Copy heading URL to address bar' }),
  };
};

describe('HeaderMdx anchor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('scrolls to the heading the anchor points at', () => {
    const { heading, anchor } = renderHeading();

    fireEvent.click(anchor);

    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('emits NAVIGATE_URL so the manager URL follows the heading', () => {
    const { emit, anchor } = renderHeading();

    fireEvent.click(anchor);

    expect(emit).toHaveBeenCalledWith(NAVIGATE_URL, `#${HEADING_ID}`);
  });

  it('prevents the browser from jumping to the anchor itself', () => {
    const { anchor } = renderHeading();

    const defaultWasAllowed = fireEvent.click(anchor);

    expect(defaultWasAllowed).toBe(false);
  });

  it('does nothing when no element carries the heading id', () => {
    const { emit, heading, anchor } = renderHeading();
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    fireEvent.click(anchor);

    expect(heading.scrollIntoView).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
