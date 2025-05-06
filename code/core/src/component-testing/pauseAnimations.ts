export function isTestEnvironment() {
  try {
    return (
      // @ts-expect-error this property exists in certain environments
      !!globalThis.__vitest_browser__ ||
      // @ts-expect-error this property exists in certain environments
      !!globalThis.__playwright__binding__ ||
      // @ts-expect-error this property exists in certain environments
      !!import.meta.vitest ||
      // @ts-expect-error this property exists in certain environments
      import.meta.env.MODE === 'test'
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return false;
  }
}

// Pause all animations and transitions by overriding the CSS properties
export function pauseAnimations(atEnd = true) {
  if (!('document' in globalThis && 'createElement' in globalThis.document)) {
    // Don't run in React Native
    return;
  }

  const pauseStyle = document.createElement('style');
  pauseStyle.textContent = `*, *:before, *:after {
    animation-delay: 0s !important;
    animation-direction: ${atEnd ? 'reverse' : 'normal'} !important;
    animation-play-state: paused !important;
    transition: none !important;
  }`;
  document.head.appendChild(pauseStyle);
}
