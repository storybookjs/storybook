import { fn } from 'storybook/test';

/**
 * Spy called whenever navigation is attempted (Link click, useNavigate, etc.).
 * Navigation is blocked — the story stays on screen — but the spy records
 * `{ to, from }` so play functions can assert on it.
 */
export const onNavigate = fn().mockName('navigate');
