import React, { forwardRef, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';

import { action } from 'storybook/actions';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { Modal } from './Modal';

const SampleModalContent = () => (
  <Modal.Content>
    <Modal.Header>
      <Modal.Title>Sample Modal</Modal.Title>
      <Modal.Description>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Modal.Description>
    </Modal.Header>
    <Modal.Col>
      <p>This is a sample modal with various content sections.</p>
      <p>You can interact with the elements below:</p>
      <Modal.Row>
        <button onClick={fn()}>Sample Button</button>
      </Modal.Row>
    </Modal.Col>
    <Modal.Actions>
      <Modal.Close asChild>
        <Button ariaLabel={false} variant="solid" onClick={() => action('save')()}>
          Save
        </Button>
      </Modal.Close>
      <Modal.Close asChild>
        <Button ariaLabel={false} variant="outline" onClick={() => action('cancel')()}>
          Cancel
        </Button>
      </Modal.Close>
    </Modal.Actions>
  </Modal.Content>
);

const MockContainer = forwardRef<
  HTMLDivElement,
  {
    bgColor: string;
    borderColor: string;
    id?: string;
    text: string;
  }
>(({ bgColor, borderColor, id, text }, ref) => (
  <div
    id={id}
    ref={ref}
    style={{
      position: 'relative',
      width: '60%',
      height: '300px',
      marginTop: '20px',
      border: `3px dashed ${borderColor}`,
      borderRadius: '8px',
      background: bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      style={{ textAlign: 'center', backgroundColor: '#fff6', color: '#111', fontWeight: 'bold' }}
    >
      {text}
    </div>
  </div>
));
MockContainer.displayName = 'MockContainer';

const meta = preview.meta({
  id: 'overlay-Modal',
  title: 'Overlay/Modal',
  component: Modal,
  args: {
    ariaLabel: 'Sample modal',
    dismissOnClickOutside: true,
    dismissOnEscape: true,
  },
  argTypes: {
    width: {
      control: { type: 'number', min: 200, max: 1200, step: 50 },
      description: 'Fixed width for the modal in pixels',
    },
    height: {
      control: { type: 'number', min: 200, max: 800, step: 50 },
      description: 'Fixed height for the modal in pixels',
    },
    ariaLabel: {
      control: 'text',
      description: 'The accessible name for the modal',
    },
    dismissOnClickOutside: {
      control: 'boolean',
      description: 'Whether the modal can be dismissed by clicking outside',
    },
    dismissOnEscape: {
      control: 'boolean',
      description: 'Whether the modal can be dismissed by pressing Escape',
    },
    open: {
      control: 'boolean',
      description: 'Controlled state for modal visibility',
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Default open state for uncontrolled usage',
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: 'Callback when modal open state changes',
    },
  },
  decorators: [
    (storyFn) => (
      <div
        style={{
          width: '100%',
          minWidth: 1200,
          height: 800,
          padding: 20,
          background:
            'repeating-linear-gradient(45deg, #505050ff, #bbbbbbff 50px, #bbbbbbff 50px, #bbbbbbff 80px)',
        }}
      >
        {storyFn()}
      </div>
    ),
  ],
});

export const Base = meta.story({
  args: {
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
      </>
    );
  },
});

export const FixedWidth = meta.story({
  args: {
    width: 300,
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (300px width)
        </Button>
      </>
    );
  },
});

export const FixedHeight = meta.story({
  args: {
    height: 300,
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (300px height)
        </Button>
      </>
    );
  },
});

export const FixedDimensions = meta.story({
  args: {
    width: 400,
    height: 400,
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (400x400px)
        </Button>
      </>
    );
  },
});

