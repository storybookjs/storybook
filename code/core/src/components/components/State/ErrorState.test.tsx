// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { ErrorState } from './ErrorState.tsx';

function themed(ui: React.ReactElement, base: 'light' | 'dark') {
  return render(
    <ThemeProvider theme={convert(base === 'dark' ? themes.dark : themes.light)}>
      {ui}
    </ThemeProvider>
  );
}

describe('ErrorState', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(['light', 'dark'] as const)(
    'renders the negative severity word and title in the %s theme',
    (base) => {
      themed(<ErrorState severity="negative" title="Addon panel failed to render" />, base);
      expect(screen.getByText('Error')).toBeDefined();
      expect(screen.getByText('Addon panel failed to render')).toBeDefined();
    }
  );

  it.each(['light', 'dark'] as const)(
    'renders the critical severity word in the %s theme',
    (base) => {
      themed(<ErrorState severity="critical" title="Storybook crashed" />, base);
      expect(screen.getByText('Critical')).toBeDefined();
      expect(screen.getByText('Storybook crashed')).toBeDefined();
    }
  );

  it('renders summary and actions when provided', () => {
    themed(
      <ErrorState
        severity="negative"
        title="Addon panel failed to render"
        summary="An error in this addon prevented the panel from rendering."
        actions={<button type="button">Reload Storybook</button>}
      />,
      'light'
    );
    expect(
      screen.getByText('An error in this addon prevented the panel from rendering.')
    ).toBeDefined();
    expect(screen.getByText('Reload Storybook')).toBeDefined();
  });

  it('omits the summary and actions when absent', () => {
    const { container } = themed(
      <ErrorState severity="negative" title="Addon panel failed to render" />,
      'light'
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it.each(['light', 'dark'] as const)(
    'hides the severity badge with showBadge={false} in the %s theme',
    (base) => {
      themed(
        <ErrorState severity="negative" title="Addon panel failed to render" showBadge={false} />,
        base
      );
      expect(screen.queryByText('Error')).toBeNull();
      expect(screen.getByText('Addon panel failed to render')).toBeDefined();
    }
  );
});
