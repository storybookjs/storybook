// Fixture read from disk by the docgen tests. Excluded from the package tsconfig program, since it
// imports a `.vue` SFC that plain `tsc` cannot resolve.
import Button from './Button.vue';

/**
 * A button.
 *
 * @summary Clickable
 */
export default {
  title: 'Example/Button',
  component: Button,
};

export const Default = { args: { label: 'Hello' } };
