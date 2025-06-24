import React from 'react';

import type { Foo } from './types';

interface FooProps {
  bar: Foo['bar'];
}

export const FooComponent = (foo: FooProps) => <>{JSON.stringify(foo)}</>;

export const component = FooComponent;
