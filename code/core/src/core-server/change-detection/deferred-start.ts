import type { ChannelLike } from 'storybook/internal/channels';
import { DOCS_RENDERED, STORY_FINISHED } from 'storybook/internal/core-events';

import type {
  ChangeDetectionAdapter,
  FileChangeEvent,
} from '../../shared/open-service/services/module-graph/engine/adapters/types.ts';
import { getChangeDetectionReadiness, setChangeDetectionHost } from './readiness.ts';

// Outlasts a slow first page load; a preview that never finishes a render waits this long.
export const START_FALLBACK_DELAY_MS = 30_000;

// Starts change detection once it no longer competes with the first page load for the server's
// main thread: when a preview finished its first story or docs page, or after the fallback delay.
// A file change or a readiness request cannot wait for either and starts it at once.
export function deferChangeDetectionStart({
  channel,
  adapter,
  start,
}: {
  channel: Pick<ChannelLike, 'on' | 'off'>;
  adapter: ChangeDetectionAdapter | undefined;
  start: () => void;
}) {
  let waiting = true;
  const unseenChanges: FileChangeEvent[] = [];
  let unsubscribeRecorder: (() => void) | undefined;

  function stopRecording() {
    unsubscribeRecorder?.();
    unsubscribeRecorder = undefined;
  }

  function disarm() {
    waiting = false;
    clearTimeout(fallback);
    channel.off(STORY_FINISHED, startNow);
    channel.off(DOCS_RENDERED, startNow);
    setChangeDetectionHost(undefined);
  }

  function startNow() {
    if (!waiting) {
      return;
    }
    disarm();
    start();
    // A module graph that fails to start never takes the recorded changes over.
    void getChangeDetectionReadiness().then(stopRecording);
  }

  channel.on(STORY_FINISHED, startNow);
  channel.on(DOCS_RENDERED, startNow);
  const fallback = setTimeout(startNow, START_FALLBACK_DELAY_MS);
  fallback.unref();
  setChangeDetectionHost(startNow);
  // A change the module graph never hears of is lost to its subscribers, such as docgen.
  unsubscribeRecorder = adapter?.onFileChange((event) => {
    unseenChanges.push(event);
    startNow();
  });

  return {
    // `Required`, so that a member added to the adapter contract has to be forwarded here.
    recordingAdapter:
      adapter &&
      ({
        getResolveConfig: () => adapter.getResolveConfig(),
        onStartupFailure: (handler) => adapter.onStartupFailure?.(handler) ?? (() => {}),
        onFileChange: (handler) => {
          const unsubscribe = adapter.onFileChange(handler);
          stopRecording();
          unseenChanges.splice(0).forEach((event) => handler(event));
          return unsubscribe;
        },
      } satisfies Required<ChangeDetectionAdapter>),
    cancel: () => {
      disarm();
      stopRecording();
    },
  };
}
