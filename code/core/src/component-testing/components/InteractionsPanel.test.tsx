// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { API } from 'storybook/manager-api';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { CallStates } from '../../instrumenter/types';
import { getCalls, getInteractions } from '../mocks';
import { InteractionsPanel } from './InteractionsPanel';

type InteractionsPanelProps = React.ComponentProps<typeof InteractionsPanel>;

const createProps = (overrides: Partial<InteractionsPanelProps> = {}): InteractionsPanelProps => ({
  storyUrl: 'http://localhost:6006/?path=/story/core-component-test-basics--step',
  status: 'completed',
  controls: {
    start: vi.fn(),
    back: vi.fn(),
    goto: vi.fn(),
    next: vi.fn(),
    end: vi.fn(),
    rerun: vi.fn(),
  },
  controlStates: {
    detached: false,
    start: true,
    back: true,
    goto: true,
    next: true,
    end: true,
  },
  interactions: getInteractions(CallStates.DONE),
  calls: new Map(getCalls(CallStates.DONE).map((call) => [call.id, call])),
  api: { openInEditor: vi.fn() } as unknown as API,
  ...overrides,
});

const renderPanel = (props: InteractionsPanelProps) =>
  render(
    <ThemeProvider theme={convert(themes.light)}>
      <InteractionsPanel {...props} />
    </ThemeProvider>
  );

describe('InteractionsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders interaction steps as semantic list items with actionable labels', () => {
    renderPanel(createProps());

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', {
        name: 'Go to interaction step: Click button. Status: passed.',
      })
    ).toBeInTheDocument();
  });

  it('labels nested-step toggle buttons with action and expanded state', () => {
    const interactions = getInteractions(CallStates.DONE).map((interaction) =>
      interaction.method === 'step'
        ? { ...interaction, childCallIds: ['child-call-id'], isCollapsed: false }
        : interaction
    );

    renderPanel(createProps({ interactions }));

    const toggle = screen.getByRole('button', {
      name: 'Collapse nested interaction steps for Click button',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('labels nested-step toggle buttons with action and collapsed state', () => {
    const interactions = getInteractions(CallStates.DONE).map((interaction) =>
      interaction.method === 'step'
        ? { ...interaction, childCallIds: ['child-call-id'], isCollapsed: true }
        : interaction
    );

    renderPanel(createProps({ interactions }));

    const toggle = screen.getByRole('button', {
      name: 'Expand nested interaction steps for Click button',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('announces run status and updates busy state across lifecycle statuses', () => {
    const { rerender } = renderPanel(
      createProps({
        status: 'rendering',
        interactions: getInteractions(CallStates.ACTIVE),
      })
    );

    expect(screen.getByRole('status')).toHaveTextContent('Component test is rendering.');
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <ThemeProvider theme={convert(themes.light)}>
        <InteractionsPanel
          {...createProps({
            status: 'playing',
            interactions: getInteractions(CallStates.ACTIVE),
          })}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Component test is running.');
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <ThemeProvider theme={convert(themes.light)}>
        <InteractionsPanel
          {...createProps({
            status: 'errored',
            interactions: getInteractions(CallStates.ERROR),
          })}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Component test failed.');
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false');

    rerender(
      <ThemeProvider theme={convert(themes.light)}>
        <InteractionsPanel
          {...createProps({
            status: 'completed',
            interactions: getInteractions(CallStates.DONE),
          })}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Component test completed successfully.');
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false');

    rerender(
      <ThemeProvider theme={convert(themes.light)}>
        <InteractionsPanel
          {...createProps({
            status: 'aborted',
            interactions: getInteractions(CallStates.DONE),
          })}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Component test was aborted.');
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false');
  });
});
