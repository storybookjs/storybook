import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileChangeEvent } from './adapters/index.ts';
import {
  internal_resetSourceFileChangeListeners,
  notifySourceFileChange,
  subscribeToSourceFileChanges,
} from './source-changes.ts';

const sampleEvent: FileChangeEvent = { kind: 'change', path: '/repo/src/Button.tsx' };

describe('source-changes notifier', () => {
  afterEach(() => {
    internal_resetSourceFileChangeListeners();
  });

  it('delivers events to a subscribed listener', () => {
    const listener = vi.fn();
    subscribeToSourceFileChanges(listener);

    notifySourceFileChange(sampleEvent);

    expect(listener).toHaveBeenCalledExactlyOnceWith(sampleEvent);
  });

  it('fans out to every subscriber', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeToSourceFileChanges(a);
    subscribeToSourceFileChanges(b);

    notifySourceFileChange(sampleEvent);

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('stops delivering after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSourceFileChanges(listener);

    unsubscribe();
    notifySourceFileChange(sampleEvent);

    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates a throwing listener so others still run', () => {
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();
    subscribeToSourceFileChanges(throwing);
    subscribeToSourceFileChanges(healthy);

    expect(() => notifySourceFileChange(sampleEvent)).not.toThrow();
    expect(healthy).toHaveBeenCalledOnce();
  });
});