export const DismissalBehavior = meta.story({
  args: {
    children: <SampleModalContent />,
  },
  render: (args) => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <div>
        <h4>Default (dismissible)</h4>
        <ModalWithTrigger
          {...args}
          dismissOnClickOutside={true}
          dismissOnEscape={true}
          triggerText="Click outside or ESC to close"
        />
      </div>
      <div>
        <h4>No outside click dismissal</h4>
        <ModalWithTrigger
          {...args}
          dismissOnClickOutside={false}
          dismissOnEscape={true}
          triggerText="Only ESC to close"
        />
      </div>
      <div>
        <h4>No escape dismissal</h4>
        <ModalWithTrigger
          {...args}
          dismissOnClickOutside={true}
          dismissOnEscape={false}
          triggerText="Only outside click to close"
        />
      </div>
      <div>
        <h4>No dismissal</h4>
        <ModalWithTrigger
          {...args}
          dismissOnClickOutside={false}
          dismissOnEscape={false}
          triggerText="Use close button only"
        />
      </div>
    </div>
  ),
});

export const OnInteractOutside = meta.story({
  name: 'OnInteractOutside (deprecated)',
  args: {
    children: <SampleModalContent />,
    onInteractOutside: fn(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
        <Button ariaLabel={false} style={{ marginLeft: '1rem' }}>
          Outside Button
        </Button>
      </>
    );
  },
  play: async ({ args, canvas, step }) => {
    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });

    await step('Click outside to close', async () => {
      const outsideButton = canvas.getByText('Outside Button');
      await userEvent.click(outsideButton);
      expect(args.onInteractOutside).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).not.toBeInTheDocument();
      });
    });
  },
});

export const OnInteractOutsidePreventDefault = meta.story({
  name: 'OnInteractOutside - e.preventDefault (deprecated)',
  args: {
    children: <SampleModalContent />,
    onInteractOutside: (e) => e.preventDefault(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
        <Button ariaLabel={false} style={{ marginLeft: '1rem' }}>
          Outside Button
        </Button>
      </>
    );
  },
  play: async ({ canvas, step }) => {
    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });

    await step('Click outside to close but modal stays open', async () => {
      const outsideButton = canvas.getByText('Outside Button');
      await userEvent.click(outsideButton);
      // Wait a bit to ensure the modal close animation would've had time to play.
      await new Promise((r) => setTimeout(r, 300));
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });
  },
});

export const OnInteractOutsideDismissDisabled = meta.story({
  name: 'OnInteractOutside - dismiss disabled (deprecated)',
  args: {
    children: <SampleModalContent />,
    dismissOnClickOutside: false,
    onInteractOutside: fn(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
        <Button ariaLabel={false} style={{ marginLeft: '1rem' }}>
          Outside Button
        </Button>
      </>
    );
  },
  play: async ({ args, canvas, step }) => {
    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });

    await step('Click outside to close, nothing should happen', async () => {
      const outsideButton = canvas.getByText('Outside Button');
      await userEvent.click(outsideButton);
      expect(args.onInteractOutside).not.toHaveBeenCalled();
      // Wait a bit to ensure the modal close animation would've had time to play.
      await new Promise((r) => setTimeout(r, 300));
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });
  },
});

export const OnEscapeKeyDown = meta.story({
  name: 'OnEscapeKeyDown (deprecated)',
  args: {
    children: <SampleModalContent />,
    onEscapeKeyDown: fn(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
      </>
    );
  },
  play: async ({ args, canvas, step }) => {
    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });

    await step('Close modal with Escape key', async () => {
      await userEvent.keyboard('{Escape}');
      expect(args.onEscapeKeyDown).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).not.toBeInTheDocument();
      });
    });
  },
});

export const OnEscapeKeyDownPreventDefault = meta.story({
  name: 'OnEscapeKeyDown - e.preventDefault (deprecated)',
  args: {
    children: <SampleModalContent />,
    onEscapeKeyDown: (e) => e.preventDefault(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
      </>
    );
  },
  play: async ({ canvas, step }) => {
    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });

    await step('Click outside to close but modal stays open', async () => {
      await userEvent.keyboard('{Escape}');
      // Wait a bit to ensure the modal close animation would've had time to play.
      await new Promise((r) => setTimeout(r, 300));
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });
  },
});

