import { expectTypeOf, test } from 'vitest';

import type { HandlerFunction } from './HandlerFunction.ts';

test('is assignable to async callbacks', () => {
  expectTypeOf<HandlerFunction>().toExtend<() => Promise<void>>();
});

test('is assignable to void callbacks', () => {
  expectTypeOf<HandlerFunction>().toExtend<() => void>();
});
