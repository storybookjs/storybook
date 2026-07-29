import React from 'react';

import { STORY_FINISHED, STORY_PREPARED } from 'storybook/internal/core-events';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { global } from '@storybook/global';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, waitFor, within } from 'storybook/test';

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

// Same story, but not yet prepared. Used by the build-mode story to prove docgen is fetched
// immediately, without waiting for prepare or render.
const serviceUnpreparedStoryData = {
  ...serviceStoryData,
  prepared: false,
};

const serviceUnpreparedManagerContext: any = {
  ...serviceManagerContext,
  api: {
    ...serviceManagerContext.api,
    getCurrentStoryData: fn(() => serviceUnpreparedStoryData).mockName('api::getCurrentStoryData'),
  },
};

// A real (tiny) channel backing `api.on`/`off`/`emit`, so a story's `play` can emit story lifecycle
// events (STORY_FINISHED / STORY_PREPARED) and drive the dev-only docgen gate in `ControlsPanel`.
function createApiChannel() {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    on: fn((type: string, cb: (...args: any[]) => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(cb);
      listeners.set(type, set);
    }).mockName('api::on'),
    off: fn((type: string, cb: (...args: any[]) => void) => {
      listeners.get(type)?.delete(cb);
    }).mockName('api::off'),
    emit: fn((type: string, ...args: any[]) => {
      listeners.get(type)?.forEach((cb) => cb(...args));
    }).mockName('api::emit'),
  };
}

const serviceRenderChannel = createApiChannel();
const serviceRenderManagerContext: any = {
  ...serviceManagerContext,
  api: {
    ...serviceManagerContext.api,
    ...serviceRenderChannel,
  },
};

// A prepared story whose annotation argTypes carry no controls — its controls come entirely from
// docgen. Used to prove the gate shows the loading skeleton (not the "No controls" empty state) while
// docgen is still pending.
const serviceNoControlsStoryData = {
  ...serviceStoryData,
  argTypes: {},
};

const serviceNoControlsManagerContext: any = {
  ...serviceManagerContext,
  api: {
    ...serviceManagerContext.api,
    getCurrentStoryData: fn(() => serviceNoControlsStoryData).mockName('api::getCurrentStoryData'),
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
  // Build mode (no dev render gate), so docgen loads and merges into the table immediately.
  beforeEach: () => {
    const original = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'PRODUCTION';
    return () => {
      global.CONFIG_TYPE = original;
    };
  },
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

/**
 * In dev, the panel must not query docgen until the story has finished (STORY_FINISHED) — even when
 * the story is already prepared. Querying earlier would make the docgen worker's CPU-bound extraction
 * compete with the dev server's bundling and the preview's render during the slowest part of first
 * render. Until then the panel shows the story's own annotation argTypes (here, the `variant` radio),
 * or a loading skeleton when the story has none — never the "No controls" empty state.
 */
export const ServiceDocgenWaitsForStoryFinishedInDev: Story = {
  args: { docgenService },
  beforeEach: () => {
    serviceGetDocgen.mockClear();
    serviceGetDocgen.get.mockClear();
    serviceGetDocgen.subscribe.mockClear();
    const original = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'DEVELOPMENT';
    return () => {
      global.CONFIG_TYPE = original;
    };
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceManagerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    // No STORY_FINISHED is emitted, so the gate stays closed and the panel shows the story's own
    // annotation controls. Wait for that row to render (a stable signal that the gate hook mounted),
    // then assert synchronously that docgen was never queried — a `waitFor` on the negative passes
    // before mount settles and would miss a next-tick subscription regression.
    await expect(await canvas.findByText('variant')).toBeInTheDocument();
    expect(serviceGetDocgen.subscribe).not.toHaveBeenCalled();
  },
};

/**
 * Regression test: while the dev gate is closed and the story has no annotation controls (its
 * controls come entirely from docgen), the panel must show the loading skeleton — not the "No
 * controls" empty state. Previously it flashed that empty state for the whole gate window before
 * docgen resolved and filled the table.
 */
export const ServiceDocgenSkeletonWhileGatedWithoutControls: Story = {
  args: { docgenService },
  beforeEach: () => {
    serviceGetDocgen.mockClear();
    serviceGetDocgen.get.mockClear();
    serviceGetDocgen.subscribe.mockClear();
    const original = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'DEVELOPMENT';
    return () => {
      global.CONFIG_TYPE = original;
    };
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceNoControlsManagerContext}>
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    // The empty state debounces for 100ms before rendering, so wait past it, then assert it never
    // appears while the gate is closed and docgen hasn't been queried.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(canvas.queryByText('This story has no controls')).not.toBeInTheDocument();
    await expect(serviceGetDocgen.subscribe).not.toHaveBeenCalled();
  },
};

/**
 * Once the story finishes in dev (STORY_FINISHED), the gate opens and the panel subscribes to docgen,
 * merging the extracted argTypes into the table.
 */
export const ServiceDocgenLoadsAfterStoryFinishedInDev: Story = {
  args: { docgenService },
  beforeEach: () => {
    serviceGetDocgen.mockClear();
    serviceGetDocgen.get.mockClear();
    serviceGetDocgen.subscribe.mockClear();
    const original = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'DEVELOPMENT';
    return () => {
      global.CONFIG_TYPE = original;
    };
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceRenderManagerContext}>
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    // Before the story finishes: the gate is closed, so only annotation controls render. Anchor on
    // that row, then assert synchronously that docgen wasn't queried (deferred, no subscription).
    await expect(await canvas.findByText('variant')).toBeInTheDocument();
    expect(serviceGetDocgen.subscribe).not.toHaveBeenCalled();
    // Simulate the preview reporting the story as finished.
    serviceRenderChannel.emit(STORY_FINISHED, { storyId: serviceStoryData.id });
    await expect(await canvas.findByRole('radio', { name: 'primary' })).toBeInTheDocument();
    await expect(serviceGetDocgen).toHaveBeenCalledWith({ id: 'example-button' });
  },
};

