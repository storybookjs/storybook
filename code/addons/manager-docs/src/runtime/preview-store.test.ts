import { Channel } from 'storybook/internal/channels';
import { describe, expect, it } from 'vitest';

import { INSTANCE_QUERY_PARAM } from '../constants.ts';
import { instanceIdFromSearch } from '../preview-participant.ts';
import { createInstancePlayResponder, deliverPreviewInstanceEvent } from '../preview.ts';
import {
  applyAddressedUpdate,
  createAddressedPreview,
  resetAddressedPreview,
  reuseAddressedPreview,
  type AddressedPreview,
} from '../../../../core/src/preview-api/modules/store/addressed-preview.ts';
import {
  createIframeHost,
  mountInstance,
  reuseInstance,
  sessionFrameSearch,
} from './iframe-session.ts';
import { INSTANCE_CHANNEL_EVENT, bindInstanceParticipant } from './instance-transport.ts';

const storyId = 'button--primary';
const initialArgs = { label: 'Hello' };
const initialGlobals = { viewport: 'desktop' };

function memoryStore(args: Record<string, unknown>, globals: Record<string, unknown>) {
  let currentArgs = structuredClone(args);
  let currentGlobals = structuredClone(globals);
  const initialA = structuredClone(args);
  const initialG = structuredClone(globals);
  return {
    args: {
      replace(_storyId: string, next: Record<string, unknown>) {
        currentArgs = structuredClone(next);
      },
      get() {
        return currentArgs;
      },
      resetToInitial() {
        currentArgs = structuredClone(initialA);
      },
    },
    globals: {
      replace(next: Record<string, unknown>) {
        currentGlobals = structuredClone(next);
      },
      get() {
        return currentGlobals;
      },
      resetToInitial() {
        currentGlobals = structuredClone(initialG);
      },
    },
  };
}

function documentFor(instanceId: string | null): AddressedPreview {
  const store = memoryStore(initialArgs, initialGlobals);
  return createAddressedPreview({
    instanceId,
    storyId,
    args: store.args,
    globals: store.globals,
  });
}

function previewFor(doc: AddressedPreview) {
  return {
    get managerDocsInstanceId() {
      return doc.instanceId;
    },
    updateInstanceStoryArgs(update: {
      instanceId: string;
      storyId: string;
      updatedArgs: Record<string, unknown>;
      generation?: number;
    }) {
      return applyAddressedUpdate(doc, {
        kind: 'args',
        instanceId: update.instanceId,
        storyId: update.storyId,
        args: update.updatedArgs,
        generation: update.generation,
      });
    },
    updateInstanceGlobals(update: {
      instanceId: string;
      globals: Record<string, unknown>;
      generation?: number;
    }) {
      return applyAddressedUpdate(doc, {
        kind: 'globals',
        instanceId: update.instanceId,
        globals: update.globals,
        generation: update.generation,
      });
    },
  };
}

describe('instance preview stores', () => {
  it('applies one instance on the channel and leaves the other instance and the main canvas unchanged', () => {
    const channel = new Channel({});
    const instanceA = documentFor('a');
    const instanceB = documentFor('b');
    const main = documentFor(null);
    let host = mountInstance(createIframeHost(), 'a', {
      instanceId: 'a',
      storyId,
      args: initialArgs,
      globals: initialGlobals,
    });
    host = mountInstance(host, 'b', {
      instanceId: 'b',
      storyId,
      args: initialArgs,
      globals: initialGlobals,
    });
    const searchA = sessionFrameSearch(host, 'a');
    const searchB = sessionFrameSearch(host, 'b');
    expect(instanceIdFromSearch(`?${searchA}`)).toBe('a');
    expect(searchA).toContain(`${INSTANCE_QUERY_PARAM}=a`);

    const stopA = bindInstanceParticipant(channel, `?${searchA}`, (event) => {
      deliverPreviewInstanceEvent(previewFor(instanceA), 'a', event);
    });
    const stopB = bindInstanceParticipant(channel, `?${searchB}`, (event) => {
      deliverPreviewInstanceEvent(previewFor(instanceB), 'b', event);
    });
    const stopMain = bindInstanceParticipant(channel, `?id=${storyId}&viewMode=story`, (event) => {
      deliverPreviewInstanceEvent(previewFor(main), 'storybook-preview-iframe', event);
    });

    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'args',
      instanceId: 'a',
      storyId,
      args: { label: 'Only A' },
      options: { target: 'a' },
    });
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'globals',
      instanceId: 'a',
      globals: { viewport: 'mobile' },
      options: { target: 'a' },
    });
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'args',
      storyId,
      args: { label: 'broadcast' },
    });

    expect(instanceA.args.get(storyId)).toEqual({ label: 'Only A' });
    expect(instanceA.globals.get()).toEqual({ viewport: 'mobile' });
    expect(instanceB.args.get(storyId)).toEqual(initialArgs);
    expect(instanceB.globals.get()).toEqual(initialGlobals);
    expect(main.args.get(storyId)).toEqual(initialArgs);
    expect(main.globals.get()).toEqual(initialGlobals);

    stopA.dispose();
    resetAddressedPreview(instanceA);
    expect(instanceA.args.get(storyId)).toEqual(initialArgs);
    expect(instanceA.globals.get()).toEqual(initialGlobals);

    host = reuseInstance(host, 'a', {
      instanceId: 'a2',
      storyId,
      args: initialArgs,
      globals: initialGlobals,
    });
    reuseAddressedPreview(instanceA, {
      instanceId: 'a2',
      storyId,
      args: host.sessions.find((session) => session.frameId === 'a')!.occupant!.args,
      globals: host.sessions.find((session) => session.frameId === 'a')!.occupant!.globals,
    });
    const stopReused = bindInstanceParticipant(
      channel,
      `?${sessionFrameSearch(host, 'a2')}`,
      (event) => {
        deliverPreviewInstanceEvent(previewFor(instanceA), 'a2', event);
      }
    );

    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'args',
      instanceId: 'a',
      storyId,
      generation: 1,
      args: { label: 'Only A' },
    });
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      kind: 'args',
      instanceId: 'b',
      storyId,
      args: { label: 'Only B' },
    });

    expect(instanceA.args.get(storyId)).toEqual(initialArgs);
    expect(instanceA.args.get(storyId)).not.toEqual({ label: 'Only B' });
    expect(instanceB.args.get(storyId)).toEqual({ label: 'Only B' });
    expect(main.args.get(storyId)).toEqual(initialArgs);

    stopB.dispose();
    stopMain.dispose();
    stopReused.dispose();
  });
});

describe('instance play pause', () => {
  it('does not start a play after that iframe was paused', async () => {
    const started: string[] = [];
    let cancelled = 0;
    const responder = createInstancePlayResponder({ emit: () => undefined }, 'plain', () => ({
      managerDocsInstanceId: 'plain',
      runInstancePlay: () => {
        started.push('plain');
        return true;
      },
      cancelInstancePlay: () => {
        cancelled += 1;
      },
    }));

    responder.receive({ kind: 'play', instanceId: 'plain', phase: 'start' });
    await Promise.resolve();
    responder.receive({ kind: 'play', instanceId: 'plain', phase: 'pause' });
    responder.receive({ kind: 'play', instanceId: 'plain', phase: 'start' });
    await Promise.resolve();

    expect(started).toEqual(['plain']);
    expect(cancelled).toBe(1);
  });
});
