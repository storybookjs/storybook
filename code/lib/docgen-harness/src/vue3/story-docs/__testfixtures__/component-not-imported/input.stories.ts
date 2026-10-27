import { defineComponent, h } from 'vue';

// Declared in the story file on purpose: no import statement exists for the snippet to
// reconstruct, so the story has to explain the missing snippet instead of blaming a slot.
const LocalCard = defineComponent({
  props: { label: String },
  setup: (props) => () => h('div', props.label),
});

const meta = {
  component: LocalCard,
  title: 'Forms/component-not-imported',
};

export default meta;

export const Primary = {
  args: { label: 'Hi' },
};
