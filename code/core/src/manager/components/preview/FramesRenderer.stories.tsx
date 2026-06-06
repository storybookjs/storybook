import { ManagerContext } from 'storybook/manager-api';
import { expect, fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { FramesRenderer } from './FramesRenderer.tsx';

const refId = 'composed-ref';
const refUrl = 'https://composed-ref.example';

// getStoryHrefs returns the composed ref's iframe URL whenever a refId is passed, so we can
// assert the local preview frame is requested without one (mirrors manager-api/url.ts).
const getStoryHrefs = fn((storyId: string, opts?: { refId?: string }) => ({
  managerHref: '',
  previewHref: opts?.refId
    ? `${refUrl}/iframe.html?id=${storyId}&refId=${opts.refId}`
    : `iframe.html?id=${storyId}`,
})).mockName('api::getStoryHrefs');

const api: any = {
  getStoryHrefs,
  getIsFullscreen: fn(() => false),
  getIsNavShown: fn(() => true),
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
  state: { storyId: 'button--primary' },
  api,
};

const meta = preview.meta({
  component: FramesRenderer,
  args: {
    api,
    refId,
    storyId: 'button--primary',
    viewMode: 'story',
    scale: 1,
    baseUrl: 'iframe.html',
    queryParams: {},
    entry: { type: 'story', id: 'button--primary' } as any,
    refs: {
      [refId]: { id: refId, url: refUrl, type: 'lazy', title: 'Composed ref' },
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
    await expect(src).toContain('iframe.html?id=button--primary');
  },
});
