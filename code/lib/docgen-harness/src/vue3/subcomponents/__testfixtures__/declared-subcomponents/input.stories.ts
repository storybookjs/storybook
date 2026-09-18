import Card from './Card.vue';
import CardHeader from './CardHeader.vue';

export default {
  title: 'Example/Card',
  component: Card,
  subcomponents: { Header: CardHeader },
};

export const Default = {
  args: { content: 'Card body copy' },
};
