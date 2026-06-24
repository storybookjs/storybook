import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { global } from '@storybook/global';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, within } from 'storybook/test';

import { buildQueryState } from '../../shared/open-service/query-state.ts';
import type { QueryState } from '../../shared/open-service/types.ts';
import { ControlsPanel } from './ControlsPanel.tsx';

const refId = 'my-ref';
const storyData = {
  type: 'story',
  id: `${refId}_example-button--primary`,
  refId,
  args: { label: 'Submit' },
  initialArgs: { label: 'Submit' },
  argTypes: { label: { name: 'label', control: { type: 'text' } } },
};
const serviceStoryData = {
  type: 'story',
  prepared: true,
  id: 'example-button--primary',
  args: { variant: 'primary' },
  initialArgs: { variant: 'primary' },
  // Custom argTypes reach the panel via the STORY_PREPARED channel (read through `useArgTypes`),
  // and are merged with the service's extracted component docgen.
  argTypes: { variant: { name: 'variant', control: { type: 'radio' } } },
  parameters: { __isArgsStory: true },
};

// Reproduces the #34553 condition: the story comes from a composed ref, so the host's
// global `previewInitialized` stays false while the ref's own flag is true.
const managerContext: any = {
  state: {
    path: storyData.id,
    previewInitialized: false,
    refs: { [refId]: { id: refId, previewInitialized: true } },
  },
  api: {
    getCurrentStoryData: fn(() => storyData).mockName('api::getCurrentStoryData'),
    getCurrentParameter: fn(() => ({})).mockName('api::getCurrentParameter'),
    getGlobals: fn(() => ({})).mockName('api::getGlobals'),
    getStoryGlobals: fn(() => ({})).mockName('api::getStoryGlobals'),
    getUserGlobals: fn(() => ({})).mockName('api::getUserGlobals'),
    updateGlobals: fn().mockName('api::updateGlobals'),
    updateStoryArgs: fn().mockName('api::updateStoryArgs'),
    resetStoryArgs: fn().mockName('api::resetStoryArgs'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    emit: fn().mockName('api::emit'),
  },
};

const serviceManagerContext: any = {
  ...managerContext,
  state: {
    ...managerContext.state,
    path: serviceStoryData.id,
    previewInitialized: true,
  },
  api: {
    ...managerContext.api,
    getCurrentStoryData: fn(() => serviceStoryData).mockName('api::getCurrentStoryData'),
  },
};

const serviceGetDocgen = Object.assign(
  fn((_input?: { id: string }) => ({
    id: 'example-button',
    name: 'Button',
    path: './Button.stories.tsx',
    jsDocTags: {},
    stories: [],
    argTypes: {
      variant: {
        name: 'variant',
        description: 'Visual style',
        type: { name: 'enum', value: ['primary', 'secondary'] },
      },
    },
  })).mockName('docgenService::docgen'),
  {
    get: fn((input?: { id: string }) => serviceGetDocgen(input)).mockName(
      'docgenService::docgen.get'
    ),
    subscribe: fn((_input: { id: string }, callback: (state: QueryState<unknown>) => void) => {
      callback(
        buildQueryState(serviceGetDocgen(_input), {
          status: 'success',
          error: undefined,
          loadStatus: 'idle',
        })
      );
      return fn();
    }).mockName('docgenService::docgen.subscribe'),
    loaded: fn((input: { id: string }) => Promise.resolve(serviceGetDocgen(input))).mockName(
      'docgenService::docgen.loaded'
    ),
  }
);

const docgenService: any = { queries: { docgen: serviceGetDocgen } };

const meta = {
  component: ControlsPanel,
  args: { saveStory: fn(), createStory: fn() },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof ControlsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Regression test for #34553: controls for a story from a composed ref must render even
 * though the host's global `previewInitialized` flag never flips. Before the fix the panel
 * read only that global flag, so it stayed in its loading state and showed skeletons forever.
 */
export const RefStoryControlsLoad: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('label')).toBeInTheDocument();
  },
};

export const ServiceDocgenControlsLoad: Story = {
  args: { docgenService },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceManagerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('radio', { name: 'primary' })).toBeInTheDocument();
    await expect(serviceGetDocgen).toHaveBeenCalledWith({ id: 'example-button' });
  },
};

// A panel with more controls than fit, plus one edited arg so the "save from controls" bar
// renders. The bar is absolutely positioned at the bottom of the panel, so the scrollable
// content must reserve room for it — otherwise the last control sits under the bar (#34531).
const PROP_COUNT = 12;
const overlapArgTypes = Object.fromEntries(
  Array.from({ length: PROP_COUNT }, (_, i) => [
    `prop${i + 1}`,
    { name: `prop${i + 1}`, control: { type: 'text' } },
  ])
);
const overlapStoryData = {
  type: 'story',
  id: `${refId}_example-button--primary`,
  refId,
  argTypes: overlapArgTypes,
  initialArgs: Object.fromEntries(
    Array.from({ length: PROP_COUNT }, (_, i) => [`prop${i + 1}`, ''])
  ),
  // The first arg differs from its initial value, so the panel is in the "unsaved changes" state.
  args: Object.fromEntries(
    Array.from({ length: PROP_COUNT }, (_, i) => [`prop${i + 1}`, i === 0 ? 'edited' : ''])
  ),
};
const overlapContext: any = {
  state: {
    path: overlapStoryData.id,
    previewInitialized: false,
    refs: { [refId]: { id: refId, previewInitialized: true } },
  },
  api: { ...managerContext.api, getCurrentStoryData: fn(() => overlapStoryData) },
};

/**
 * Regression test for #34531: when the controls overflow the panel, the "save from controls"
 * bar must not cover the last control. The save bar only renders in development, with unsaved
 * arg changes — reproduced here inside a short, scrollable host that mimics the addon panel.
 */
export const SaveBarDoesNotCoverLastControl: Story = {
  // The save bar only renders in development builds; set it for this story and restore after,
  // so the mutation can't leak into other stories.
  beforeEach: () => {
    const original = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'DEVELOPMENT';
    return () => {
      global.CONFIG_TYPE = original;
    };
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={overlapContext}>
        {/* relative parent = the bar's positioning context; inner div = the scroll container */}
        <div style={{ position: 'relative', height: 200 }}>
          <div data-testid="panel-scroll" style={{ height: '100%', overflowY: 'auto' }}>
            {storyFn()}
          </div>
        </div>
      </ManagerContext.Provider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(`prop${PROP_COUNT}`);

    const scroller = canvasElement.querySelector<HTMLElement>('[data-testid="panel-scroll"]');
    const saveBar = canvasElement.querySelector<HTMLElement>('#save-from-controls');
    await expect(scroller).not.toBeNull();
    await expect(saveBar).not.toBeNull();

    // Scroll to the very bottom, where the last control would sit under the bar without the fix.
    scroller!.scrollTop = scroller!.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const rows = canvasElement.querySelectorAll('.docblock-argstable tbody tr');
    const lastRow = rows[rows.length - 1];
    const lastRowRect = lastRow.getBoundingClientRect();
    const barRect = saveBar!.getBoundingClientRect();

    // The last control's bottom must clear the top of the save bar.
    await expect(lastRowRect.bottom).toBeLessThanOrEqual(barRect.top + 1);
  },
};
