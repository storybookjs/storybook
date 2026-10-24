import type { ComponentProps } from 'svelte';

import { expect, fn, userEvent, within } from 'storybook/test';

import { __definePreview } from '../../preview.ts';
import AddWrapperDecorator from './AddWrapperDecorator.svelte';
import Button from './Button.svelte';
import CustomRenderComponent from './CustomRenderComponent.svelte';
import InputFilledStoryComponent from './InputFilledStoryComponent.svelte';
import LoaderStoryComponent from './LoaderStoryComponent.svelte';

const preview = __definePreview({ addons: [] });

const meta = preview.meta({
  title: 'Example/Button',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
    size: { control: { type: 'select' }, options: ['small', 'medium', 'large'] },
  },
});

export const CSF3Primary = meta.story({
  args: { label: 'foo', size: 'large', primary: true },
});

export const CSF3Button = meta.story({ args: { label: 'foo' } });

export const WithDecorator = meta.story({
  args: { label: 'foo' },
  decorators: [() => ({ Component: AddWrapperDecorator })],
});

export const CSF3ButtonWithRender = meta
  .type<{ args: ComponentProps<typeof CustomRenderComponent> }>()
  .story({
    args: { buttonProps: { label: 'foo' } },
    render: (args) => ({ Component: CustomRenderComponent, props: args }),
  });

export const CSF3InputFieldFilled = meta.story({
  render: () => ({ Component: InputFilledStoryComponent }),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Step label', async () => {
      const inputEl = canvas.getByTestId('input');
      await userEvent.type(inputEl, 'Hello world!');
      await expect(inputEl).toHaveValue('Hello world!');
    });
  },
});

const mockFn = fn();
export const LoaderStory = meta.type<{ args: { mockFn: (arg: string) => string } }>().story({
  args: { mockFn },
  loaders: [
    async () => {
      mockFn.mockReturnValueOnce('mockFn return value');
      return { value: 'loaded data' };
    },
  ],
  render: (args, { loaded }) => ({
    Component: LoaderStoryComponent,
    props: { ...args, loaded: loaded as { value: string } },
  }),
  play: async () => {
    expect(mockFn).toHaveBeenCalledWith('render');
  },
});

export const Extended = CSF3Primary.extend({ args: { label: 'extended' } });
