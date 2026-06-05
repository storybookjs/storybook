import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { Button, type ButtonProps } from 'storybook/internal/components';

/**
 * Button that copies text to the clipboard and shows a "copied" state for 2 seconds.
 */
export const CopyButton: FC<
  Omit<ButtonProps, 'children'> & {
    copyText: string;
    children: ReactNode | ((copied: boolean) => ReactNode);
  }
> = ({ ariaLabel, copyText, tooltip, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const handleCopy = useCallback(() => {
    // eslint-disable-next-line compat/compat
    navigator.clipboard
      ?.writeText(copyText)
      .then(() => {
        setCopied(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(setCopied, 2000, false);
      })
      .catch(() => {});
  }, [copyText]);

  return (
    <Button
      {...props}
      tooltip={copied ? 'Copied' : tooltip || ariaLabel || undefined}
      ariaLabel={ariaLabel}
      onClick={handleCopy}
    >
      {typeof children === 'function' ? children(copied) : children}
    </Button>
  );
};