/**
 * With STORYBOOK_DOCGEN_STORY_PREPARED="true" the dev gate opens earlier, at STORY_PREPARED instead of
 * STORY_FINISHED, so the panel subscribes to docgen as soon as the story module is delivered.
 */
export const ServiceDocgenLoadsAfterStoryPreparedInDev: Story = {
  args: { docgenService },
  beforeEach: () => {
    serviceGetDocgen.mockClear();
    serviceGetDocgen.get.mockClear();
    serviceGetDocgen.subscribe.mockClear();
    const originalConfig = global.CONFIG_TYPE;
    const originalFlag = global.DOCGEN_STORY_PREPARED;
    global.CONFIG_TYPE = 'DEVELOPMENT';
    global.DOCGEN_STORY_PREPARED = true;
    return () => {
      global.CONFIG_TYPE = originalConfig;
      global.DOCGEN_STORY_PREPARED = originalFlag;
    };
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceRenderManagerContext}>
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    // Before any lifecycle event: the gate is closed, only annotation controls render. Anchor on that
    // row, then assert synchronously that docgen wasn't queried (deferred, no subscription).
    await expect(await canvas.findByText('variant')).toBeInTheDocument();
    expect(serviceGetDocgen.subscribe).not.toHaveBeenCalled();
    // STORY_FINISHED must not open the gate while waiting for STORY_PREPARED. Give a potential
    // erroneous subscription time to land, then assert it never happened.
    serviceRenderChannel.emit(STORY_FINISHED, { storyId: serviceStoryData.id });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(serviceGetDocgen.subscribe).not.toHaveBeenCalled();
    // STORY_PREPARED opens it.
    serviceRenderChannel.emit(STORY_PREPARED, { id: serviceStoryData.id });
    await expect(await canvas.findByRole('radio', { name: 'primary' })).toBeInTheDocument();
    await expect(serviceGetDocgen).toHaveBeenCalledWith({ id: 'example-button' });
  },
};

/**
 * In a static build docgen is precomputed JSON with no bundling to contend with, so the panel
 * subscribes to docgen immediately without waiting for the story to prepare or render.
 */
export const ServiceDocgenLoadsImmediatelyInBuild: Story = {
  args: { docgenService },
  beforeEach: () => {
    serviceGetDocgen.mockClear();
    serviceGetDocgen.get.mockClear();
    serviceGetDocgen.subscribe.mockClear();
    const original = global.CONFIG_TYPE;
    global.CONFIG_TYPE = 'PRODUCTION';
    return () => {
      global.CONFIG_TYPE = original;
    };
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceUnpreparedManagerContext}>
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
  play: async () => {
    await waitFor(() => expect(serviceGetDocgen).toHaveBeenCalledWith({ id: 'example-button' }));
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
