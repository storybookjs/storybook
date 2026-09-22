import type { CleanupCallback } from 'storybook/internal/csf';

const ANIMATION_TIMEOUT = 5000;

export function isTestEnvironment() {
  try {
    return (
      // @ts-expect-error This property exists in Vitest browser mode
      !!globalThis.__vitest_browser__ ||
      !!globalThis.window?.navigator?.userAgent?.match(/StorybookTestRunner/)
    );
  } catch {
    return false;
  }
}

/** Snap document-timeline CSS animations and transitions. Finite animations finish when `atEnd` is true; otherwise they pause at t=0. */
export function pauseAnimations(atEnd = true): CleanupCallback {
  if (
    !(
      'document' in globalThis &&
      'createElement' in globalThis.document &&
      'getAnimations' in globalThis.document
    )
  ) {
    return () => {};
  }

  const previousStates: {
    animation: Animation;
    playState: AnimationPlayState;
    currentTime: CSSNumberish | null;
  }[] = [];
  const handledAnimations = new WeakSet<Animation>();

  const pauseAllAnimations = () => {
    const animationRoots = [globalThis.document, ...getShadowRoots(globalThis.document)];
    for (const animation of animationRoots.flatMap((root) => root?.getAnimations?.() || [])) {
      if (
        !isDocumentAnimation(animation) ||
        (handledAnimations.has(animation) && animation.playState !== 'running')
      ) {
        continue;
      }
      handledAnimations.add(animation);
      previousStates.push({
        animation,
        playState: animation.playState,
        currentTime: animation.currentTime,
      });
      if (atEnd && isFiniteAnimation(animation)) {
        try {
          animation.finish();
        } catch {
          animation.pause();
          animation.currentTime = 0;
        }
      } else {
        animation.pause();
        animation.currentTime = 0;
      }
    }
    void document.body?.clientHeight;
  };

  addEventListener('animationstart', pauseAllAnimations);
  addEventListener('transitionrun', pauseAllAnimations);
  pauseAllAnimations();

  return () => {
    removeEventListener('animationstart', pauseAllAnimations);
    removeEventListener('transitionrun', pauseAllAnimations);

    while (previousStates.length > 0) {
      const { animation, playState, currentTime } = previousStates.pop()!;
      try {
        animation.currentTime = currentTime;
        if (playState === 'paused') {
          animation.pause();
        } else if (playState === 'running') {
          animation.play();
        }
      } catch {}
    }
  };
}

export async function waitForAnimations(signal?: AbortSignal) {
  if (
    !(
      'document' in globalThis &&
      'getAnimations' in globalThis.document &&
      'querySelectorAll' in globalThis.document
    )
  ) {
    return;
  }

  let timedOut = false;
  await Promise.race([
    new Promise((resolve) => {
      setTimeout(() => {
        const checkAnimationsFinished = async () => {
          if (timedOut || signal?.aborted) {
            return;
          }
          // Wait for finite WAAPI animations (parity with next); infinite WAAPI animations and
          // scroll/view timelines are skipped since they never finish.
          const runningAnimations = [globalThis.document, ...getShadowRoots(globalThis.document)]
            .flatMap((root) => root?.getAnimations?.() || [])
            .filter(
              (animation) =>
                animation.playState === 'running' &&
                animation.timeline instanceof DocumentTimeline &&
                isFiniteAnimation(animation)
            );
          if (runningAnimations.length > 0) {
            await Promise.allSettled(
              runningAnimations.map(async (animation) => animation.finished)
            );
            await checkAnimationsFinished();
          }
        };
        checkAnimationsFinished().then(resolve);
      }, 100);
    }),

    new Promise((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve(void 0);
      }, ANIMATION_TIMEOUT)
    ),
  ]);
}

function getShadowRoots(doc: Document | ShadowRoot) {
  return [doc, ...doc.querySelectorAll('*')].reduce<ShadowRoot[]>((acc, el) => {
    if ('shadowRoot' in el && el.shadowRoot) {
      acc.push(el.shadowRoot, ...getShadowRoots(el.shadowRoot));
    }
    return acc;
  }, []);
}

// Scroll/view timelines must keep running; currentTime can be a CSSNumericValue.
function isDocumentAnimation(anim: Animation) {
  return (
    (anim instanceof CSSAnimation || anim instanceof CSSTransition) &&
    anim.timeline instanceof DocumentTimeline
  );
}

function isFiniteAnimation(anim: Animation) {
  return !(
    anim.effect instanceof KeyframeEffect && anim.effect.getTiming().iterations === Infinity
  );
}
