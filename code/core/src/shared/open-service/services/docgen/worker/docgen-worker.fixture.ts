import type { DocgenMiddleware } from '../types.ts';

// A provider that takes a macrotask per call, and logs when each call starts and ends.
export const createDocgenProvider =
  ({ log }: { log: string[] }): DocgenMiddleware =>
  (nextDocgen) =>
  async (inputs) => {
    const ids = inputs.map(({ entry }) => entry.id).join(',');
    log.push(`start ${ids}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    log.push(`end ${ids}`);
    return nextDocgen(inputs);
  };
