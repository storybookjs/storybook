import { describe, expectTypeOf, it } from 'vitest';

import type { RuntimeService } from './types.ts';
import { getService } from './preview.ts';

describe('typed core getService (preview)', () => {
  it('types known core service ids without an explicit generic', () => {
    expectTypeOf(getService('core/docgen').queries.getDocgen.get).parameter(0).toEqualTypeOf<{
      id: string;
    }>();
    expectTypeOf(getService('core/story-docs').queries.getStoryDocs.get)
      .parameter(0)
      .toEqualTypeOf<{
        id: string;
      }>();
  });

  it('falls back to RuntimeService for unknown ids', () => {
    expectTypeOf(getService('addon-docs/mdx')).toEqualTypeOf<RuntimeService>();
  });

  it('honors an explicit generic over a known core id', () => {
    expectTypeOf(getService<RuntimeService>('core/docgen')).toEqualTypeOf<RuntimeService>();
  });
});