export const OnEscapeKeyDownEscDisabled = meta.story({
  name: 'OnEscapeKeyDown - dismiss disabled (deprecated)',
  args: {
    children: <SampleModalContent />,
    dismissOnEscape: false,
    onEscapeKeyDown: fn(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal
        </Button>
      </>
    );
  },
  play: async ({ args, canvas, step }) => {
    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });

    await step('Click outside to close, nothing should happen', async () => {
      await userEvent.keyboard('{Escape}');
      expect(args.onEscapeKeyDown).not.toHaveBeenCalled();
      // Wait a bit to ensure the modal close animation would've had time to play.
      await new Promise((r) => setTimeout(r, 300));
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
    });
  },
});

const ModalWithTrigger = ({
  triggerText,
  ...modalProps
}: { triggerText: string } & React.ComponentProps<typeof Modal>) => {
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <Modal {...modalProps} open={isOpen} onOpenChange={setOpen} />
      <Button ariaLabel={false} onClick={() => setOpen(true)}>
        {triggerText}
      </Button>
    </>
  );
};

export const StyledComponents = meta.story({
  args: {
    width: 600,
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Styled Components Demo</Modal.Title>
              <Modal.Description>
                This modal demonstrates all available styled components.
              </Modal.Description>
            </Modal.Header>
            <Modal.Row>
              <Modal.Col>
                <h4>Left Column</h4>
                <p>Content in the left column</p>
                <ul>
                  <li>Item 1</li>
                  <li>Item 2</li>
                  <li>Item 3</li>
                </ul>
              </Modal.Col>
              <Modal.Col>
                <h4>Right Column</h4>
                <p>Content in the right column</p>
                <p>This demonstrates the Row/Col layout system.</p>
              </Modal.Col>
            </Modal.Row>
            <Modal.Col>
              <h4>Full Width Section</h4>
              <p>This section spans the full width of the modal.</p>
            </Modal.Col>
            <Modal.Actions>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="solid" onClick={() => action('primary')()}>
                  Primary Action
                </Button>
              </Modal.Close>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="outline" onClick={() => action('secondary')()}>
                  Secondary Action
                </Button>
              </Modal.Close>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="outline" onClick={() => action('cancel')()}>
                  Cancel
                </Button>
              </Modal.Close>
            </Modal.Actions>
          </Modal.Content>
        </Modal>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Styled Modal
        </Button>
      </>
    );
  },
});

export const WithError = meta.story({
  args: {
    width: 500,
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);
    const [showError, setShowError] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Form with Error</Modal.Title>
              <Modal.Description>Try the button to see an error message.</Modal.Description>
            </Modal.Header>
            <Modal.Col>
              <label>
                Email:
                <input type="email" style={{ width: '100%', marginTop: '4px', padding: '8px' }} />
              </label>
            </Modal.Col>
            <Modal.Actions>
              <Button ariaLabel={false} variant="solid" onClick={() => setShowError(!showError)}>
                {showError ? 'Hide Error' : 'Show Error'}
              </Button>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="outline" onClick={() => action('cancel')()}>
                  Cancel
                </Button>
              </Modal.Close>
            </Modal.Actions>
          </Modal.Content>
          {showError && (
            <Modal.Error>Invalid email address. Please check and try again.</Modal.Error>
          )}
        </Modal>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Form Modal
        </Button>
      </>
    );
  },
});

export const AlwaysOpen = meta.story({
  args: {
    open: true,
    dismissOnClickOutside: false,
    dismissOnEscape: false,
    children: <SampleModalContent />,
  },
  render: (args) => (
    <Modal {...args}>
      <Modal.Content>
        <Modal.Header hasClose={false}>
          <Modal.Title>Always Open Modal</Modal.Title>
          <Modal.Description>This modal is always visible for demonstration.</Modal.Description>
        </Modal.Header>
        <Modal.Col>
          <p>This modal cannot be closed through normal means.</p>
        </Modal.Col>
      </Modal.Content>
    </Modal>
  ),
});

export const WithOpenChangeCallback = meta.story({
  args: {
    children: <SampleModalContent />,
    onOpenChange: fn(),
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    const handleOpenChange = (open: boolean) => {
      setOpen(open);
      args.onOpenChange?.(open);
    };

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={handleOpenChange} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (with callback)
        </Button>
      </>
    );
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Open modal and verify callback', async () => {
      const trigger = canvas.getByText('Open Modal (with callback)');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    });

    await step('Close modal and verify callback', async () => {
      const closeButton = await waitFor(() => screen.findByLabelText('Close modal'), {
        timeout: 3000,
      });
      await userEvent.click(closeButton);
      await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    });
  },
});

