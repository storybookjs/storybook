import { Channel } from 'storybook/internal/channels';
import { loadMainConfig } from 'storybook/internal/common';
import type { WhatsNewCache, WhatsNewData } from 'storybook/internal/core-events';
import { REQUEST_WHATS_NEW_DATA, RESULT_WHATS_NEW_DATA } from 'storybook/internal/core-events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type OptionsWithRequiredCache, initializeWhatsNew } from './whats-new.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const post = {
  title: 'Storybook 11',
  url: 'https://storybook.js.org/whats-new/storybook-11',
  publishedAt: '2026-10-01',
  excerpt: 'Hello',
};

const fetchMock = vi.fn();

const setup = ({
  disableWhatsNewNotifications,
  cache = {},
}: {
  disableWhatsNewNotifications?: boolean;
  cache?: WhatsNewCache;
}) => {
  vi.mocked(loadMainConfig).mockResolvedValue({
    stories: [],
    core: { disableWhatsNewNotifications },
  });
  const channel = new Channel({});
  initializeWhatsNew(channel, {
    configDir: '/config',
    cache: { get: vi.fn().mockResolvedValue(cache), set: vi.fn() },
  } as unknown as OptionsWithRequiredCache);

  const request = (payload?: { force?: boolean }) =>
    new Promise<WhatsNewData>((resolve) => {
      channel.once(RESULT_WHATS_NEW_DATA, ({ data }: { data: WhatsNewData }) => resolve(data));
      channel.emit(REQUEST_WHATS_NEW_DATA, payload);
    });

  return { request };
};

beforeEach(() => {
  vi.resetAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => post });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('REQUEST_WHATS_NEW_DATA', () => {
  it('does not fetch when notifications are disabled', async () => {
    const { request } = setup({ disableWhatsNewNotifications: true });

    expect(await request()).toEqual({ status: 'DISABLED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches when notifications are disabled but the request is forced', async () => {
    const { request } = setup({ disableWhatsNewNotifications: true });

    expect(await request({ force: true })).toEqual({
      ...post,
      status: 'SUCCESS',
      postIsRead: false,
      showNotification: true,
      disableWhatsNewNotifications: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fetches when notifications are enabled', async () => {
    const { request } = setup({ cache: { lastReadPost: post.url } });

    expect(await request()).toEqual({
      ...post,
      status: 'SUCCESS',
      postIsRead: true,
      showNotification: false,
      disableWhatsNewNotifications: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports an error when the fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { request } = setup({});

    expect(await request()).toEqual({ status: 'ERROR' });
  });
});
