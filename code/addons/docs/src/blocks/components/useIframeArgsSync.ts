import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_PREPARED, UPDATE_STORY_ARGS } from 'storybook/internal/core-events';
import type { Args, PreparedStory } from 'storybook/internal/types';

interface IFrameWindow extends Window {
  __STORYBOOK_ADDONS_CHANNEL__?: ChannelLike;
}

/** The channel of the preview running inside `iframe`, once that preview has installed it. */
const iframeChannel = (iframe: HTMLIFrameElement | null) =>
  (iframe?.contentWindow as IFrameWindow | null | undefined)?.__STORYBOOK_ADDONS_CHANNEL__;

/** The keys whose values differ, with `undefined` for the keys `next` no longer has. */
const changedArgs = (previous: Args, next: Args): Args => {
  const changed: Args = {};
  new Set([...Object.keys(previous), ...Object.keys(next)]).forEach((key) => {
    if (!Object.is(previous[key], next[key])) {
      changed[key] = next[key];
    }
  });
  return changed;
};

/**
 * Keeps the args of the story rendered in a story iframe in step with `args`, the docs page's
 * stored args of that story. The iframe runs its own preview with its own args store, so changes
 * are handed to that preview's channel. They are delivered with `receive`, which reaches the
 * iframe's listeners only; `emit` would also post them back to this window.
 *
 * The iframe's preview accepts args updates only once it has prepared the story, so after each
 * load the hook waits for `STORY_PREPARED` and starts over from the story's initial args.
 */
export const useIframeArgsSync = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
  story: PreparedStory,
  args: Args | undefined
) => {
  const [ready, setReady] = useState(false);
  const delivered = useRef<Args>(story.initialArgs);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return undefined;
    }
    let unsubscribe = () => {};
    const awaitPrepared = () => {
      unsubscribe();
      setReady(false);
      const channel = iframeChannel(iframe);
      if (!channel) {
        return;
      }
      if (channel.last(STORY_PREPARED)?.[0]?.id === story.id) {
        setReady(true);
        return;
      }
      const onPrepared = ({ id }: { id: string }) => {
        if (id === story.id) {
          unsubscribe();
          setReady(true);
        }
      };
      channel.on(STORY_PREPARED, onPrepared);
      unsubscribe = () => {
        channel.off(STORY_PREPARED, onPrepared);
        unsubscribe = () => {};
      };
    };
    const onLoad = () => {
      delivered.current = story.initialArgs;
      awaitPrepared();
    };
    iframe.addEventListener('load', onLoad);
    // The iframe may already be loaded when the effect runs again, e.g. after a hot update.
    if (iframeChannel(iframe)) {
      awaitPrepared();
    }
    return () => {
      unsubscribe();
      iframe.removeEventListener('load', onLoad);
    };
  }, [iframeRef, story]);

  useEffect(() => {
    const channel = iframeChannel(iframeRef.current);
    if (!ready || !args || !channel) {
      return;
    }
    const updatedArgs = changedArgs(delivered.current, args);
    if (Object.keys(updatedArgs).length === 0) {
      return;
    }
    channel.receive?.({
      type: UPDATE_STORY_ARGS,
      from: 'storybook-docs',
      args: [{ storyId: story.id, updatedArgs }],
    });
    delivered.current = args;
  }, [iframeRef, story, args, ready]);
};
