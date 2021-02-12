import React from "react";
import { Button } from "./Button";

export default {
  title: "Example/Button",
  component: Button,
  parameters: {
    myAddonParameter: `
<MyComponent boolProp scalarProp={1} complexProp={{ foo: 1, bar: '2' }}>
  <SomeOtherComponent funcProp={(a) => a.id} />
</MyComponent>
`,
  },
};

const Template = (args) => <Button {...args}>Label</Button>;

export const All = () => <Button>Normal</Button>;

export const Default = Template.bind({});

export const Hover = Template.bind({});
Hover.args = { pseudo: { hover: true } };

export const Focus = Template.bind({});
Focus.args = { pseudo: { focus: true } };

export const Active = Template.bind({});
Active.args = { pseudo: { active: true } };