export const InteractiveKeyboard = meta.story({
  args: {
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (Keyboard Test)
        </Button>
      </>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText('Open Modal (Keyboard Test)');

    await step('Open modal with Enter key', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    await step('Navigate through modal content with focus trap', async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const closeButton = await waitFor(
        () => screen.findByRole('button', { name: 'Close modal' }),
        { timeout: 3000 }
      );
      closeButton.focus();

      await expect(closeButton).toHaveFocus();

      await userEvent.tab();
      const sampleButton = await screen.findByText('Sample Button');
      await expect(sampleButton).toHaveFocus();

      await userEvent.tab();
      const saveButton = await screen.findByText('Save');
      await expect(saveButton).toHaveFocus();

      await userEvent.tab();
      const cancelButton = await screen.findByText('Cancel');
      await expect(cancelButton).toHaveFocus();

      await userEvent.tab();
      await expect(closeButton).toHaveFocus();

      await userEvent.tab();
      await expect(sampleButton).toHaveFocus();
    });

    await step('Close modal with Escape key', async () => {
      await userEvent.keyboard('{Escape}');
    });

    await step('Await exit animation and check modal is closed', async () => {
      await waitFor(() => expect(screen.queryByText('Sample Modal')).not.toBeInTheDocument());
    });
  },
});

export const InteractiveMouse = meta.story({
  args: {
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <div>
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (Mouse Test)
        </Button>
        <Button ariaLabel={false} style={{ marginLeft: '1rem' }}>
          Outside Button
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Open modal', async () => {
      const trigger = canvas.getByText('Open Modal (Mouse Test)');
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Sample Modal')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    await step('Click close button', async () => {
      const closeButton = await waitFor(() => screen.findByLabelText('Close modal'), {
        timeout: 3000,
      });
      await userEvent.click(closeButton);
    });

    await step('Await exit animation and check modal is closed', async () => {
      await waitFor(() => expect(screen.queryByText('Sample Modal')).not.toBeInTheDocument());
    });

    await step('Open modal and click outside to close', async () => {
      const trigger = canvas.getByText('Open Modal (Mouse Test)');
      await userEvent.click(trigger);
      await expect(screen.queryByText('Sample Modal')).toBeInTheDocument();

      const outsideButton = canvas.getByText('Outside Button');
      await userEvent.click(outsideButton);
    });

    await step('Await exit animation and check modal is closed', async () => {
      await waitFor(() => expect(screen.queryByText('Sample Modal')).not.toBeInTheDocument());
    });
  },
});

export const LongContent = meta.story({
  args: {
    height: 400,
    ariaLabel: 'Long content modal',
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Modal with Long Content</Modal.Title>
              <Modal.Description>
                This modal demonstrates scrolling behavior with extensive content.
              </Modal.Description>
            </Modal.Header>
            <Modal.Col>
              <h4>Lorem Ipsum Content</h4>
              {Array.from({ length: 10 }, (_, i) => (
                <p key={i} style={{ marginBottom: '1rem' }}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                  exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
                  irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
                  pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
                  officia deserunt mollit anim id est laborum.
                </p>
              ))}
            </Modal.Col>
            <Modal.Actions>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="solid" onClick={() => action('save')()}>
                  Save
                </Button>
              </Modal.Close>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="outline" onClick={() => action('cancel')()}>
                  Cancel
                </Button>
              </Modal.Close>
            </Modal.Actions>
          </Modal.Content>
        </Modal>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Long Content Modal
        </Button>
      </>
    );
  },
});

