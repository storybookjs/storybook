import type { ReactNode } from 'react';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, ensure, themes } from '@storybook/theming';
import { Button } from '@storybook/components';

import type { Theme } from '@storybook/theming';
import { fireEvent, userEvent } from '@storybook/testing-library';
import { DropdownMenu } from './DropdownMenu';

const renderWithTheme = (children: ReactNode) => {
  const theme: Theme = ensure(themes.light);

  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
};

describe('DropdownMenu tests', () => {
  it('Is opened by the custom menu trigger, when passing asChild property to DropdownMenu.Trigger', async () => {
    const user = userEvent.setup();

    const itemLabel = 'About your Storybook';

    const buttonLabel = 'Settings';

    renderWithTheme(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost">{buttonLabel}</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item label={itemLabel} startInlineIndent />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );

    user.click(
      screen.getByRole('button', {
        name: buttonLabel,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('menuitem', {
          name: itemLabel,
        })
      ).toBeVisible();
    });
  });

  it('Is open by default when passing defaultOpen to DropdownMenu.Root', async () => {
    const itemLabel = 'About your Storybook';

    renderWithTheme(
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Settings</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item label={itemLabel} startInlineIndent />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('menuitem', {
          name: itemLabel,
        })
      ).toBeVisible();
    });
  });
});

describe('DropdownMenu.Item', () => {
  it('Triggers onSelect when clicked', async () => {
    const itemLabel = 'About your Storybook';

    const onSelect = jest.fn();

    renderWithTheme(
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Settings</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item label={itemLabel} startInlineIndent onSelect={onSelect} />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );

    /**
     * We need fireEvent here, since userEvent does not "click" on an item unless it's a button
     */
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: itemLabel,
      })
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
