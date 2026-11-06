export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;
export type WithRef<T> = T & { ref?: HTMLElement | null };
