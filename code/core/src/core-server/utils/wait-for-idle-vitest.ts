import { fullTestProviderStore } from '../stores/test-provider.ts';
/**
 * Wait for the test provider to be idle (no tests running).
 * Returns true if idle, false if timed out.
 * Use this if you intend to run a ad-hoc vitest process to
 * avoid conflicts with already running component tests.
 */
export async function waitForIdleVitest(
  maxWaitMs = 30 * 60 * 1000,
  pollIntervalMs = 60 * 1000
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const state = fullTestProviderStore.getFullState();
      const isRunning = Object.values(state).some((s) => s === 'test-provider-state:running');
      if (!isRunning) {
        return true;
      }
    } catch {
      // Store not initialized yet — treat as idle
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}
