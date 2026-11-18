import Other from './Other.svelte';
import Select from './Select.svelte';

const overrides = { Select: Other };

export const Input = { Select, ...overrides };
