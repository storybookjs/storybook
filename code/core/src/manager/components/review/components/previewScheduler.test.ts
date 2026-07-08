import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The scheduler keeps module-level state (active count, queue), so each test loads a fresh copy
// under fake timers.
const loadScheduler = async () => import('./previewScheduler.ts');

describe('previewScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the first preview immediately', async () => {
    const { enqueuePreview } = await loadScheduler();
    const start = vi.fn();
    enqueuePreview(start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('boots one preview at a time', async () => {
    const { enqueuePreview } = await loadScheduler();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    enqueuePreview(a);
    enqueuePreview(b);
    enqueuePreview(c);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();
  });

  it('starts the next queued preview only when the current slot is released', async () => {
    const { enqueuePreview } = await loadScheduler();
    const a = vi.fn();
    const b = vi.fn();
    const handleA = enqueuePreview(a);
    enqueuePreview(b);

    expect(b).not.toHaveBeenCalled();
    handleA.release();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('releasing is idempotent and does not over-start the queue', async () => {
    const { enqueuePreview } = await loadScheduler();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const handleA = enqueuePreview(a);
    enqueuePreview(b);
    enqueuePreview(c);

    handleA.release();
    handleA.release();
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).not.toHaveBeenCalled();
  });

  it('auto-releases a wedged slot after the backstop deadline', async () => {
    const { enqueuePreview, PREVIEW_SETTLE_TIMEOUT_MS } = await loadScheduler();
    const a = vi.fn();
    const b = vi.fn();
    enqueuePreview(a);
    enqueuePreview(b);

    expect(b).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PREVIEW_SETTLE_TIMEOUT_MS);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('forceStart bypasses the cap for a still-queued preview', async () => {
    const { enqueuePreview } = await loadScheduler();
    const a = vi.fn();
    const b = vi.fn();
    enqueuePreview(a);
    const handleB = enqueuePreview(b);

    expect(b).not.toHaveBeenCalled();
    handleB.forceStart();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
