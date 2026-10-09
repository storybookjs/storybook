// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { EmptyState } from './EmptyState.tsx';

function themed(ui: React.ReactElement, base: 'light' | 'dark') {
  return render(
    <ThemeProvider theme={convert(base === 'dark' ? themes.dark : themes.light)}>
      {ui}
    </ThemeProvider>
  );
}

describe('EmptyState', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(['light', 'dark'] as const)('renders title and description in the %s theme', (base) => {
    themed(
      <EmptyState
        title="No stories found"
        description="Your selected filters did not match any stories."
      />,
      base
    );
    expect(screen.getByText('No stories found')).toBeDefined();
    expect(screen.getByText('Your selected filters did not match any stories.')).toBeDefined();
  });

  it.each(['light', 'dark'] as const)('renders its action in the %s theme', (base) => {
    themed(
      <EmptyState
        title="No stories found"
        description="Your selected filters did not match any stories."
        action={<button type="button">Clear filters</button>}
      />,
      base
    );
    expect(screen.getByText('Clear filters')).toBeDefined();
  });

  it('never renders a severity label', () => {
    themed(<EmptyState title="No stories found" />, 'light');
    expect(screen.queryByText('Error')).toBeNull();
    expect(screen.queryByText('Critical')).toBeNull();
  });

  it('omits the description and action when absent', () => {
    const { container } = themed(<EmptyState title="No stories found" />, 'light');
    expect(screen.getByText('No stories found')).toBeDefined();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
