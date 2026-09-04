import { describe, expect, it, vi } from 'vitest';

import { deprecate } from 'storybook/internal/node-logger';

// The global vitest setup replaces node-logger's `logger` with mocks, but `deprecate` closes over
// the original module logger — grab it through importActual so the spy observes the real emission.
const { logger } = await vi.importActual<typeof import('storybook/internal/node-logger')>(
  'storybook/internal/node-logger'
);

// The global vitest setup mocks `resolvePackageDir`, which breaks the module-scope next version
// check in the preset's config module — stub just that check, keep the rest of the module real.
vi.mock('./utils.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils.ts')>()),
  isNextVersionGte: vi.fn(() => true),
}));

const NEXTJS_DEPRECATION =
  '@storybook/nextjs is deprecated and will be removed in Storybook 12. Migrate to @storybook/nextjs-vite — the automigration is available via `storybook upgrade` (accept the fix) or `storybook migrate nextjs-to-nextjs-vite`.';

describe('@storybook/nextjs deprecation notice', () => {
  it('warns exactly once on framework load, not once per import', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    // Loading the framework evaluates the preset entry, which emits the notice.
    await import('./preset.ts');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenNthCalledWith(1, NEXTJS_DEPRECATION);

    // A second import of the preset in the same process must not warn again.
    await import('./preset.ts');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Even if the module were re-evaluated, the logger dedupes on the message itself.
    deprecate(NEXTJS_DEPRECATION);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
