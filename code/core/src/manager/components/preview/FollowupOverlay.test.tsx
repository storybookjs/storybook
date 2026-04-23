// @vitest-environment happy-dom
import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, ensure, themes } from 'storybook/theming';

import { FollowupOverlay } from './FollowupOverlay.tsx';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={ensure(themes.light)}>{ui}</ThemeProvider>);

describe('FollowupOverlay', () => {
  afterEach(cleanup);

  const siblings = [
    { id: 'button--primary', type: 'story' as const, name: 'Primary', title: 'Button' },
    { id: 'button--secondary', type: 'story' as const, name: 'Secondary', title: 'Button' },
  ];

  it('renders "no longer here" heading by default', () => {
    wrap(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('This story is no longer here')).toBeDefined();
  });

  it('renders "was deleted" heading when requested', () => {
    wrap(
      <FollowupOverlay
        heading="This story was deleted"
        siblings={siblings as any}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('This story was deleted')).toBeDefined();
  });

  it('renders each sibling as a navigable link', () => {
    const onSelect = vi.fn();
    wrap(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        onSelect={onSelect}
      />
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('omits the docs button when no docsEntry is provided', () => {
    wrap(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByText(/docs/i)).toBeNull();
  });

  it('renders the docs button when a docsEntry is provided', () => {
    const docsEntry = {
      id: 'button--docs',
      type: 'docs' as const,
      name: 'Docs',
      title: 'Button',
    };
    wrap(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        docsEntry={docsEntry as any}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/take me to button docs/i)).toBeDefined();
  });
});