export const DialogTransitions = meta.story({
  args: {
    variant: 'dialog',
    ariaLabel: 'Dialog with transitions',
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Dialog with Smooth Transitions</Modal.Title>
              <Modal.Description>
                This dialog demonstrates the zoom-in/zoom-out transition animations.
              </Modal.Description>
            </Modal.Header>
            <Modal.Col>
              <p>Open and close this modal to see the smooth dialog transitions:</p>
              <ul>
                <li>Enter: Zoom-in with fade-in</li>
                <li>Exit: Zoom-out with fade-out</li>
              </ul>
              <p>The animations are centrally managed for system coherence.</p>
            </Modal.Col>
            <Modal.Actions>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="solid" onClick={() => action('understood')()}>
                  Got it
                </Button>
              </Modal.Close>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="outline" onClick={() => action('close')()}>
                  Close
                </Button>
              </Modal.Close>
            </Modal.Actions>
          </Modal.Content>
        </Modal>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Dialog with Transitions
        </Button>
      </>
    );
  },
});

export const BottomDrawerTransitions = meta.story({
  args: {
    variant: 'bottom-drawer',
    ariaLabel: 'Bottom drawer with transitions',
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Modal {...args} open={isOpen} onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Bottom Drawer with Smooth Transitions</Modal.Title>
              <Modal.Description>
                This drawer demonstrates the slide-from-bottom/slide-to-bottom transition
                animations.
              </Modal.Description>
            </Modal.Header>
            <Modal.Col>
              <p>Open and close this modal to see the smooth drawer transitions:</p>
              <ul>
                <li>Enter: Slide from bottom with fade-in</li>
                <li>Exit: Slide to bottom with fade-out</li>
              </ul>
              <p>Perfect for mobile-friendly interfaces and actions sheets.</p>
            </Modal.Col>
            <Modal.Actions>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="solid" onClick={() => action('understood')()}>
                  Got it
                </Button>
              </Modal.Close>
              <Modal.Close asChild>
                <Button ariaLabel={false} variant="outline" onClick={() => action('close')()}>
                  Close
                </Button>
              </Modal.Close>
            </Modal.Actions>
          </Modal.Content>
        </Modal>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Bottom Drawer with Transitions
        </Button>
      </>
    );
  },
});

export const WithContainer = meta.story({
  args: {
    children: <SampleModalContent />,
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);

    return (
      <>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal in Custom Container
        </Button>
        <MockContainer
          bgColor="rgba(255, 71, 133, 0.05"
          borderColor="#ff4785"
          text="Custom Container. Modal will appear within this bordered area."
          ref={container}
        />
        <Modal
          {...args}
          container={container.current || undefined}
          open={isOpen}
          onOpenChange={setOpen}
        />
      </>
    );
  },
});

export const WithPortalSelector = meta.story({
  args: {
    children: <SampleModalContent />,
    portalSelector: '#custom-modal-portal-target',
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);

    return (
      <>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal in Portal Target
        </Button>
        <MockContainer
          id="custom-modal-portal-target"
          bgColor="rgba(30, 167, 253, 0.05)"
          borderColor="#1EA7FD"
          text="Portal Selector Target. Modal will appear within this bordered area."
        />
        <Modal {...args} open={isOpen} onOpenChange={setOpen} />
      </>
    );
  },
});

export const WithContainerAndPortalSelector = meta.story({
  args: {
    children: <SampleModalContent />,
    portalSelector: '#ignored-portal-target',
  },
  render: (args) => {
    const [isOpen, setOpen] = useState(false);
    const [container, setContainer] = useState<HTMLElement | null>(null);

    return (
      <>
        <Button ariaLabel={false} onClick={() => setOpen(true)}>
          Open Modal (Container takes precedence)
        </Button>
        <MockContainer
          id="ignored-portal-target"
          bgColor="rgba(153, 153, 153, 0.05)"
          borderColor="#999"
          text="Ignored Portal Selector Target"
        />
        <MockContainer
          bgColor="rgba(55, 213, 163, 0.05)"
          borderColor="#37D5A3"
          text="Active Container (takes precedence)."
          ref={(element) => setContainer(element ?? null)}
        />
        {
          <Modal
            {...args}
            container={container || undefined}
            open={isOpen}
            onOpenChange={setOpen}
          />
        }
      </>
    );
  },
});

export default meta;
