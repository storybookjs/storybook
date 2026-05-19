// @vitest-environment happy-dom
import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { Empty } from './Empty';

const renderEmpty = (props?: React.ComponentProps<typeof Empty>) =>
  render(
    <ThemeProvider theme={convert(themes.light)}>
      <Empty {...props} />
    </ThemeProvider>
  );

describe('ArgsTable Empty', () => {
  it('renders the updated controls guidance after the loading delay', async () => {
    renderEmpty();

    expect(screen.queryByText('No controls available for this story')).not.toBeInTheDocument();

    expect(await screen.findByText('No controls available for this story')).toBeVisible();
    expect(
      await screen.findByText(/Storybook didn't find any controllable args for this story/i)
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Learn how to configure controls/i })
    ).toHaveAttribute('href', 'https://storybook.js.org/docs/essentials/controls?ref=ui');
  });
});
