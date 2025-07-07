# Enforce CSF3 format for stories (only-csf3)

[Component Story Format 3.0 (CSF3)](https://storybook.js.org/blog/component-story-format-3-0/) is the latest iteration of Storybook's story format, offering a simpler and more maintainable way to write stories. This rule enforces the use of CSF3 by identifying and reporting CSF2 patterns.

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: N/A

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule aims to prevent the use of CSF2 patterns in story files and encourage migration to CSF3.

Examples of **incorrect** code:

```js
// ❌ CSF2: Using Template.bind({})
const Template = (args) => <Button {...args} />;
export const Primary = Template.bind({});
Primary.args = { label: 'Primary' };

// ❌ CSF2: Story function declaration
export function Secondary(args) {
  return <Button {...args} />;
}

// ❌ CSF2: Story arrow function
export const Tertiary = () => <Button>Click me</Button>;

// ❌ CSF2: Story with property assignments
export const WithArgs = Template.bind({});
WithArgs.args = { label: 'With Args' };
WithArgs.parameters = { layout: 'centered' };

// ❌ CSF2: Template.bind({}) with multiple stories
const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = { label: 'Primary', variant: 'primary' };
Primary.parameters = { backgrounds: { default: 'light' } };

export const Secondary = Template.bind({});
Secondary.args = { label: 'Secondary', variant: 'secondary' };
Secondary.parameters = { backgrounds: { default: 'dark' } };
```

Examples of **correct** code:

```js
// ✅ CSF3: Object literal with args
export const Primary = {
  args: {
    label: 'Primary',
  },
};

// ✅ CSF3: Object literal with render function
export const Secondary = {
  render: (args) => <Button {...args}>Secondary</Button>,
};

// ✅ CSF3: Multiple stories sharing render logic
const render = (args) => <Button {...args} />;

export const Primary = {
  render,
  args: { label: 'Primary', variant: 'primary' },
  parameters: { backgrounds: { default: 'light' } },
};

export const Secondary = {
  render,
  args: { label: 'Secondary', variant: 'secondary' },
  parameters: { backgrounds: { default: 'dark' } },
};
```

## When Not To Use It

If you're maintaining a legacy Storybook project that extensively uses CSF2 patterns and cannot migrate to CSF3 yet, you might want to disable this rule.

## Migration Examples

Here are examples of how to migrate common CSF2 patterns to CSF3:

1. Template.bind({}) with args:

```js
// ❌ CSF2
const Template = (args) => <Button {...args} />;
export const Primary = Template.bind({});
Primary.args = { label: 'Primary' };

// ✅ CSF3
export const Primary = {
  render: (args) => <Button {...args} />,
  args: { label: 'Primary' },
};
```

2. Function declaration stories:

```js
// ❌ CSF2
export function Primary(args) {
  return <Button {...args}>Primary</Button>;
}

// ✅ CSF3
export const Primary = {
  render: (args) => <Button {...args}>Primary</Button>,
};
```

3. Story with multiple properties:

```js
// ❌ CSF2
export const Primary = Template.bind({});
Primary.args = { label: 'Primary' };
Primary.parameters = { layout: 'centered' };
Primary.decorators = [
  (Story) => (
    <div style={{ padding: '1rem' }}>
      <Story />
    </div>
  ),
];

// ✅ CSF3
export const Primary = {
  render: (args) => <Button {...args} />,
  args: { label: 'Primary' },
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};
```

## Further Reading

- [Component Story Format 3.0](https://storybook.js.org/blog/component-story-format-3-0/)
- [Migrating to CSF3](https://storybook.js.org/docs/migration-guide/from-older-version#csf-2-to-csf-3)
- [Upgrading from CSF 2.0 to 3.0](https://storybook.js.org/docs/api/csf/index#upgrading-from-csf-2-to-csf-3)
- [Writing Stories in Storybook](https://storybook.js.org/docs/writing-stories#component-story-format)
