import type { DocgenError } from 'storybook/internal/types';

import { describe, expect, it } from 'vitest';

import type { CemTag } from './manifest/cem-manager.ts';
import { type TagResolver, firstMatch } from './tag-resolver.ts';

const hit = (manifestPath: string): CemTag => ({
  declaration: { name: 'XCard', kind: 'class', customElement: true, tagName: 'x-card' },
  manifestPath,
});

const miss = (name: string): DocgenError => ({ name, message: `${name} for x-card` });

const resolver = (result: CemTag | DocgenError): TagResolver => ({ find: async () => result });

describe('firstMatch', () => {
  it.each([
    {
      name: 'the first hit wins',
      results: [hit('custom-elements.json'), hit('src/x-card.ts')],
      expected: hit('custom-elements.json'),
    },
    {
      name: 'a miss falls through to the next resolver',
      results: [miss('tag-not-found'), hit('src/x-card.ts')],
      expected: hit('src/x-card.ts'),
    },
    {
      name: 'when every resolver misses, the last error is reported',
      results: [miss('manifest-invalid'), miss('source-analysis-failed')],
      expected: miss('source-analysis-failed'),
    },
  ])('$name', async ({ results, expected }) => {
    const [first, ...rest] = results.map(resolver);

    await expect(
      firstMatch([first, ...rest]).find('x-card', { storyFilePath: '/workspace/input.stories.ts' })
    ).resolves.toEqual(expected);
  });
});
