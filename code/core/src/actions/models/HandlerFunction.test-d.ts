import { expectTypeOf } from 'expect-type';
import type { HandlerFunction } from './HandlerFunction';

// Should be assignable to async callback props (the fixed case)
expectTypeOf<HandlerFunction>().toMatchTypeOf<() => Promise<void>>();

// Should remain assignable to plain void callbacks
expectTypeOf<HandlerFunction>().toMatchTypeOf<() => void>();
