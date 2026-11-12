import React, { type FC, type PropsWithChildren, useMemo, useRef, useState } from 'react';

import { Channel } from 'storybook/internal/channels';

import { type ClickEventDetails, HIGHLIGHT_MENU_CLICK } from 'storybook/highlight';
import { ManagerContext } from 'storybook/manager-api';
import { expect, spyOn, waitFor } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { EVENTS } from '../constants.ts';
import { results } from '../results.mock.ts';
import { type EnhancedResults, RuleType } from '../types.ts';
import { A11yContextProvider, SELECTED_HIGHLIGHT_ID, useA11yContext } from './A11yContext.tsx';

const storyId = 'button--primary';
const channel = new Channel({});

// The slice of the manager API the provider reads, backed by a real channel so a play function
// can send it the events the preview would.
const ManagerHarness: FC<PropsWithChildren> = ({ children }) => {
  const addonState = useRef<Record<string, unknown>>({});
  const [, rerender] = useState(0);
  const api = useMemo(
    () => ({
      on: channel.on.bind(channel),
      off: channel.off.bind(channel),
      emit: channel.emit.bind(channel),
      getAddonState: (id: string) => addonState.current[id],
      setAddonState: async (id: string, next: unknown) => {
        // On a re-render useSharedState records the default state only in this global, so a
        // merger must see it there when nothing has been set yet.
        const previous = addonState.current[id] ?? globalThis.STORYBOOK_ADDON_STATE?.[id];
        addonState.current[id] = typeof next === 'function' ? next(previous) : next;
        rerender((count) => count + 1);
      },
      getCurrentParameter: () => undefined,
      getCurrentStoryData: () => ({ id: storyId, type: 'story' }),
      getGlobals: () => ({}),
      getStoryGlobals: () => ({}),
      getUserGlobals: () => ({}),
      updateGlobals: () => {},
      getQueryParam: () => undefined,
      setQueryParams: () => {},
    }),
    []
  );
  return (
    <ManagerContext.Provider
      value={{ api, state: { storyId } } as unknown as React.ContextType<typeof ManagerContext>}
    >
      {children}
    </ManagerContext.Provider>
  );
};

const Probe = () => {
  const { results: current, selectedItems } = useA11yContext();
  return (
    <pre data-testid="probe">
      {JSON.stringify({
        violations: current?.violations.length ?? 0,
        selected: Object.fromEntries(selectedItems),
      })}
    </pre>
  );
};

const readProbe = (canvas: { getByTestId: (id: string) => HTMLElement }) =>
  JSON.parse(canvas.getByTestId('probe').textContent ?? '{}') as {
    violations: number;
    selected: Record<string, string>;
  };

const violation = results.violations[0];
const violationKey = `${RuleType.VIOLATION}.${violation.id}`;
const clickOnFirstNode: ClickEventDetails = {
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  selectors: [String(violation.nodes[0].target)],
  element: { localName: 'button', tagName: 'BUTTON' },
};

const withHelpUrl = (helpUrl: string): EnhancedResults =>
  ({
    ...results,
    violations: [{ ...violation, helpUrl }],
  }) as unknown as EnhancedResults;

const meta = preview.meta({
  title: 'A11yContext',
  component: A11yContextProvider,
  render: () => (
    <ManagerHarness>
      <A11yContextProvider>
        <Probe />
      </A11yContextProvider>
    </ManagerHarness>
  ),
});

/**
 * Clicking a highlight menu item opens the rule's help page when the link is a web URL, and
 * selects the matching node instead when it is not. The help URL comes from the preview, so
 * anything that is not http(s) must never reach `window.open`.
 */
export const HelpLinkOpensInNewTab = meta.story({
  play: async ({ canvas }) => {
    const open = spyOn(window, 'open').mockImplementation(() => ({}) as Window);
    try {
      channel.emit(EVENTS.RESULT, withHelpUrl(violation.helpUrl), storyId);
      await waitFor(() => expect(readProbe(canvas).violations).toBe(1));

      channel.emit(HIGHLIGHT_MENU_CLICK, SELECTED_HIGHLIGHT_ID, violationKey, clickOnFirstNode);

      await waitFor(() =>
        expect(open).toHaveBeenCalledWith(violation.helpUrl, '_blank', 'noopener,noreferrer')
      );
      expect(readProbe(canvas).selected).toEqual({});
    } finally {
      open.mockRestore();
    }
  },
});

export const JavascriptHelpLinkSelectsNodeInstead = meta.story({
  play: async ({ canvas }) => {
    const open = spyOn(window, 'open').mockImplementation(() => ({}) as Window);
    try {
      channel.emit(EVENTS.RESULT, withHelpUrl('javascript:alert(1)'), storyId);
      await waitFor(() => expect(readProbe(canvas).violations).toBe(1));

      channel.emit(HIGHLIGHT_MENU_CLICK, SELECTED_HIGHLIGHT_ID, violationKey, clickOnFirstNode);

      await waitFor(() =>
        expect(readProbe(canvas).selected).toEqual({ [violationKey]: `${violationKey}.1` })
      );
      expect(open).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  },
});

export const DataHelpLinkSelectsNodeInstead = meta.story({
  play: async ({ canvas }) => {
    const open = spyOn(window, 'open').mockImplementation(() => ({}) as Window);
    try {
      channel.emit(EVENTS.RESULT, withHelpUrl('data:text/html,<script>alert(1)</script>'), storyId);
      await waitFor(() => expect(readProbe(canvas).violations).toBe(1));

      channel.emit(HIGHLIGHT_MENU_CLICK, SELECTED_HIGHLIGHT_ID, violationKey, clickOnFirstNode);

      await waitFor(() =>
        expect(readProbe(canvas).selected).toEqual({ [violationKey]: `${violationKey}.1` })
      );
      expect(open).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  },
});
