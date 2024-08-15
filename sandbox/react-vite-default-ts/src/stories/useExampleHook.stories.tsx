import type { Meta, StoryObj } from '@storybook/react';
import useExampleHook from './useExampleHook';

const meta: Meta<typeof useExampleHook> = {
    title: 'Example/useExampleHook',
    component: useExampleHook,
    tags: ['autodocs'],
    parameters: {
        // Layout configuration for the story
        layout: 'centered',
    },
} satisfies Meta<typeof useExampleHook>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default example story for `useExampleHook`.
 *
 * This story demonstrates the usage of the `useExampleHook` by
 * displaying the returned message from the hook.
 */
export const Default: Story = {
    render: () => {
        const result = useExampleHook();
        return <div>{result}</div>;
    },
};
