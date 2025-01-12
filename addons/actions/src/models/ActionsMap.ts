import type { HandlerFunction } from './HandlerFunction';

export type ActionsMap<T extends string = string> = Record<T, HandlerFunction>;
