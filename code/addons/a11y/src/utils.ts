export function getIsVitestStandaloneRun() {
  try {
    // @ts-expect-error Suppress TypeScript warning about wrong setting. Doesn't matter, because we don't use tsc for bundling.
    return import.meta.env.VITEST_STORYBOOK === 'false';
  } catch (e) {
    return false;
  }
}

export function getIsVitestRunning() {
  try {
    // @ts-expect-error Suppress TypeScript warning about wrong setting. Doesn't matter, because we don't use tsc for bundling.
    return import.meta.env.MODE === 'test';
  } catch (e) {
    return false;
  }
}
