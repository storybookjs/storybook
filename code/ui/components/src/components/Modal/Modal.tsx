import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Components from './Modal.styled';

type ContentProps = React.ComponentProps<typeof Dialog.Content>;

interface ModalProps extends Omit<React.ComponentProps<typeof Dialog.Root>, 'children'> {
  width?: number;
  height?: number;
  children: React.ReactNode;
  onEscapeKeyDown?: ContentProps['onEscapeKeyDown'];
  onInteractOutside?: ContentProps['onInteractOutside'];
  className?: string;
  container?: HTMLElement;
}

export const initial = { opacity: 0 };
export const animate = { opacity: 1, transition: { duration: 0.3 } };
export const exit = { opacity: 0, transition: { duration: 0.3 } };

function BaseModal({
  children,
  width,
  height,
  onEscapeKeyDown,
  onInteractOutside = (ev) => ev.preventDefault(),
  className,
  container,
  ...rootProps
}: ModalProps) {
  return (
    <Dialog.Root {...rootProps}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay asChild>
          <Components.Overlay />
        </Dialog.Overlay>
        <Dialog.Content
          asChild
          onInteractOutside={onInteractOutside}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          <Components.Container className={className} width={width} height={height}>
            {children}
          </Components.Container>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const Modal = Object.assign(BaseModal, Components, { Dialog });
