import { global as globalThis } from '@storybook/global';

import { action } from '@storybook/addon-actions';

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Basic = {
  args: { onClick: action('onClick') },
};

export const TypeString = {
  args: { onClick: () => action('onClick')('string') },
};
export const TypeBoolean = {
  args: { onClick: () => action('onClick')(false) },
};
export const TypeObject = {
  args: { onClick: () => action('onClick')({}) },
};
export const TypeNull = {
  args: { onClick: () => action('onClick')(null) },
};
export const TypeUndefined = {
  args: { onClick: () => action('onClick')(undefined) },
};
export const TypeNaN = {
  args: { onClick: () => action('onClick')(NaN) },
};
export const TypeInfinity = {
  args: { onClick: () => action('onClick')(Infinity) },
};
export const TypeMinusInfinity = {
  args: { onClick: () => action('onClick')(-Infinity) },
};
export const TypeNumber = {
  args: { onClick: () => action('onClick')(10000) },
};
export const TypeGlobal = {
  args: { onClick: () => action('onClick')(globalThis) },
};
export const TypeSymbol = {
  args: { onClick: () => action('onClick')(Symbol('MySymbol')) },
};
export const TypeRegExp = {
  args: { onClick: () => action('onClick')(new RegExp('MyRegExp')) },
};
export const TypeArray = {
  args: { onClick: () => action('onClick')(['a', 'b', 'c']) },
};
export const TypeClass = {
  args: { onClick: () => action('onClick')(class MyClass {}) },
};
export const TypeFunction = {
  args: { onClick: () => action('onClick')(function MyFunction() {}) },
};
export const TypeMultiple = {
  args: { onClick: () => action('onClick')('string', true, false, null, undefined, [], {}) },
};

export const Cyclical = {
  args: {
    onClick: () =>
      action('onClick')(
        (() => {
          const cyclical: Record<string, any> = {};
          cyclical.cyclical = cyclical;
          return cyclical;
        })()
      ),
  },
};

export const Reserved = {
  args: { onClick: action('delete') },
};

export const OptionPersist = {
  args: { onClick: action('onClick', { clearOnStoryChange: false }) },
};
export const OptionDepth = {
  args: { onClick: action('onClick', { depth: 2 }) },
};

export const Disabled = {
  args: { onClick: action('onCLick') },
  parameters: {
    actions: {
      disabled: true,
    },
  },
};
