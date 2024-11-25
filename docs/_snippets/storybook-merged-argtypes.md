```js renderer="common" language="js"
const argTypes = {
  label: {
    name: 'label',
    type: { name: 'string', required: false },
    defaultValue: 'Hello',
    description: 'overwritten description',
    table: {
      type: {
        summary: 'something short',
        detail: 'something really really long',
      },
      defaultValue: { summary: 'Hello' },
    },
    control: {
      type: null,
    },
  },
};
```
