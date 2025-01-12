import GlobalUsage from './GlobalUsage.vue';

export default {
  component: GlobalUsage,
  argTypes: {},
  render: (args: any) => ({
    // Components used in your story `template` are defined in the `components` object
    components: { GlobalUsage },
    // The story's `args` need to be mapped into the template through the `setup()` method
    setup() {
      return { args };
    },
    // And then the `args` are bound to your component with `v-bind="args"`
    template: '<global-usage v-bind="args" />',
  }),
};

export const Primary = {
  args: {
    primary: true,
    label: 'Globally Defined',
  },
};

export const Secondary = {
  args: {
    label: 'Globally Defined',
  },
};
