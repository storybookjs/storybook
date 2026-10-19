import { ManagerContext } from 'storybook/manager-api';
import { expect, fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { FramesRenderer } from './FramesRenderer.tsx';

// Use the `Icons` composed ref that this Storybook already references, so the active ref frame
// renders a real story instead of a non-existent URL.
const refId = 'icons';
const refUrl = 'https://main--64b56e737c0aeefed9d5e675.chromatic.com';
const storyId = 'icons-accessibilityicon--default';

// getStoryHrefs returns the composed ref's iframe URL whenever a refId is passed, so we can
// assert the local preview frame is requested without one (mirrors manager-api/url.ts).
const getStoryHrefs = fn((id: string, opts?: { refId?: string }) => ({
  managerHref: '',
  previewHref: opts?.refId
    ? `${refUrl}/iframe.html?id=${id}&refId=${opts.refId}`
    : `iframe.html?id=${id}`,
})).mockName('api::getStoryHrefs');

const api: any = {
  getStoryHrefs,
  getIsFullscreen: fn(() => false),
  getIsNavShown: fn(() => true),
  getNavAvailability: fn(() => 'shown'),
  getCurrentParameter: fn(() => undefined),
  getGlobals: fn(() => ({})),
  getStoryGlobals: fn(() => ({})),
  getUserGlobals: fn(() => ({})),
  getUrlState: fn(() => ({ viewMode: 'story' })),
  updateGlobals: fn(),
  setAddonShortcut: fn(),
  on: fn(),
  off: fn(),
  emit: fn(),
};

const managerContext: any = {
  state: { storyId },
  api,
};

const meta = preview.meta({
  component: FramesRenderer,
  args: {
    api,
    refId,
    storyId,
    viewMode: 'story',
    scale: 1,
    baseUrl: 'iframe.html',
    queryParams: {},
    entry: { type: 'story', id: storyId } as any,
    refs: {
      [refId]: { id: refId, url: refUrl, type: 'lazy', title: 'Icons' },
    } as any,
  },
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <Story />
      </ManagerContext.Provider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
});

/**
 * Regression test for #34553: when a composed-ref story is the initial selection, the local
 * preview frame must still point at the host's own iframe URL. Otherwise the local frame
 * stays stuck on the ref's Storybook (it is only set once) and host stories never render.
 */
export const RefStoryKeepsLocalPreviewOnHost = meta.story({
  play: async ({ canvasElement }) => {
    const localFrame = canvasElement.querySelector<HTMLIFrameElement>('#storybook-preview-iframe');
    await expect(localFrame).not.toBeNull();

    const src = localFrame?.getAttribute('src') ?? '';
    await expect(src).not.toContain(refUrl);
    await expect(src).toContain(`iframe.html?id=${storyId}`);
  },
});
