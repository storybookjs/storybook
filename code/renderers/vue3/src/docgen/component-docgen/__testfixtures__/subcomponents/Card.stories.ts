// Fixture read from disk by the docgen tests. Excluded from the package tsconfig program, since it
// imports `.vue` SFCs that plain `tsc` cannot resolve.
import Card from './Card.vue';
import CardHeader from './CardHeader.vue';

/**
 * A card.
 */
export default {
  title: 'Example/Card',
  component: Card,
  subcomponents: { Header: CardHeader },
};

export const Default = { args: { content: 'Hello' } };
