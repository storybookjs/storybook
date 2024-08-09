import type { Meta } from '@storybook/vue3';

import { defineComponent, shallowReactive } from 'vue';

import * as ReactiveDecorators from './ReactiveDecorators.stories';
import Reactivity from './Reactivity.vue';

// when you use custom render, you can use any vue api to create your story and garanti reactivity, otherwise i can ease kill the reactivity.
const state = shallowReactive<{ header: any; default: any; footer: any }>({
  header: '',
  default: '',
  footer: '',
}); // or reactive

const meta = {
  ...ReactiveDecorators.default,
  component: Reactivity,
  render: (args, { argTypes }) => {
    state.header = args.header;
    state.default = args.default;
    state.footer = args.footer;
    // return a component options
    return defineComponent({
      data: () => ({ args, header: state.header, default: state.default, footer: state.footer }),
      components: {
        Reactivity,
      },
      template: `<div>Custom render uses options api and binds args to data: 
                    <Reactivity v-bind="args">
                      <template #header="{title}"><h3>{{ args.header }} - Title: {{ title }}</h3></template>
                      <template #default>{{ args.default }}</template>
                      <template #footer>{{ args.footer }} </template>
                    </Reactivity>
                  </div>`,
    });
  },
} satisfies Meta<typeof Reactivity>;

export default meta;

export {
  NoDecorators,
  DecoratorFunctionalComponent,
  DecoratorFunctionalComponentArgsFromContext,
  DecoratorComponentOptions,
  DecoratorComponentOptionsArgsFromData,
} from './ReactiveDecorators.stories';
