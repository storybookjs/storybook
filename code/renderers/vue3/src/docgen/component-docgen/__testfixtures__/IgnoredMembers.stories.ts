// Fixture read from disk by the docgen tests. Excluded from the package tsconfig program, since it
// imports a `.vue` SFC that plain `tsc` cannot resolve.
import IgnoredMembers from './IgnoredMembers.vue';

export default {
  title: 'Example/IgnoredMembers',
  component: IgnoredMembers,
};

export const Default = { args: { label: 'Hello' } };
