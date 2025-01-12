import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

import { Button } from '../Button/Button';
import { Modal } from './Modal';

type Story = StoryObj<typeof meta>;

const meta = {
  component: Modal,
  decorators: [
    (storyFn) => (
      <div
        style={{
          width: '100%',
          minWidth: '1200px',
          height: '800px',
          background:
            'repeating-linear-gradient(45deg, #000000, #ffffff 50px, #ffffff 50px, #ffffff 80px)',
        }}
      >
        {storyFn()}
      </div>
    ),
  ],
} satisfies Meta<typeof Modal>;

export default meta;

export const Default: Story = {
  args: {
    children: undefined,
    width: undefined,
    height: undefined,
  },
  render: (props) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...props} open={isOpen}>
          <div style={{ padding: 15 }}>
            <div>Hello world!</div>
            <Modal.Dialog.Close onClick={() => setOpen(false)}>Close</Modal.Dialog.Close>
          </div>
        </Modal>
        <button onClick={() => setOpen(true)}>Open modal</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByText('Open modal');
    await userEvent.click(button);
    await expect(canvas.findByText('Hello world!')).resolves.toBeInTheDocument();
  },
};

export const FixedWidth: Story = {
  args: {
    ...Default.args,
    width: 1024,
  },
  render: (props) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...props} open={isOpen}>
          <div style={{ padding: 15 }}>
            <div>Hello world!</div>
            <Modal.Dialog.Close onClick={() => setOpen(false)}>Close</Modal.Dialog.Close>
          </div>
        </Modal>
        <button onClick={() => setOpen(true)}>Open modal</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByText('Open modal');
    await userEvent.click(button);
    await expect(canvas.findByText('Hello world!')).resolves.toBeInTheDocument();
  },
};

export const FixedHeight: Story = {
  args: {
    ...Default.args,
    height: 430,
  },
  render: (props) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...props} open={isOpen}>
          <div style={{ padding: 15 }}>
            <div>Hello world!</div>
            <Modal.Dialog.Close onClick={() => setOpen(false)}>Close</Modal.Dialog.Close>
          </div>
        </Modal>
        <button onClick={() => setOpen(true)}>Open modal</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByText('Open modal');
    await userEvent.click(button);
    await expect(canvas.findByText('Hello world!')).resolves.toBeInTheDocument();
  },
};

export const FixedWidthAndHeight: Story = {
  args: {
    ...Default.args,
    width: 1024,
    height: 430,
  },
  render: (props) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...props} open={isOpen}>
          <div style={{ padding: 15 }}>
            <div>Hello world!</div>
            <Modal.Dialog.Close onClick={() => setOpen(false)}>Close</Modal.Dialog.Close>
          </div>
        </Modal>
        <button onClick={() => setOpen(true)}>Open modal</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByText('Open modal');
    await userEvent.click(button);
    await expect(canvas.findByText('Hello world!')).resolves.toBeInTheDocument();
  },
};

export const StyledComponents: Story = {
  args: {
    ...Default.args,
    width: 500,
  },
  render: (props) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...props} open={isOpen}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Hello</Modal.Title>
              <Modal.Description>Lorem ipsum dolor sit amet.</Modal.Description>
            </Modal.Header>
            <Modal.Row>
              <Modal.Col>
                <span>One</span>
                <span>Two</span>
              </Modal.Col>
              <Modal.Col>Right</Modal.Col>
            </Modal.Row>
            <Modal.Col>Another section</Modal.Col>
            <Modal.Actions>
              <Button variant="solid">Save</Button>
              <Modal.Dialog.Close asChild>
                <Button>Cancel</Button>
              </Modal.Dialog.Close>
            </Modal.Actions>
          </Modal.Content>
          <Modal.Error>Oops. Something went wrong.</Modal.Error>
        </Modal>
        <button onClick={() => setOpen(true)}>Open modal</button>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getAllByText('Open modal')[0];
    await userEvent.click(button);
    await expect(canvas.findByText('Hello')).resolves.toBeInTheDocument();
  },
};
