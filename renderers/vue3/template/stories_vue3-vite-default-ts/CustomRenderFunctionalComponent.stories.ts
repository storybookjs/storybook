import type { Meta } from '@storybook/vue3';

import { h } from 'vue';

import * as ReactiveDecorators from './ReactiveDecorators.stories';
import Reactivity from './Reactivity.vue';

const meta = {
  ...ReactiveDecorators.default,
  component: Reactivity,
  // storybook render function is not a functional component. it returns a functional component or a component options
  render: (args) => {
    // create the slot contents as a functional components
    const header = ({ title }: { title: string }) => h('h3', `${args.header} - Title: ${title}`);
    const defaultSlot = () => h('p', `${args.default}`);
    const footer = () => h('p', `${args.footer}`);
    // vue render function is a functional components
    return () =>
      h('div', [
        `Custom render uses a functional component, and passes slots to the component:`,
        h(Reactivity, args, { header, default: defaultSlot, footer }),
      ]);
  },
  tags: ['!vitest'],
} satisfies Meta<typeof Reactivity>;

export default meta;

export {
  NoDecorators,
  DecoratorFunctionalComponent,
  DecoratorFunctionalComponentArgsFromContext,
  DecoratorComponentOptions,
  DecoratorComponentOptionsArgsFromData,
} from './ReactiveDecorators.stories';
