import type { ReactNode } from 'react';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, ensure, themes } from '@storybook/theming';

import type { Theme } from '@storybook/theming';
import { CustomMenuItem } from './CustomMenuItem';

const renderWithTheme = (children: ReactNode) => {
  const theme: Theme = ensure(themes.light);

  return render(<ThemeProvider theme={theme}>{children}</ThemeProvider>);
};

describe('CustomMenuItem tests', () => {
  it('Renders label, description and keyboardShorcut correctly', async () => {
    const label = 'Label';

    const description = 'description';

    const keyboardShortcut: React.ComponentProps<typeof CustomMenuItem>['keyboardShortcut'] = {
      label: '⌘ + S',
      ariaKeyshortcuts: 'Meta+S',
    };

    renderWithTheme(
      <CustomMenuItem label={label} description={description} keyboardShortcut={keyboardShortcut} />
    );

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(description)).toBeVisible();
    expect(screen.getByText(keyboardShortcut.label)).toBeVisible();
  });
});
