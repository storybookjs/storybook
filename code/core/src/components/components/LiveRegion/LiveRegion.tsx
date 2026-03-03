/**
 * Imperative live-announcer API re-exported from `@react-aria/live-announcer`.
 *
 * Use `announce` to push a message into a global visually-hidden `aria-live` region so that screen
 * readers can announce dynamic status changes (test results, loading states, errors, etc.).
 *
 * ```ts
 * import { announce } from 'storybook/internal/components';
 * announce('3 tests passed', 'polite');
 * ```
 */
export { announce, clearAnnouncer, destroyAnnouncer } from '@react-aria/live-announcer';

export type Politeness = 'polite' | 'assertive';
