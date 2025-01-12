import { VERSION as SVELTE_VERSION } from 'svelte/compiler';

export const IS_SVELTE_V4 = Number(SVELTE_VERSION[0]) <= 4;
