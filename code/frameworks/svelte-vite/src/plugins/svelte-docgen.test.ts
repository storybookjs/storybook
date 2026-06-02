import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./generateDocgen.ts', { spy: true });

import { createDocgenCache, generateDocgen } from './generateDocgen.ts';
import { svelteDocgen } from './svelte-docgen.ts';

describe('svelteDocgen', () => {
  beforeEach(() => {
    vi.mocked(createDocgenCache).mockReturnValue({
      filenameToModifiedTime: {},
      filenameToSourceFile: {},
      fileCache: {},
    });
    vi.mocked(generateDocgen).mockReturnValue({ props: [] });
  });

  it('skips Svelte CSF story files', async () => {
    const plugin = (await svelteDocgen()) as {
      transform: {
        handler: (src: string, id: string) => Promise<unknown>;
      };
    };

    const result = await plugin.transform.handler(
      'export default function Story() {}',
      '/src/Button.stories.svelte'
    );

    expect(result).toBeUndefined();
    expect(vi.mocked(generateDocgen)).not.toHaveBeenCalled();
  });
});
