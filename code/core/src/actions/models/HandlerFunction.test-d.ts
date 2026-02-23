import { expectTypeOf } from 'vitest';
import type { HandlerFunction } from './HandlerFunction';

// Should be assignable to async callback props (the fixed case)
expectTypeOf<HandlerFunction>().toExtend<() => Promise<void>>();

// Should remain assignable to plain void callbacks
expectTypeOf<HandlerFunction>().toExtend<() => void>();
