import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { expect, fn, mocked, userEvent, within } from '@storybook/test';

import { action } from '@storybook/addon-actions';

import { definePreview } from '../preview';
import { Button } from './Button';

const preview = definePreview({});

const meta = preview.meta({
  id: 'button-component',
  title: 'Example/CSF4/Button',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  args: {
    children: 'Children coming from meta args',
  },
});

export const CSF2Secondary = meta.story({
  render: (args) => {
    return <Button {...args} />;
  },
  args: {
    children: 'Children coming from story args!',
    primary: false,
  },
});

const getCaptionForLocale = (locale: string) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour!';
    case 'kr':
      return '안녕하세요!';
    case 'pt':
      return 'Olá!';
    case 'en':
      return 'Hello!';
    default:
      return undefined;
  }
};

export const CSF2StoryWithLocale = meta.story({
  render: (args, { globals: { locale } }) => {
    const caption = getCaptionForLocale(locale);
    return (
      <>
        <p>locale: {locale}</p>
        <Button>{caption}</Button>
      </>
    );
  },
  name: 'WithLocale',
});

export const CSF2StoryWithParamsAndDecorator = meta.story({
  render: (args) => {
    return <Button {...args} />;
  },
  args: {
    children: 'foo',
  },
  parameters: {
    layout: 'centered',
  },
  decorators: (StoryFn) => <StoryFn />,
});

export const CSF3Primary = meta.story({
  args: {
    children: 'foo',
    size: 'large',
    primary: true,
  },
});

export const CSF3Button = meta.story({
  args: { children: 'foo' },
});

export const CSF3ButtonWithRender = meta.story({
  ...CSF3Button.input,
  render: (args) => (
    <div>
      <p data-testid="custom-render">I am a custom render function</p>
      <Button {...args} />
    </div>
  ),
});

export const HooksStory = meta.story({
  render: function Component() {
    const [isClicked, setClicked] = useState(false);
    return (
      <>
        <input data-testid="input" />
        <br />
        <button onClick={() => setClicked(!isClicked)}>
          I am {isClicked ? 'clicked' : 'not clicked'}
        </button>
      </>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Step label', async () => {
      const inputEl = canvas.getByTestId('input');
      const buttonEl = canvas.getByRole('button');
      await userEvent.click(buttonEl);
      await userEvent.type(inputEl, 'Hello world!');

      await expect(inputEl).toHaveValue('Hello world!');
      await expect(buttonEl).toHaveTextContent('I am clicked');
    });
  },
});

export const CSF3InputFieldFilled = meta.story({
  render: () => {
    return <input data-testid="input" />;
  },
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
export const LoaderStory = meta.story({
  args: {
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    mockFn,
  },
  loaders: [
    async () => {
      mockFn.mockReturnValueOnce('mockFn return value');
      return {
        value: 'loaded data',
      };
    },
  ],
  render: (args: any & { mockFn: (val: string) => string }, { loaded }) => {
    const data = args.mockFn('render');
    return (
      <div>
        <div data-testid="loaded-data">{loaded.value}</div>
        <div data-testid="spy-data">{String(data)}</div>
      </div>
    );
  },
  play: async () => {
    expect(mockFn).toHaveBeenCalledWith('render');
  },
});

export const MountInPlayFunction = meta.story({
  args: {
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    mockFn: fn(),
  },
  play: async ({ args, mount, context }) => {
    // equivalent of loaders
    const loadedData = await Promise.resolve('loaded data');
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    mocked(args.mockFn).mockReturnValueOnce('mockFn return value');
    // equivalent of render
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    const data = args.mockFn('render');
    // TODO refactor this in the mount args PR
    context.originalStoryFn = () => (
      <div>
        <div data-testid="loaded-data">{loadedData}</div>
        <div data-testid="spy-data">{String(data)}</div>
      </div>
    );
    await mount();

    // equivalent of play
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    expect(args.mockFn).toHaveBeenCalledWith('render');
  },
});

export const MountInPlayFunctionThrow = meta.story({
  play: async () => {
    throw new Error('Error thrown in play');
  },
});

export const WithActionArg = meta.story({
  args: {
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    someActionArg: action('some-action-arg'),
  },
  render: (args) => {
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    args.someActionArg('in render');
    return (
      <button
        onClick={() => {
          // @ts-expect-error TODO: add a way to provide custom args/argTypes
          args.someActionArg('on click');
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttonEl = await canvas.getByRole('button');
    await buttonEl.click();
  },
});

export const WithActionArgType = meta.story({
  argTypes: {
    // @ts-expect-error TODO: add a way to provide custom args/argTypes
    someActionArg: {
      action: true,
    },
  },
  render: () => {
    return <div>nothing</div>;
  },
});

export const Modal = meta.story({
  render: function Component() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContainer] = useState(() => {
      const div = document.createElement('div');
      div.id = 'modal-root';
      return div;
    });

    useEffect(() => {
      document.body.appendChild(modalContainer);
      return () => {
        document.body.removeChild(modalContainer);
      };
    }, [modalContainer]);

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const modalContent = isModalOpen
      ? createPortal(
          <div
            role="dialog"
            style={{
              position: 'fixed',
              top: '20%',
              left: '50%',
              transform: 'translate(-50%, -20%)',
              backgroundColor: 'white',
              padding: '20px',
              zIndex: 1000,
              border: '2px solid black',
              borderRadius: '5px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <p>This is a modal!</p>
            </div>
            <button onClick={handleCloseModal}>Close</button>
          </div>,
          modalContainer
        )
      : null;

    return (
      <>
        <button id="openModalButton" onClick={handleOpenModal}>
          Open Modal
        </button>
        {modalContent}
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openModalButton = await canvas.getByRole('button', { name: /open modal/i });
    await userEvent.click(openModalButton);
    await expect(within(document.body).getByRole('dialog')).toBeInTheDocument();
  },
});
