import { describe, expect, it, vi } from 'vitest';

vi.mock('@joshwooding/vite-plugin-react-docgen-typescript', () => ({
  default: () => ({ name: 'vite:react-docgen-typescript' }),
}));

import { viteFinal } from './preset.ts';

describe('viteFinal', () => {
  it('runs react-docgen-typescript before Vite strips TypeScript syntax', async () => {
    const apply = vi.fn(async (name: string) => {
      if (name === 'features') {
        return {};
      }

      if (name === 'typescript') {
        return { reactDocgen: 'react-docgen-typescript' };
      }

      return {};
    });

    const config = await viteFinal({ plugins: [] }, { presets: { apply } } as any);
    const plugin = (config.plugins as any[]).find(
      (entry) => entry?.name === 'vite:react-docgen-typescript'
    );

    expect(plugin).toMatchObject({ enforce: 'pre' });
  });
});
