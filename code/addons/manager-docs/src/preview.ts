import { type ChannelLike, getChannel } from 'storybook/internal/channels';
import { FORCE_REMOUNT, STORY_FINISHED } from 'storybook/internal/core-events';

import { INSTANCE_QUERY_PARAM } from './constants.ts';
import {
  instanceIdFromSearch,
  isEventForInstance,
  storyFrameQuery,
} from './preview-participant.ts';
import { ACTION_EVENT_ID } from './runtime/action-events.ts';
import type { InstanceEvent } from './runtime/channel-router.ts';
import { nextContentReport } from './runtime/frame-height.ts';
import { INSTANCE_CHANNEL_EVENT, bindInstanceParticipant } from './runtime/instance-transport.ts';
import { DEBUGGER_EVENTS, FORWARDED_INTERACTION_EVENTS } from './runtime/interaction-events.ts';

export { instanceIdFromSearch, isEventForInstance, storyFrameQuery };

export const parameters = {
  experimentalManagerDocs: {
    instanceQueryParam: INSTANCE_QUERY_PARAM,
  },
};

type InstancePreview = {
  managerDocsInstanceId: string | null;
  updateInstanceStoryArgs?: (update: {
    instanceId: string;
    storyId: string;
    updatedArgs: Record<string, unknown>;
    generation?: number;
  }) => Promise<boolean> | boolean;
  updateInstanceGlobals?: (update: {
    instanceId: string;
    globals: Record<string, unknown>;
    generation?: number;
  }) => Promise<boolean> | boolean;
  hasDeferredPlay?: () => boolean;
  runInstancePlay?: () => Promise<boolean> | boolean;
  cancelInstancePlay?: () => void;
};

export function deliverPreviewInstanceEvent(
  preview: InstancePreview | null | undefined,
  instanceId: string,
  event: InstanceEvent & { generation?: number }
): void {
  if (!preview || preview.managerDocsInstanceId !== instanceId) {
    return;
  }
  if (event.kind === 'args' && event.storyId) {
    void preview.updateInstanceStoryArgs?.({
      instanceId,
      storyId: event.storyId,
      updatedArgs: event.args ?? {},
      generation: event.generation,
    });
    return;
  }
  if (event.kind === 'globals') {
    void preview.updateInstanceGlobals?.({
      instanceId,
      globals: event.globals ?? {},
      generation: event.generation,
    });
  }
}

function emitPlayPhase(
  channel: { emit: (event: string, payload: InstanceEvent) => void },
  instanceId: string,
  phase: 'ready' | 'absent' | 'done' | 'error'
) {
  channel.emit(INSTANCE_CHANNEL_EVENT, {
    kind: 'play',
    instanceId,
    phase,
    options: { target: instanceId },
  } as InstanceEvent);
}

function currentPreview(): InstancePreview | undefined {
  return (globalThis as { __STORYBOOK_PREVIEW__?: InstancePreview }).__STORYBOOK_PREVIEW__;
}

export function installInstanceParticipant(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const search = window.location.search;
  const instanceId = instanceIdFromSearch(search);
  if (!instanceId) {
    return;
  }
  const channel = getChannel();
  if (!channel) {
    return;
  }
  const liveId = () => currentPreview()?.managerDocsInstanceId ?? instanceId;
  const plays = createInstancePlayResponder(channel, instanceId, currentPreview);
  const publishHeight = watchContentHeight(channel, liveId);
  const storyId = new URLSearchParams(search).get('id') ?? '';
  forwardInstanceInteractions(channel, instanceId, storyId);
  forwardInstanceActions(channel, instanceId, storyId);
  bindInstanceParticipant(
    channel,
    search,
    (event) => {
      if (event.kind === 'play' && (event.phase === 'start' || event.phase === 'pause')) {
        plays.receive(event);
        return;
      }
      if (event.kind === 'debugger') {
        deliverDebuggerEvent(channel, event);
        return;
      }
      deliverPreviewInstanceEvent(currentPreview(), liveId(), event);
    },
    liveId
  );
  let debuggerRemount = false;
  channel.on(FORCE_REMOUNT, (payload?: { isDebugging?: boolean }) => {
    debuggerRemount = payload?.isDebugging === true;
  });
  channel.on(STORY_FINISHED, () => {
    publishHeight();
    const preview = currentPreview();
    if (debuggerRemount) {
      debuggerRemount = false;
      void runDebuggedPlay(preview);
      return;
    }
    emitPlayPhase(channel, liveId(), preview?.hasDeferredPlay?.() ? 'ready' : 'absent');
  });
}

/**
 * Re-send the preview events the Interactions panel reads, addressed to this instance only.
 */
