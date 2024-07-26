import React from 'react';
import { Meta, Story } from '@storybook/react';
import ReactHookWrapper from './ReactHookWrapper';

const meta: Meta<typeof ReactHookWrapper> = {
    title: 'Hooks/useReactHook',
    component: ReactHookWrapper,
};

export default meta;

const Template: Story = () => <ReactHookWrapper />;

export const Default = Template.bind({});
