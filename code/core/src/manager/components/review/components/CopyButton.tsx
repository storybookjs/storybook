import type { ReactNode } from 'react';
import React from 'react';
import {
  Button,
  type ButtonProps,
  type UseCopyButtonOptions,
  useCopyButton,
} from 'storybook/internal/components';

export type CopyButtonProps = Omit<ButtonProps, 'children' | 'onClick' | 'ariaLabel' | 'theme'> &
  UseCopyButtonOptions<ReactNode>;

export function CopyButton({
  children,
  childrenOnCopy,
  content,
  onCopy,
  ariaLabel,
  ariaLabelOnCopy,
  duration,
  ...buttonProps
}: CopyButtonProps) {
  const { children: buttonChildren, buttonProps: copyButtonProps } = useCopyButton<ReactNode>({
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
