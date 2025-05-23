// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as React from 'react';

import {
  STORY_FINISHED,
  STORY_RENDER_PHASE_CHANGED,
  type StoryFinishedPayload,
} from 'storybook/internal/core-events';

import type { AxeResults } from 'axe-core';
import * as api from 'storybook/manager-api';

import { EVENTS } from '../constants';
import { A11yContextProvider, useA11yContext } from './A11yContext';

vi.mock('storybook/manager-api');
const mockedApi = vi.mocked(api);

const storyId = 'button--primary';
const axeResult: Partial<AxeResults> = {
  incomplete: [
    {
      id: 'color-contrast',
      impact: 'serious',
      tags: [],
      description:
        'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds',
      help: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/3.2/color-contrast?application=axeAPI',
      nodes: [],
    },
  ],
  passes: [
    {
      id: 'aria-allowed-attr',
      impact: undefined,
      tags: [],
      description: "Ensures ARIA attributes are allowed for an element's role",
      help: 'Elements must only use allowed ARIA attributes',
      helpUrl: 'https://dequeuniversity.com/rules/axe/3.2/aria-allowed-attr?application=axeAPI',
      nodes: [],
    },
  ],
  violations: [
    {
      id: 'color-contrast',
      impact: 'serious',
      tags: [],
      description:
        'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds',
      help: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/3.2/color-contrast?application=axeAPI',
      nodes: [],
    },
  ],
};

