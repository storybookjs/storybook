// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

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

    // The tooltip delay (400ms by default) is longer than the dismissal restore, so give the
    // focus-restore tooltip time to appear before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.queryByTestId('tooltip')).toBeNull();
  });

  it('still opens the tooltip on keyboard focus when no popover was dismissed', async () => {
    const user = userEvent.setup();
    render(<ThemedApp />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Trigger button' })).toHaveFocus();

    await waitFor(
      () => {
        expect(screen.queryByTestId('tooltip')).toBeTruthy();
      },
      { timeout: 2000 }
    );
  });
});
