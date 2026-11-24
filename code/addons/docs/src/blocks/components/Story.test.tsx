// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { UPDATE_QUERY_PARAMS } from 'storybook/internal/core-events';
import type { DocsContextProps } from 'storybook/internal/types';
import { mockChannel } from 'storybook/preview-api';

import { getStoryProps } from '../blocks/Story';
import { Story } from './Story';
import type { StoryProps } from './Story';

const story = {
  id: 'button--primary',
  name: 'Primary',
  usesMount: false,
  parameters: {},
} as unknown as StoryProps['story'];

const DOCS_URL = 'iframe.html?id=button--primary&viewMode=docs';

const setUrl = (url: string) => {
  window.history.replaceState({}, '', url);
};

const getIframeSrc = (container: HTMLElement) =>
  container.querySelector('iframe')?.getAttribute('src') ?? '';

describe('Story', () => {
  afterEach(() => {
    cleanup();
    setUrl('/');
  });

  it('renders the iframe without globals when the docs url has none', () => {
    setUrl(DOCS_URL);
    const { container } = render(
      <Story story={story} inline={false} height="100px" primary={false} channel={mockChannel()} />
    );

    expect(getIframeSrc(container)).toContain(`id=${story.id}`);
    expect(getIframeSrc(container)).not.toContain('globals=');
  });

  it('forwards the globals of the docs url to the story iframe', () => {
    setUrl(`${DOCS_URL}&globals=theme:dark`);
    const { container } = render(
      <Story story={story} inline={false} height="100px" primary={false} channel={mockChannel()} />
    );

    expect(getIframeSrc(container)).toContain('globals=theme%3Adark');
  });

  it('keeps the story iframe in sync with the globals query param', () => {
    setUrl(DOCS_URL);
    const channel = mockChannel();
    const { container } = render(
      <Story story={story} inline={false} height="100px" primary={false} channel={channel} />
    );

    expect(getIframeSrc(container)).not.toContain('globals=');

    act(() => {
      channel.emit(UPDATE_QUERY_PARAMS, { globals: 'theme:dark' });
    });
    expect(getIframeSrc(container)).toContain('globals=theme%3Adark');

    // The manager signals a cleared selection with an explicit `null`, not by omitting the key, so
    // that the preview drops the param instead of merging the previous value back in.
    act(() => {
      channel.emit(UPDATE_QUERY_PARAMS, { globals: null });
    });
    expect(getIframeSrc(container)).not.toContain('globals=');
  });

  it('does not resurrect a global that the manager cleared when the story iframe remounts', () => {
    const channel = mockChannel();
    setUrl(`${DOCS_URL}&globals=theme:dark`);

    const view = render(
      <Story story={story} inline={false} height="100px" primary={false} channel={channel} />
    );
    expect(getIframeSrc(view.container)).toContain('globals=theme%3Adark');

    act(() => {
      channel.emit(UPDATE_QUERY_PARAMS, { globals: null });
    });
    expect(getIframeSrc(view.container)).not.toContain('globals=');

    // Clearing also removes the param from the url (the UrlStore and manager-api tests cover both
    // halves), so remounting cannot read the cleared value back out of the url.
    setUrl(DOCS_URL);
    view.unmount();

    const remounted = render(
      <Story story={story} inline={false} height="100px" primary={false} channel={mockChannel()} />
    );
    expect(getIframeSrc(remounted.container)).not.toContain('globals=');
  });
});

describe('getStoryProps', () => {
  it('passes the channel to iframe stories', () => {
    const channel = mockChannel();
    const context = { channel } as unknown as DocsContextProps;

    const props = getStoryProps({} as unknown as StoryProps, story, context);

    // `channel` is only passed along for non-inline stories.
    expect((props as { channel?: DocsContextProps['channel'] }).channel).toBe(channel);
  });
});
