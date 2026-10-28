import type { HandlerFunction } from './HandlerFunction.ts';

export type ActionsMap<T extends string = string> = Record<T, HandlerFunction>;
