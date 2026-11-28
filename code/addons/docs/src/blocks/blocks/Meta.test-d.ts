import { expectTypeOf, it } from 'vitest';

import type { ComponentProps } from 'react';

import { Meta } from './Meta.tsx';

it('accepts the explicit docs id that the MDX indexer reads from <Meta>', () => {
  expectTypeOf<ComponentProps<typeof Meta>['id']>().toEqualTypeOf<string | undefined>();
});
