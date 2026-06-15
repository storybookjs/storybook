import type { ReactNode } from 'react';
import React from 'react';
import {
  Button,
  type ButtonProps,
  ToggleButton,
  type UseCopyButtonOptions,
  useCopyButton,
} from 'storybook/internal/components';
import { styled } from 'storybook/theming';

const AgenticButton = styled(ToggleButton)(({ theme }) => {
  const surface = {
    color: theme.fgColor.agentic,
    background: theme.bgColor.agentic,
    boxShadow: `inset 0 0 0 1px ${theme.borderColor.agentic}`,
  };

  return {
    justifyContent: 'flex-start',
    '&&, &&:active': surface,
    '&&:hover': {
      ...surface,
      boxShadow: `inset 0 0 0 1px ${theme.fgColor.agentic}`,
    },
    '&&:focus-visible': {
      ...surface,
      outline: `2px solid ${theme.fgColor.agentic}`,
      outlineOffset: 2,
      zIndex: 1,
    },
  };
});

export type CopyButtonProps = Omit<ButtonProps, 'children' | 'onClick' | 'ariaLabel'> &
  UseCopyButtonOptions<ReactNode> & {
    appearance?: 'default' | 'agentic';
  };

/** Button that copies text to the clipboard and shows a copied state. */
export function CopyButton({
  children,
  childrenOnCopy,
  content,
  onCopy,
  ariaLabel,
  ariaLabelOnCopy,
  duration,
  appearance = 'default',
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

  if (appearance === 'agentic') {
    return (
      <AgenticButton
        variant="outline"
        padding="small"
        pressed={false}
        disableAllTooltips
        {...buttonProps}
        {...copyButtonProps}
      >
        {buttonChildren}
      </AgenticButton>
    );
  }

  return (
    <Button {...buttonProps} {...copyButtonProps}>
      {buttonChildren}
    </Button>
  );
}
