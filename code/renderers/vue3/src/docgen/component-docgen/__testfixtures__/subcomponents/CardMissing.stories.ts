// A declared subcomponent that is never imported: the primary component still documents, while the
// child's entry carries the resolution error.
import Card from './Card.vue';

export default {
  title: 'Example/CardMissing',
  component: Card,
  subcomponents: { Missing: NotImported },
};

export const Default = { args: { content: 'Hello' } };
