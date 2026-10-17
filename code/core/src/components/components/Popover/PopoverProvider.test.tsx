// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { Button } from '../Button/Button.tsx';
import { PopoverProvider } from './PopoverProvider.tsx';

function ThemedApp() {
  return (
    <ThemeProvider theme={convert(themes.light)}>
      <PopoverProvider ariaLabel="Test popover" popover={<div>Popover content</div>}>
        <Button ariaLabel="Trigger button">Trigger</Button>
      </PopoverProvider>
      <Button ariaLabel="Other button">Other</Button>
    </ThemeProvider>
  );
}

describe('PopoverProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not open the trigger tooltip after an Escape dismissal, leaving the next Escape free for shortcuts', async () => {
    const user = userEvent.setup();
    render(<ThemedApp />);

    await user.click(screen.getByRole('button', { name: 'Trigger button' }));
    expect(await screen.findByText('Popover content')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Popover content')).toBeNull();
    });

    await act(async () => {});
    expect(screen.queryByTestId('tooltip')).toBeNull();

    const shortcutListener = vi.fn();
    document.addEventListener('keydown', shortcutListener);
    try {
      await user.keyboard('{Escape}');
      expect(shortcutListener).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', shortcutListener);
    }
  });

  it('still opens the tooltip on keyboard focus when no popover was dismissed', async () => {
    const user = userEvent.setup();
    render(<ThemedApp />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Trigger button' })).toHaveFocus();

    await waitFor(() => {
      expect(screen.queryByTestId('tooltip')).toBeTruthy();
    });
  });

  it('suppresses the focus-restore tooltip only once, so a later keyboard refocus opens it', async () => {
    const user = userEvent.setup();
    render(<ThemedApp />);

    await user.click(screen.getByRole('button', { name: 'Trigger button' }));
    expect(await screen.findByText('Popover content')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Popover content')).toBeNull();
    });
    await act(async () => {});
    expect(screen.queryByTestId('tooltip')).toBeNull();

    await user.tab();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Trigger button' })).toHaveFocus();

    await waitFor(() => {
      expect(screen.queryByTestId('tooltip')).toBeTruthy();
    });
  });
});
