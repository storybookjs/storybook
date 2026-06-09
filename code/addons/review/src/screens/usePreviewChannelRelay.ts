import { type RefObject, useEffect } from 'react';

import { FORCE_REMOUNT, UPDATE_GLOBALS, UPDATE_STORY_ARGS } from 'storybook/internal/core-events';

import { addons } from 'storybook/manager-api';

interface BaselineChannel {
  emit?: (event: string, ...args: unknown[]) => void;
}

const RELAY_EVENTS = [UPDATE_GLOBALS, UPDATE_STORY_ARGS, FORCE_REMOUNT] as const;

const getBaselineChannel = (
  baselineFrameRef: RefObject<HTMLIFrameElement>
): BaselineChannel | undefined => {
  const baselineWindow = baselineFrameRef.current?.contentWindow as
    | (Window & { __STORYBOOK_ADDONS_CHANNEL__?: BaselineChannel })
    | null
    | undefined;
  return baselineWindow?.__STORYBOOK_ADDONS_CHANNEL__;
};

/**
 * Forwards manager channel updates that target the latest preview iframe to the
 * baseline preview iframe as well, so controls/globals stay aligned in
 * side-by-side comparison.
 */
export const usePreviewChannelRelay = (
  baselineFrameRef: RefObject<HTMLIFrameElement>,
  showBaseline: boolean
) => {
  useEffect(() => {
    if (!showBaseline) {
      return undefined;
    }

    const channel = addons.getChannel();
    const relayToBaseline = (event: string, ...args: unknown[]) => {
      const baselineChannel = getBaselineChannel(baselineFrameRef);
      baselineChannel?.emit?.(event, ...args);
    };

    const handlers = RELAY_EVENTS.map((event) => {
      const handler = (...args: unknown[]) => relayToBaseline(event, ...args);
      channel.on(event, handler);
      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) => channel.off(event, handler));
    };
  }, [baselineFrameRef, showBaseline]);
};
