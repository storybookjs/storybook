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

// Pause all animations and transitions by overriding the CSS properties
export function pauseAnimations(atEnd = true): CleanupCallback {
  if (!('document' in globalThis && 'createElement' in globalThis.document)) {
    // Don't run in React Native
    return () => {};
  }

  // Remove all animations
  const disableStyle = document.createElement('style');
  disableStyle.textContent = `*, *:before, *:after {
    animation: none !important;
  }`;
  document.head.appendChild(disableStyle);

  // Pause any new animations
  const pauseStyle = document.createElement('style');
  pauseStyle.textContent = `*, *:before, *:after {
    animation-delay: 0s !important;
    animation-direction: ${atEnd ? 'reverse' : 'normal'} !important;
    animation-play-state: paused !important;
    transition: none !important;
  }`;
  document.head.appendChild(pauseStyle);

  // Force a reflow
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  document.body.clientHeight;

  // Now recreate all animations, getting paused in their initial state
  document.head.removeChild(disableStyle);

  return () => {
    pauseStyle.parentNode?.removeChild(pauseStyle);
  };
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
            await Promise.all(
              runningAnimations.map(async (a) => {
                try {
                  await a.finished;
                } catch (err) {
                  // Ignore AbortError from canceled animations, treat as "finished"
                  if (!(err instanceof Error && err.name === 'AbortError')) {
                    throw err;
                  }
                }
              })
            );
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
