import type { CleanupCallback } from 'storybook/internal/csf';

const ANIMATION_TIMEOUT = 5000;

export function isTestEnvironment() {
  try {
    return (
      // @ts-expect-error this property exists in certain environments
      !!globalThis.__vitest_browser__ ||
      // @ts-expect-error this property exists in certain environments
      !!globalThis.__playwright__binding__
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return false;
  }
}

// Pause all DocumentTimeline animations and transitions by overriding the CSS properties
export function pauseAnimations(atEnd = true): CleanupCallback {
  if (
    !(
      'document' in globalThis &&
      'createElement' in globalThis.document &&
      'getAnimations' in globalThis.document
    )
  ) {
    // Don't run in React Native
    return () => {};
  }

  // Get all DocumentTimeline animations, we skip View- and ScrollTimeline animations
  // https://github.com/storybookjs/storybook/issues/31877
  const animations = document
    .getAnimations()
    .filter((anim) => anim.timeline instanceof DocumentTimeline);

  // Remember current states for cleanup
  const previousStates = animations.map((anim) => ({
    animation: anim,
    playState: anim.playState,
    currentTime: anim.currentTime,
  }));

  for (const animation of animations) {
    // Seek to end before pausing
    if (atEnd) {
      animation.currentTime =
        animation.effect?.getComputedTiming().endTime ?? animation.currentTime;
    }
    animation.pause();
  }

  // Disable transitions
  const transitionStyle = document.createElement('style');
  transitionStyle.textContent = `*, *::before, *::after {
    transition: none !important;
  }`;
  document.head.appendChild(transitionStyle);

  // Return cleanup function to restore paused animations
  return () => {
    for (const { animation, playState, currentTime } of previousStates) {
      animation.currentTime = currentTime;
      if (playState === 'running') {
        animation.play();
      }
    }
    document.head.removeChild(transitionStyle);
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
            await Promise.all(runningAnimations.map((a) => a.finished));
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
