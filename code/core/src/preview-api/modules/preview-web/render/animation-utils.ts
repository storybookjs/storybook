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

// Snap running animations to a deterministic state via the Web Animations API.
// The previous CSS-injection approach (`animation: none !important` + reflow) did not
// reliably resolve opacity keyframes to their end value before axe-core ran, producing
// false-positive color-contrast violations.
export function pauseAnimations(atEnd = true): CleanupCallback {
  if (
    !(
      'document' in globalThis &&
      'getAnimations' in globalThis.document &&
      'querySelectorAll' in globalThis.document
    )
  ) {
    // Don't run in React Native
    return () => {};
  }

  const animationRoots = [globalThis.document, ...getShadowRoots(globalThis.document)];
  const animations = animationRoots
    .flatMap((root) => root?.getAnimations?.() || [])
    .filter((a) => a.playState === 'running');

  for (const animation of animations) {
    try {
      if (atEnd) {
        animation.finish();
      } else {
        animation.cancel();
      }
    } catch {
      // `finish()` throws on infinite animations; ignore and leave them running.
    }
  }

  return () => {};
}

// Use the Web Animations API to wait for any animations and transitions to finish
export async function waitForAnimations(signal?: AbortSignal) {
  if (
    !(
      'document' in globalThis &&
      'getAnimations' in globalThis.document &&
      'querySelectorAll' in globalThis.document
    )
  ) {
    // Don't run in React Native
    return;
  }

  let timedOut = false;
  await Promise.race([
    // After 50ms, retrieve any running animations and wait for them to finish
    // If new animations are created while waiting, we'll wait for them too
    new Promise((resolve) => {
      setTimeout(() => {
        const animationRoots = [globalThis.document, ...getShadowRoots(globalThis.document)];
        const checkAnimationsFinished = async () => {
          if (timedOut || signal?.aborted) {
            return;
          }
          const runningAnimations = animationRoots
            .flatMap((el) => el?.getAnimations?.() || [])
            .filter((a) => a.playState === 'running' && !isInfiniteAnimation(a));
          if (runningAnimations.length > 0) {
            // Treat any errors (e.g. AbortError) from `finished` as also finished, even though not successfully so
            await Promise.allSettled(runningAnimations.map(async (a) => a.finished));
            await checkAnimationsFinished();
          }
        };
        checkAnimationsFinished().then(resolve);
      }, 100);
    }),

    // If animations don't finish within the timeout, continue without waiting
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

function isInfiniteAnimation(anim: Animation) {
  if (anim instanceof CSSAnimation && anim.effect instanceof KeyframeEffect && anim.effect.target) {
    const style = getComputedStyle(anim.effect.target, anim.effect.pseudoElement);
    const index = style.animationName?.split(', ').indexOf(anim.animationName);
    const iterations = style.animationIterationCount.split(', ')[index];
    return iterations === 'infinite';
  }
  return false;
}
