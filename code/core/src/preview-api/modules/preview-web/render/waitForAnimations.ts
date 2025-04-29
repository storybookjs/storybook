const ANIMATION_TIMEOUT = 5000;

function getShadowRoots(doc: Document | ShadowRoot) {
  return [doc, ...doc.querySelectorAll('*')].reduce<ShadowRoot[]>((acc, el) => {
    if ('shadowRoot' in el && el.shadowRoot) {
      acc.push(el.shadowRoot, ...getShadowRoots(el.shadowRoot));
    }
    return acc;
  }, []);
}

// Use the Web Animations API to wait for any animations and transitions to finish
export async function waitForAnimations(signal: AbortSignal) {
  let timedOut = false;
  await Promise.race([
    // After 50ms, retrieve any running animations and wait for them to finish
    // If new animations are created while waiting, we'll wait for them too
    new Promise((resolve) => {
      setTimeout(() => {
        const animationRoots = [globalThis.document, ...getShadowRoots(globalThis.document)];
        const checkAnimationsFinished = async () => {
          if (timedOut || signal.aborted) {
            return;
          }
          const runningAnimations = animationRoots
            .flatMap((el) => el?.getAnimations() || [])
            .filter((a) => a.playState === 'running');
          if (runningAnimations.length > 0) {
            await Promise.all(runningAnimations.map((a) => a.finished));
            await checkAnimationsFinished();
          }
        };
        checkAnimationsFinished().then(resolve);
      }, 50);
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
