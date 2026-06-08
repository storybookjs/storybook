import type { ReactNode } from 'react';
import React from 'react';
import {
  Button,
  type ButtonProps,
  type UseCopyButtonOptions,
  useCopyButton,
} from 'storybook/internal/components';

export type CopyButtonProps<T extends ReactNode = ReactNode> = Omit<
  ButtonProps,
  'children' | 'onClick' | 'ariaLabel'
> &
  UseCopyButtonOptions<T>;

/** Button that copies text to the clipboard and shows a copied state. */
export function CopyButton<T extends ReactNode>({
  children,
  childrenOnCopy,
  content,
  onCopy,
  ariaLabel,
  ariaLabelOnCopy,
  duration,
  ...buttonProps
}: CopyButtonProps<T>) {
  const { children: buttonChildren, buttonProps: copyButtonProps } = useCopyButton({
    children,
    childrenOnCopy,
    content,
    onCopy,
    ariaLabel,
    ariaLabelOnCopy,
    duration,
  });

  return (
    <Button {...buttonProps} {...copyButtonProps}>
      {buttonChildren}
    </Button>
  );
}
