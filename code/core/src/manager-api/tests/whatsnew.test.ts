import { Channel } from 'storybook/internal/channels';
import type { WhatsNewData, WhatsNewRequest } from 'storybook/internal/core-events';
import { REQUEST_WHATS_NEW_DATA, RESULT_WHATS_NEW_DATA } from 'storybook/internal/core-events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type SubAPI, type SubState, init as initWhatsNew } from '../modules/whatsnew.tsx';

const post = {
  status: 'SUCCESS',
  title: 'Storybook 11',
  url: 'https://storybook.js.org/whats-new/storybook-11',
  publishedAt: '2026-10-01',
  excerpt: 'Hello',
  postIsRead: false,
  showNotification: true,
  disableWhatsNewNotifications: true,
} satisfies WhatsNewData;

// Answers like the dev server: asynchronously, and broadcast to every listener.
const respond = (channel: Channel, data: WhatsNewData) =>
  setTimeout(() => channel.emit(RESULT_WHATS_NEW_DATA, { data }));

const setup = ({ forcedResult = post }: { forcedResult?: WhatsNewData } = {}) => {
  const channel = new Channel({});
  const requests: WhatsNewRequest[] = [];
  channel.on(REQUEST_WHATS_NEW_DATA, (payload: WhatsNewRequest) => {
    requests.push(payload);
    respond(channel, payload.force ? forcedResult : { status: 'DISABLED' });
  });
  const fullAPI = {
    getUrlState: vi.fn(() => ({ path: '/story/a--b', queryParams: {} })),
    addNotification: vi.fn(),
    clearNotification: vi.fn(),
  };
  const store = { setState: vi.fn() };
  const { init, api, state } = initWhatsNew({ fullAPI, store, provider: { channel } } as any);
  return {
    channel,
    requests,
    fullAPI,
    api: api as SubAPI,
    state: state as SubState,
    init: init as () => Promise<void>,
  };
};

beforeEach(() => {
  vi.stubGlobal('CONFIG_TYPE', 'DEVELOPMENT');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('whatsnew API', () => {
  it('does not notify when notifications are disabled, and loads the post on demand', async () => {
    const { requests, fullAPI, api, state, init } = setup();

    await init();
    expect(requests).toEqual([{ force: false }]);
    expect(state.whatsNewData).toEqual({ status: 'DISABLED' });
    expect(fullAPI.addNotification).not.toHaveBeenCalled();

    expect(await api.loadWhatsNewPost()).toBe(true);
    expect(requests).toEqual([{ force: false }, { force: true }]);
    expect(state.whatsNewData).toEqual(post);
  });

  it('stays DISABLED when loading on demand fails, so the page can retry', async () => {
    const { requests, api, state, init } = setup({ forcedResult: { status: 'ERROR' } });
    await init();

    expect(await api.loadWhatsNewPost()).toBe(false);
    expect(state.whatsNewData).toEqual({ status: 'DISABLED' });

    expect(await api.loadWhatsNewPost()).toBe(false);
    expect(requests.filter((r) => r.force)).toHaveLength(2);
  });

  it('sends a single forced request for concurrent loads', async () => {
    const { requests, api, init } = setup();
    await init();

    await Promise.all([api.loadWhatsNewPost(), api.loadWhatsNewPost()]);
    expect(requests.filter((r) => r.force)).toHaveLength(1);
  });

  it('ignores DISABLED results broadcast for another manager while loading on demand', async () => {
    const { channel, api, state, init } = setup();
    await init();

    const load = api.loadWhatsNewPost();
    channel.emit(RESULT_WHATS_NEW_DATA, { data: { status: 'DISABLED' } });
    await load;
    expect(state.whatsNewData).toEqual(post);
  });

  it('does not request anything outside development', async () => {
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');
    const { requests, init } = setup();

    await init();
    expect(requests).toEqual([]);
  });
});
