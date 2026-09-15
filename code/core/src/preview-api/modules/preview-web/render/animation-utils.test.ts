// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pauseAnimations, waitForAnimations } from './animation-utils.ts';

class TestDocumentTimeline {}
class TestScrollTimeline {}
class TestKeyframeEffect {
  iterations: number;
  constructor(iterations = 1) {
    this.iterations = iterations;
  }
  getTiming() {
    return { iterations: this.iterations };
  }
}
class TestCSSAnimation {
  playState: AnimationPlayState = 'running';
  timeline: object = new TestDocumentTimeline();
  effect: TestKeyframeEffect = new TestKeyframeEffect();
  currentTime: number | null = 0;
  finished: Promise<void> = Promise.resolve();
  finish = vi.fn(() => {
    this.playState = 'finished';
  });
  pause = vi.fn(() => {
    this.playState = 'paused';
  });
  play = vi.fn(() => {
    this.playState = 'running';
  });
  cancel = vi.fn();
}
class TestCSSTransition extends TestCSSAnimation {}

type AnimationRoot = { getAnimations?: () => object[] };

function stubAnimations(root: Document | ShadowRoot, animations: object[]) {
  (root as unknown as AnimationRoot).getAnimations = vi.fn(() => animations);
}

const originalGetAnimations = (globalThis.document as unknown as AnimationRoot).getAnimations;

let restore = () => {};

beforeEach(() => {
  vi.stubGlobal('CSSAnimation', TestCSSAnimation);
  vi.stubGlobal('CSSTransition', TestCSSTransition);
  vi.stubGlobal('DocumentTimeline', TestDocumentTimeline);
  vi.stubGlobal('KeyframeEffect', TestKeyframeEffect);
  stubAnimations(globalThis.document, []);
});

afterEach(() => {
  restore();
  restore = () => {};
  (globalThis.document as unknown as AnimationRoot).getAnimations = originalGetAnimations;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('pauseAnimations', () => {
  test('calls finish() on finite document-timeline CSS animations by default', () => {
    const animation = new TestCSSAnimation();
    stubAnimations(document, [animation]);

    restore = pauseAnimations();

    expect(animation.finish).toHaveBeenCalledTimes(1);
    expect(animation.pause).not.toHaveBeenCalled();
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test('finishes finite document-timeline CSS transitions by default', () => {
    const transition = new TestCSSTransition();
    stubAnimations(document, [transition]);

    restore = pauseAnimations();

    expect(transition.finish).toHaveBeenCalledTimes(1);
    expect(transition.cancel).not.toHaveBeenCalled();
  });

  test('pauses at t=0 when atEnd is false, without cancel()', () => {
    const animation = new TestCSSAnimation();
    animation.currentTime = 120;
    stubAnimations(document, [animation]);

    restore = pauseAnimations(false);

    expect(animation.pause).toHaveBeenCalledTimes(1);
    expect(animation.currentTime).toBe(0);
    expect(animation.finish).not.toHaveBeenCalled();
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test('pauses infinite document-timeline CSS animations at t=0 instead of finish()', () => {
    const animation = new TestCSSAnimation();
    animation.effect = new TestKeyframeEffect(Infinity);
    animation.currentTime = 80;
    stubAnimations(document, [animation]);

    restore = pauseAnimations();

    expect(animation.pause).toHaveBeenCalledTimes(1);
    expect(animation.currentTime).toBe(0);
    expect(animation.finish).not.toHaveBeenCalled();
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test('leaves scroll/view-timeline CSS animations running', () => {
    const animation = new TestCSSAnimation();
    animation.timeline = new TestScrollTimeline();
    stubAnimations(document, [animation]);

    restore = pauseAnimations();

    expect(animation.finish).not.toHaveBeenCalled();
    expect(animation.pause).not.toHaveBeenCalled();
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test('leaves non-CSS Web Animations untouched', () => {
    const animation = {
      playState: 'running' as const,
      finish: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
      currentTime: 10,
    };
    stubAnimations(document, [animation]);

    restore = pauseAnimations();

    expect(animation.finish).not.toHaveBeenCalled();
    expect(animation.pause).not.toHaveBeenCalled();
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test('swallows errors from finish() and continues with remaining animations', () => {
    const throwing = new TestCSSAnimation();
    throwing.finish.mockImplementation(() => {
      throw new Error('InvalidStateError');
    });
    const next = new TestCSSAnimation();
    stubAnimations(document, [throwing, next]);

    expect(() => {
      restore = pauseAnimations();
    }).not.toThrow();
    expect(throwing.finish).toHaveBeenCalledTimes(1);
    expect(throwing.pause).toHaveBeenCalledTimes(1);
    expect(throwing.currentTime).toBe(0);
    expect(next.finish).toHaveBeenCalledTimes(1);
  });

  test('snaps animations inside shadow roots', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const shadowAnim = new TestCSSAnimation();
    stubAnimations(shadow, [shadowAnim]);

    const docAnim = new TestCSSAnimation();
    stubAnimations(document, [docAnim]);

    restore = pauseAnimations();

    expect(docAnim.finish).toHaveBeenCalledTimes(1);
    expect(shadowAnim.finish).toHaveBeenCalledTimes(1);

    document.body.removeChild(host);
  });

  test('is a no-op when getAnimations is unavailable (e.g. React Native)', () => {
    delete (document as unknown as AnimationRoot).getAnimations;
    expect(() => {
      restore = pauseAnimations();
    }).not.toThrow();
  });

  test('restores previous playState and currentTime', () => {
    const animation = new TestCSSAnimation();
    animation.currentTime = 40;
    stubAnimations(document, [animation]);

    restore = pauseAnimations();
    expect(animation.playState).toBe('finished');

    restore();
    restore = () => {};

    expect(animation.currentTime).toBe(40);
    expect(animation.play).toHaveBeenCalledTimes(1);
    expect(animation.playState).toBe('running');
  });
});

describe('waitForAnimations', () => {
  test('does not wait for scroll-timeline or infinite document-timeline animations', async () => {
    vi.useFakeTimers();
    const infinite = new TestCSSAnimation();
    infinite.effect = new TestKeyframeEffect(Infinity);
    infinite.finished = new Promise(() => {});
    const scroll = new TestCSSAnimation();
    scroll.timeline = new TestScrollTimeline();
    scroll.finished = new Promise(() => {});
    stubAnimations(document, [infinite, scroll]);

    const pending = waitForAnimations();
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBeUndefined();
  });

  test('waits for finite document-timeline CSS animations to finish', async () => {
    vi.useFakeTimers();
    let resolveFinished!: () => void;
    const animation = new TestCSSAnimation();
    animation.finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    stubAnimations(document, [animation]);

    const pending = waitForAnimations();
    await vi.advanceTimersByTimeAsync(100);

    animation.playState = 'finished';
    resolveFinished();
    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toBeUndefined();
  });
});