describe('A11yContext', () => {
  afterEach(() => {
    cleanup();
  });

  const onAllStatusChange = vi.fn();
  const getAll = vi.fn();
  const set = vi.fn();
  const onSelect = vi.fn();
  const unset = vi.fn();

  const getCurrentStoryData = vi.fn();
  const getParameters = vi.fn();
  const getQueryParam = vi.fn();

  beforeEach(() => {
    mockedApi.experimental_getStatusStore.mockReturnValue({
      onAllStatusChange,
      getAll,
      set,
      onSelect,
      unset,
    } as any);
    mockedApi.useAddonState.mockImplementation((_, defaultState) => React.useState(defaultState));
    mockedApi.useChannel.mockReturnValue(vi.fn());
    getCurrentStoryData.mockReturnValue({ id: storyId, type: 'story' });
    getParameters.mockReturnValue({});
    mockedApi.useStorybookApi.mockReturnValue({
      getCurrentStoryData,
      getParameters,
      getQueryParam,
    } as any);
    mockedApi.useParameter.mockReturnValue({ manual: false });
    mockedApi.useStorybookState.mockReturnValue({ storyId } as any);
    mockedApi.useGlobals.mockReturnValue([{ a11y: {} }] as any);

    mockedApi.useChannel.mockClear();
    mockedApi.useStorybookApi.mockClear();
    mockedApi.useAddonState.mockClear();
    mockedApi.useParameter.mockClear();
    mockedApi.useStorybookState.mockClear();
    mockedApi.useGlobals.mockClear();
  });

  it('should render children', () => {
    const { getByTestId } = render(
      <A11yContextProvider>
        <div data-testid="child" />
      </A11yContextProvider>
    );
    expect(getByTestId('child')).toBeTruthy();
  });

  it('should handle STORY_FINISHED event correctly', () => {
    const emit = vi.fn();
    mockedApi.useChannel.mockReturnValue(emit);

    const Component = () => {
      const { results } = useA11yContext();
      return (
        <>
          {!!results?.passes.length && (
            <div data-testid="anyPassesResults">{JSON.stringify(results.passes)}</div>
          )}
          {!!results?.incomplete.length && (
            <div data-testid="anyIncompleteResults">{JSON.stringify(results.incomplete)}</div>
          )}
          {!!results?.violations.length && (
            <div data-testid="anyViolationsResults">{JSON.stringify(results.violations)}</div>
          )}
        </>
      );
    };

    const { queryByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    expect(queryByTestId('anyPassesResults')).toBeFalsy();
    expect(queryByTestId('anyIncompleteResults')).toBeFalsy();
    expect(queryByTestId('anyViolationsResults')).toBeFalsy();

    const useChannelArgs = mockedApi.useChannel.mock.calls[0][0];
    const storyFinishedPayload: StoryFinishedPayload = {
      storyId,
      status: 'error',
      reporters: [
        {
          type: 'a11y',
          result: axeResult as any,
          status: 'failed',
          version: 1,
        },
      ],
    };

    act(() => useChannelArgs[STORY_FINISHED](storyFinishedPayload));
    expect(queryByTestId('anyPassesResults')).toHaveTextContent(JSON.stringify(axeResult.passes));
    expect(queryByTestId('anyIncompleteResults')).toHaveTextContent(
      JSON.stringify(axeResult.incomplete)
    );
    expect(queryByTestId('anyViolationsResults')).toHaveTextContent(
      JSON.stringify(axeResult.violations)
    );
  });

  it('should set discrepancy to cliFailedButModeManual when in manual mode (set via globals)', () => {
    mockedApi.useGlobals.mockReturnValue([{ a11y: { manual: true } }] as any);
    mockedApi.experimental_useStatusStore.mockReturnValue('status-value:error');

    const Component = () => {
      const { discrepancy } = useA11yContext();
      return <div data-testid="discrepancy">{discrepancy}</div>;
    };

    const { getByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    expect(getByTestId('discrepancy').textContent).toBe('cliFailedButModeManual');
  });

  it('should set discrepancy to cliPassedBrowserFailed', () => {
    mockedApi.useParameter.mockReturnValue({ manual: true });
    mockedApi.experimental_useStatusStore.mockReturnValue('status-value:success');

    const Component = () => {
      const { discrepancy } = useA11yContext();
      return <div data-testid="discrepancy">{discrepancy}</div>;
    };

    const { getByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    const storyFinishedPayload: StoryFinishedPayload = {
      storyId,
      status: 'error',
      reporters: [
        {
          type: 'a11y',
          result: axeResult as any,
          status: 'failed',
          version: 1,
        },
      ],
    };

    const useChannelArgs = mockedApi.useChannel.mock.calls[0][0];

    act(() => useChannelArgs[STORY_FINISHED](storyFinishedPayload));

    expect(getByTestId('discrepancy').textContent).toBe('cliPassedBrowserFailed');
  });

  it('should handle STORY_RENDER_PHASE_CHANGED event correctly', () => {
    const emit = vi.fn();
    mockedApi.useChannel.mockReturnValue(emit);

    const Component = () => {
      const { status } = useA11yContext();
      return <div data-testid="status">{status}</div>;
    };

    const { queryByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    expect(queryByTestId('status')).toHaveTextContent('initial');

    const useChannelArgs = mockedApi.useChannel.mock.calls[0][0];

    act(() => useChannelArgs[STORY_RENDER_PHASE_CHANGED]({ newPhase: 'loading' }));
    expect(queryByTestId('status')).toHaveTextContent('initial');

    act(() => useChannelArgs[STORY_RENDER_PHASE_CHANGED]({ newPhase: 'afterEach' }));
    expect(queryByTestId('status')).toHaveTextContent('running');
  });

  it('should handle STORY_RENDER_PHASE_CHANGED event correctly when in manual mode (set via globals)', () => {
    mockedApi.useGlobals.mockReturnValue([{ a11y: { manual: true } }] as any);

    const emit = vi.fn();
    mockedApi.useChannel.mockReturnValue(emit);

    const Component = () => {
      const { status } = useA11yContext();
      return <div data-testid="status">{status}</div>;
    };

    const { queryByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    expect(queryByTestId('status')).toHaveTextContent('manual');

    const useChannelArgs = mockedApi.useChannel.mock.calls[0][0];

    act(() => useChannelArgs[STORY_RENDER_PHASE_CHANGED]({ newPhase: 'loading' }));
    expect(queryByTestId('status')).toHaveTextContent('manual');

    act(() => useChannelArgs[STORY_RENDER_PHASE_CHANGED]({ newPhase: 'afterEach' }));
    expect(queryByTestId('status')).toHaveTextContent('manual');
  });

  it('should handle STORY_FINISHED event with error correctly', () => {
    const emit = vi.fn();
    mockedApi.useChannel.mockReturnValue(emit);

    const Component = () => {
      const { error } = useA11yContext();
      return <div data-testid="error">{error ? (error as any).message : 'No Error'}</div>;
    };

    const { getByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    expect(getByTestId('error').textContent).toBe('No Error');

    const useChannelArgs = mockedApi.useChannel.mock.calls[0][0];
    const storyFinishedPayload: StoryFinishedPayload = {
      storyId,
      status: 'error',
      reporters: [
        {
          status: 'failed',
          version: 1,
          type: 'a11y',
          result: { error: new Error('Test error') } as any,
        },
      ],
    };

    act(() => useChannelArgs[STORY_FINISHED](storyFinishedPayload));
    expect(getByTestId('error').textContent).toBe('Test error');
  });

  it('should handle manual run correctly', () => {
    const emit = vi.fn();
    mockedApi.useChannel.mockReturnValue(emit);

    const Component = () => {
      const { handleManual } = useA11yContext();
      return (
        <button onClick={handleManual} data-testid="manualRunButton">
          Run Manual
        </button>
      );
    };

    const { getByTestId } = render(
      <A11yContextProvider>
        <Component />
      </A11yContextProvider>
    );

    act(() => {
      getByTestId('manualRunButton').click();
    });

    expect(emit).toHaveBeenCalledWith(EVENTS.MANUAL, storyId, expect.any(Object));
  });
});
