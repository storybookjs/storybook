import Button from './Button.vue';

type LooseComponent = unknown;

export default {
  title: 'Example/CastComponent',
  component: Button as unknown as LooseComponent,
};

export const Default = { args: { label: 'Hello' } };
