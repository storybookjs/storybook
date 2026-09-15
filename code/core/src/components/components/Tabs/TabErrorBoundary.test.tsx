// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReactElement } from 'react';
import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { TabErrorBoundary } from './TabErrorBoundary.tsx';

function Thrower(): ReactElement {
  throw new Error('Boom');
}

function themed(ui: React.ReactElement, base: 'light' | 'dark') {
  return render(
    <ThemeProvider theme={convert(base === 'dark' ? themes.dark : themes.light)}>
      {ui}
    </ThemeProvider>
  );
}

describe('TabErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    themed(
      <TabErrorBoundary>
        <div>Panel content</div>
      </TabErrorBoundary>,
      'light'
    );
    expect(screen.getByText('Panel content')).toBeDefined();
  });

  it.each(['light', 'dark'] as const)(
    'renders the error fallback when the child throws in the %s theme',
    (base) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      themed(
        <TabErrorBoundary>
          <Thrower />
        </TabErrorBoundary>,
        base
      );
      expect(screen.getByText('Addon panel failed to render')).toBeDefined();
      expect(screen.getByText('Error')).toBeDefined();
      expect(screen.queryByText('Boom')).toBeNull();
    }
  );

  it('logs the panel error to the console', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    themed(
      <TabErrorBoundary>
        <Thrower />
      </TabErrorBoundary>,
      'light'
    );
    expect(errorSpy).toHaveBeenCalledWith('Error rendering addon panel');
  });

  it('renders children of an inactive tab after an error, propagating the throw', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      themed(
        <TabErrorBoundary active={false}>
          <Thrower />
        </TabErrorBoundary>,
        'light'
      );
    }).toThrow('Boom');
  });
});
