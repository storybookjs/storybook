import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import {
  CURRENT_STORY_WAS_SET,
  PREVIEW_INITIALIZED,
  STORY_FINISHED,
  STORY_PREPARED,
} from 'storybook/internal/core-events';

import { type DocgenGate, createDocgenGate } from './docgenGate.ts';

describe('docgen gate', () => {
  let channel: Channel;
  let gate: DocgenGate;

  beforeEach(() => {
    channel = new Channel({});
    gate = createDocgenGate({
      channel,
      gateEvent: STORY_FINISHED,
      resolveRefId: (event) => (event.refId === 'unknown' ? null : event.refId),
    });
  });

  function receive(
    type: string,
    payload: object,
    { from = 'preview', refId }: { from?: string; refId?: string } = {}
  ) {
    const event = { type, from, refId, args: [payload] };
    channel.receive(event);
  }

  it('waits for completion even after the story is prepared', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_PREPARED, { id: 'a' });
    expect(gate.isReady('a')).toBe(false);

    receive(STORY_FINISHED, { storyId: 'a', status: 'success' });
    expect(gate.isReady('a')).toBe(true);
  });

  it('retains readiness after the panel unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = gate.subscribe(listener);
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    unsubscribe();

    expect(gate.isReady('a')).toBe(true);
    gate.subscribe(listener);
    expect(gate.isReady('a')).toBe(true);
  });

  it('records completion while no panel is subscribed', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    const listener = vi.fn();
    const unsubscribe = gate.subscribe(listener);
    unsubscribe();
    listener.mockClear();

    receive(STORY_FINISHED, { storyId: 'a' });

    expect(listener).not.toHaveBeenCalled();
    expect(gate.isReady('a')).toBe(true);
  });

  it('does not use another story completion for the current selection', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'b', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });

    expect(gate.isReady('a')).toBe(false);
    expect(gate.isReady('b')).toBe(false);
    receive(STORY_FINISHED, { storyId: 'b', status: 'error' });
    expect(gate.isReady('b')).toBe(true);
  });

  it('waits again when returning to a previously visited story', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'b', viewMode: 'story' });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });

    expect(gate.isReady('a')).toBe(false);
  });

  it('preserves readiness for an unchanged selection and same-document preparation', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(PREVIEW_INITIALIZED, {});
    receive(STORY_PREPARED, { id: 'a' });

    expect(gate.isReady('a')).toBe(true);
  });

  it('waits for the new document and preserves readiness when initialization finishes later', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' }, { from: 'new-preview' });
    expect(gate.isReady('a')).toBe(false);
    receive(STORY_FINISHED, { storyId: 'a' });
    expect(gate.isReady('a')).toBe(false);
    receive(STORY_FINISHED, { storyId: 'a' }, { from: 'new-preview' });
    expect(gate.isReady('a')).toBe(true);
    receive(PREVIEW_INITIALIZED, {}, { from: 'new-preview' });
    expect(gate.isReady('a')).toBe(true);
  });

  it('invalidates the old document when the new preview initializes without a valid selection', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    receive(PREVIEW_INITIALIZED, {}, { from: 'new-preview' });

    expect(gate.isReady('a')).toBe(false);
    receive(STORY_FINISHED, { storyId: 'a' });
    expect(gate.isReady('a')).toBe(false);
  });

  it('separates previews that select the same story id', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' }, { refId: 'remote' });
    receive(STORY_FINISHED, { storyId: 'a' }, { refId: 'remote' });

    expect(gate.isReady('a')).toBe(false);
    expect(gate.isReady('a', 'remote')).toBe(true);
    receive(STORY_FINISHED, { storyId: 'a' });
    receive(PREVIEW_INITIALIZED, {}, { refId: 'remote', from: 'new-preview' });
    expect(gate.isReady('a')).toBe(true);
    expect(gate.isReady('a', 'remote')).toBe(false);
  });

  it('ignores events from an unrecognized source', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' }, { refId: 'unknown' });
    receive(STORY_FINISHED, { storyId: 'a' }, { refId: 'unknown' });

    expect(gate.isReady('a')).toBe(false);
    expect(gate.isReady('a', 'unknown')).toBe(false);
  });

  it('ignores docs child renders', () => {
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a--docs', viewMode: 'docs' });
    receive(STORY_FINISHED, { storyId: 'a' });
    expect(gate.isReady('a')).toBe(false);
  });

  it('supports requesting docgen at storyPrepared', () => {
    channel = new Channel({});
    gate = createDocgenGate({ channel, gateEvent: STORY_PREPARED, resolveRefId: () => undefined });
    receive(CURRENT_STORY_WAS_SET, { storyId: 'a', viewMode: 'story' });
    receive(STORY_FINISHED, { storyId: 'a' });
    expect(gate.isReady('a')).toBe(false);

    receive(STORY_PREPARED, { id: 'a' });
    expect(gate.isReady('a')).toBe(true);
  });
});
