import type { Channel } from 'storybook/internal/channels';
import {
  FORCE_REMOUNT,
  PLAY_FUNCTION_THREW_EXCEPTION,
  PREVIEW_KEYDOWN,
  STORY_ARGS_UPDATED,
  STORY_ERRORED,
  STORY_FINISHED,
  STORY_RENDERED,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import type { Args, Globals, StoryId } from 'storybook/internal/types';

import { EVENTS as INSTRUMENTER_EVENTS } from '../../../../instrumenter/EVENTS.ts';
import type { FrameEvent, FramePool } from '../FramePool.ts';

// What the story's preview reports about the story, which the manager's panels show. Its events
// about itself, such as its globals and its selection, are this preview's to send.
const STORY_EVENTS = new Set<string>([
  STORY_RENDER_PHASE_CHANGED,
  STORY_RENDERED,
  STORY_FINISHED,
  STORY_ERRORED,
  STORY_THREW_EXCEPTION,
  PLAY_FUNCTION_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
  STORY_ARGS_UPDATED,
  PREVIEW_KEYDOWN,
]);

// An addon's events, such as the actions and the interactions of the play function, are named
// `storybook/<addon>/<event>`.
const relays = ({ type }: FrameEvent) => STORY_EVENTS.has(type) || type.startsWith('storybook/');

// The debugger of the interactions panel: the play function runs in the frame, so its controls go
// there.
const DEBUGGER_EVENTS = [
  INSTRUMENTER_EVENTS.START,
  INSTRUMENTER_EVENTS.BACK,
  INSTRUMENTER_EVENTS.GOTO,
  INSTRUMENTER_EVENTS.NEXT,
  INSTRUMENTER_EVENTS.END,
];

export interface StoryInFrame {
  /** The story with new globals or args: the frame renders it again. */
  update: (globals: Globals, args: Args) => void;
  remount: () => void;
  release: () => void;
}

/**
 * Story `storyId` in the story view, from a frame of `pool` that fills the window: this preview
 * renders nothing of it, and the frame's preview reports to the manager through this one.
 */
export function renderInFrame({
  pool,
  channel,
  storyId,
  globals,
  args,
  initialArgs,
  autoplay,
  onShow,
}: {
  pool: FramePool;
  channel: Channel;
  storyId: StoryId;
  globals: Globals;
  args: Args;
  initialArgs: Args;
  autoplay: boolean;
  onShow: () => void;
}): StoryInFrame {
  let shownArgs = JSON.stringify(args);
  let shownGlobals = JSON.stringify(globals);
  const lease = pool.lease({
    storyId,
    globals,
    autoplay,
    onShow: (shown) => {
      if (shown) {
        // The frame shows the story with its initial args, or those it had before.
        if (JSON.stringify(args) !== JSON.stringify(initialArgs)) {
          lease.send(UPDATE_STORY_ARGS, { storyId, updatedArgs: args });
        }
        onShow();
      }
    },
    onEvent: (event) => {
      if (relays(event)) {
        channel.emit(event.type, ...event.args);
      }
    },
  });
  // This preview's instrumenter answers a debugger control with a remount, which the frame's own
  // instrumenter does too: in the same task, that remount is the control's, and the frame gets the
  // control only.
  let remount: ReturnType<typeof setTimeout> | undefined;
  const forwarders = DEBUGGER_EVENTS.map((type) => {
    const forward = (...args: unknown[]) => {
      clearTimeout(remount);
      lease.send(type, ...args);
    };
    channel.on(type, forward);
    return () => channel.off(type, forward);
  });
  return {
    update: (newGlobals, newArgs) => {
      if (JSON.stringify(newGlobals) !== shownGlobals) {
        shownGlobals = JSON.stringify(newGlobals);
        lease.setGlobals(newGlobals);
      }
      if (JSON.stringify(newArgs) !== shownArgs) {
        shownArgs = JSON.stringify(newArgs);
        args = newArgs;
        lease.send(UPDATE_STORY_ARGS, { storyId, updatedArgs: newArgs });
      }
    },
    remount: () => {
      clearTimeout(remount);
      remount = setTimeout(() => lease.send(FORCE_REMOUNT, { storyId }));
    },
    release: () => {
      clearTimeout(remount);
      forwarders.forEach((stop) => stop());
      lease.release();
    },
  };
}
