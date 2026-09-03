// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pauseAnimations } from './animation-utils.ts';

type MockAnimation = {
  playState: 'running' | 'paused' | 'idle' | 'finished';
  finish: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};

type AnimationRoot = { getAnimations?: () => MockAnimation[] };

function runningAnimation(): MockAnimation {
  return { playState: 'running', finish: vi.fn(), cancel: vi.fn() };
}

function stubAnimations(root: Document | ShadowRoot, animations: MockAnimation[]) {
  (root as unknown as AnimationRoot).getAnimations = vi.fn(() => animations);
}

const originalGetAnimations = (globalThis.document as unknown as AnimationRoot).getAnimations;

beforeEach(() => {
  // happy-dom does not implement getAnimations; stub it per test.
  stubAnimations(globalThis.document, []);
});

afterEach(() => {
  (globalThis.document as unknown as AnimationRoot).getAnimations = originalGetAnimations;
  vi.restoreAllMocks();
});

describe('pauseAnimations', () => {
  test('calls finish() on running animations by default', () => {
    const animation = runningAnimation();
    stubAnimations(document, [animation]);

    pauseAnimations();

    expect(animation.finish).toHaveBeenCalledTimes(1);
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test('calls cancel() when atEnd is false', () => {
    const animation = runningAnimation();
    stubAnimations(document, [animation]);

    pauseAnimations(false);

    expect(animation.cancel).toHaveBeenCalledTimes(1);
    expect(animation.finish).not.toHaveBeenCalled();
  });

  test('skips non-running animations', () => {
    const states = ['paused', 'idle', 'finished'] as const;
    const animations: MockAnimation[] = states.map((playState) => ({
      ...runningAnimation(),
      playState,
    }));
    stubAnimations(document, animations);

    pauseAnimations();

    for (const animation of animations) {
      expect(animation.finish).not.toHaveBeenCalled();
      expect(animation.cancel).not.toHaveBeenCalled();
    }
  });

  test('swallows errors from finish() and continues with remaining animations', () => {
    const throwing = runningAnimation();
    throwing.finish.mockImplementation(() => {
      throw new Error('InvalidStateError');
    });
    const next = runningAnimation();
    stubAnimations(document, [throwing, next]);

    expect(() => pauseAnimations()).not.toThrow();
    expect(throwing.finish).toHaveBeenCalledTimes(1);
    expect(next.finish).toHaveBeenCalledTimes(1);
  });

  test('snaps animations inside shadow roots', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const shadowAnim = runningAnimation();
    stubAnimations(shadow, [shadowAnim]);

    const docAnim = runningAnimation();
    stubAnimations(document, [docAnim]);

    pauseAnimations();

    expect(docAnim.finish).toHaveBeenCalledTimes(1);
    expect(shadowAnim.finish).toHaveBeenCalledTimes(1);

    document.body.removeChild(host);
  });

  test('is a no-op when getAnimations is unavailable (e.g. React Native)', () => {
    delete (document as unknown as AnimationRoot).getAnimations;
    expect(() => pauseAnimations()).not.toThrow();
  });
});
