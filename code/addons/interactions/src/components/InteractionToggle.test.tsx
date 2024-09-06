// @vitest-environment happy-dom
/// <reference types="@testing-library/jest-dom" />;
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/internal/theming';

import { INTERACTION_STORAGE_KEY, InteractionToggle } from './InteractionToggle';

describe('InteractionToggle', () => {
  it('should render tool button with correct initial values', async () => {
    render(
      <ThemeProvider theme={convert(themes.light)}>
        <InteractionToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Disable Interactions' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Disable Interactions' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    );
    userEvent.click(screen.getByRole('button', { name: 'Disable Interactions' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Disable Interactions' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
  });

  it('should render tool button', async () => {
    render(
      <ThemeProvider theme={convert(themes.light)}>
        <InteractionToggle />
      </ThemeProvider>
    );

    const localStorageMock = {
      setItem: vi.fn(),
      getItem: vi.fn(() => 'false'),
    };

    vi.stubGlobal('localStorage', localStorageMock);
    await waitFor(() =>
      userEvent.click(screen.getByRole('button', { name: 'Disable Interactions' }))
    );
    await waitFor(() => expect(localStorageMock.setItem).toHaveBeenCalled());
  });
});