export function forwardInstanceInteractions(
  channel: Pick<ChannelLike, 'on' | 'emit'>,
  instanceId: string,
  storyId: string
): void {
  for (const type of FORWARDED_INTERACTION_EVENTS) {
    channel.on(type, (...args: unknown[]) => {
      channel.emit(INSTANCE_CHANNEL_EVENT, {
        kind: 'interactions',
        instanceId,
        storyId,
        message: { type, args },
        options: { target: instanceId },
      });
    });
  }
}

/**
 * Re-send action events the Actions panel reads, addressed to this instance only.
 */
export function forwardInstanceActions(
  channel: Pick<ChannelLike, 'on' | 'emit'>,
  instanceId: string,
  storyId: string
): void {
  channel.on(ACTION_EVENT_ID, (...args: unknown[]) => {
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'actions',
      instanceId,
      storyId,
      message: { type: ACTION_EVENT_ID, args },
      options: { target: instanceId },
    });
  });
}

/**
 * Hand a debugger control from this instance's canvas to the instrumenter in this iframe.
 */
export function deliverDebuggerEvent(
  channel: Pick<ChannelLike, 'receive'>,
  event: InstanceEvent
): void {
  const message = event.message;
  if (!message || !DEBUGGER_EVENTS.includes(message.type)) {
    return;
  }
  channel.receive?.({ type: message.type, args: message.args, from: INSTANCE_CHANNEL_EVENT });
}

// The instrumenter remounts to step, and a docs instance defers its play, so the stepped play is
// started here instead of waiting for the scheduler, which already ran this instance once.
async function runDebuggedPlay(preview: InstancePreview | undefined) {
  if (!preview?.hasDeferredPlay?.()) {
    return;
  }
  try {
    await preview.runInstancePlay?.();
  } catch {
    // The failure already reached the panel as PLAY_FUNCTION_THREW_EXCEPTION.
  }
}

function watchContentHeight(
  channel: { emit: (event: string, payload: InstanceEvent) => void },
  getInstanceId: () => string
): () => void {
  let previous: number | null = null;
  const publish = () => {
    const next = nextContentReport(previous, measureInstanceContent(document), window.innerHeight);
    if (next === null) {
      return;
    }
    previous = next;
    const instanceId = getInstanceId();
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'height',
      instanceId,
      height: next,
      options: { target: instanceId },
    } as InstanceEvent);
  };
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => publish());
    const root = document.getElementById('storybook-root');
    if (root) {
      observer.observe(root);
    }
    observer.observe(document.documentElement);
  }
  return publish;
}

function measureInstanceContent(doc: Document): number | null {
  const root = doc.getElementById('storybook-root');
  if (!root) {
    return null;
  }
  const nodes = root.children.length > 0 ? [...root.children] : [root];
  let top = Number.POSITIVE_INFINITY;
  let bottom = 0;
  for (const node of nodes) {
    if (!(node instanceof Element)) {
      continue;
    }
    const style = getComputedStyle(node);
    if (style.position === 'fixed') {
      continue;
    }
    const rect = node.getBoundingClientRect();
    const marginTop = Number.parseFloat(style.marginTop) || 0;
    const marginBottom = Number.parseFloat(style.marginBottom) || 0;
    top = Math.min(top, rect.top - marginTop);
    bottom = Math.max(bottom, rect.bottom + marginBottom);
  }
  if (!Number.isFinite(top) || bottom < top) {
    return null;
  }
  return bottom - top;
}

export function createInstancePlayResponder(
  channel: { emit: (event: string, payload: InstanceEvent) => void },
  instanceId: string,
  getPreview: () => InstancePreview | null | undefined
): { receive: (event: InstanceEvent) => void } {
  let paused = false;
  return {
    receive(event) {
      if (event.kind !== 'play') {
        return;
      }
      if (event.phase === 'pause') {
        paused = true;
        getPreview()?.cancelInstancePlay?.();
        return;
      }
      if (event.phase !== 'start' || paused) {
        return;
      }
      void runReleasedPlay(
        channel,
        () => getPreview()?.managerDocsInstanceId ?? instanceId,
        getPreview
      );
    },
  };
}

async function runReleasedPlay(
  channel: { emit: (event: string, payload: InstanceEvent) => void },
  getInstanceId: () => string,
  getPreview: () => InstancePreview | null | undefined
) {
  const preview = getPreview();
  const instanceId = getInstanceId();
  if (!preview?.managerDocsInstanceId || !preview.runInstancePlay) {
    emitPlayPhase(channel, instanceId, 'error');
    return;
  }
  try {
    const ran = await preview.runInstancePlay();
    emitPlayPhase(channel, instanceId, ran === false ? 'error' : 'done');
  } catch {
    emitPlayPhase(channel, instanceId, 'error');
  }
}

installInstanceParticipant();
