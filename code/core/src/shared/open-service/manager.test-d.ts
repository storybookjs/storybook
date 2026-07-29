import { describe, expectTypeOf, it } from 'vitest';

import type { RuntimeService } from './types.ts';
import { getService } from './manager.ts';

describe('typed core getService (manager)', () => {
  it('types known core service ids without an explicit generic', () => {
    expectTypeOf(getService('core/docgen').queries.docgen.get).parameter(0).toEqualTypeOf<{
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
