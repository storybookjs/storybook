import type { ChannelEvent, ChannelLike } from 'storybook/internal/channels';
import {
  CURRENT_STORY_WAS_SET,
  PREVIEW_INITIALIZED,
  type STORY_FINISHED,
  STORY_PREPARED,
} from 'storybook/internal/core-events';
import type { StoryId, ViewMode } from 'storybook/internal/types';

type PreviewEvent = Pick<ChannelEvent, 'type' | 'from'> & {
  source?: string;
  refId?: string;
};

export interface DocgenGate {
  isReady: (storyId: StoryId, refId?: string) => boolean;
  subscribe: (listener: () => void) => () => void;
}

// Register before the preview mounts; panel subscriptions must not own these listeners.
export function createDocgenGate({
  channel,
  gateEvent,
  resolveRefId,
}: {
  channel: Pick<ChannelLike, 'on'>;
  gateEvent: typeof STORY_FINISHED | typeof STORY_PREPARED;
  // undefined identifies the local preview; null rejects an unrecognized source.
  resolveRefId: (event: PreviewEvent) => string | undefined | null;
}): DocgenGate {
  const previews = new Map<
    string | undefined,
    { from: string; storyId: StoryId | undefined; ready: boolean }
  >();
  const listeners = new Set<() => void>();

  function onSelection(
    this: PreviewEvent,
    { storyId, viewMode }: { storyId: StoryId; viewMode: ViewMode }
  ) {
    const refId = resolveRefId(this);
    if (refId === null) {
      return;
    }
    const selectedStoryId = viewMode === 'story' ? storyId : undefined;
    const previous = previews.get(refId);
    if (previous?.from === this.from && previous.storyId === selectedStoryId) {
      return;
    }
    previews.set(refId, { from: this.from, storyId: selectedStoryId, ready: false });
    listeners.forEach((listener) => listener());
  }

  function onPreviewInitialized(this: PreviewEvent) {
    const refId = resolveRefId(this);
    if (refId === null) {
      return;
    }
    const previous = previews.get(refId);
    // A preview with no valid story can initialize without announcing a selection.
    if (previous && previous.from !== this.from) {
      previews.delete(refId);
      listeners.forEach((listener) => listener());
    }
  }

  function onGateEvent(this: PreviewEvent, payload: { id?: StoryId; storyId?: StoryId }) {
    const refId = resolveRefId(this);
    if (refId === null) {
      return;
    }
    const storyId = gateEvent === STORY_PREPARED ? payload.id : payload.storyId;
    const current = previews.get(refId);
    if (
      !current ||
      current.from !== this.from ||
      current.storyId !== storyId ||
      !storyId ||
      current.ready
    ) {
      return;
    }
    previews.set(refId, { ...current, ready: true });
    listeners.forEach((listener) => listener());
  }

  channel.on(CURRENT_STORY_WAS_SET, onSelection);
  channel.on(PREVIEW_INITIALIZED, onPreviewInitialized);
  channel.on(gateEvent, onGateEvent);

  return {
    isReady(storyId, refId) {
      const current = previews.get(refId);
      return current?.storyId === storyId && current.ready;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
