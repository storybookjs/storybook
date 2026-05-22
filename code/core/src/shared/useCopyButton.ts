import {
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { announce, clearAnnouncer } from '@react-aria/live-announcer';

export interface UseCopyButtonOptions<T> {
  /** Content shown in the button by default. */
  children?: T;
  /** Content shown in the button for `duration` ms after a successful copy. */
  childrenOnCopy?: T;
  /** Text written to the clipboard when the button is clicked. */
  content: string;
  /** Optional side-effect called after the text is successfully written to the clipboard. */
  onCopy?: (e: SyntheticEvent) => void;
  /** aria-label for the button in its default state. Pass `false` to suppress. */
  ariaLabel?: false | string;
  /** aria-label for the button while in its "copied" state. Pass `false` to suppress. */
  ariaLabelOnCopy?: false | string;
  /** Duration in milliseconds to show the copied state. Defaults to 3000. */
  duration?: number;
}

export interface UseCopyButtonResult<T> {
  /** Current label/icon — switches to `childrenOnCopy` after a copy. */
  children: T;
  /** Props to spread onto the `<Button>` element. */
  buttonProps: {
    onClick: (e: SyntheticEvent) => void;
    ariaLabel: false | string;
  };
}

export function useCopyButton<T extends ReactNode>({
  children = 'Copy',
  childrenOnCopy = 'Copied!',
  content,
  onCopy,
  ariaLabel = false,
  ariaLabelOnCopy = false,
  duration = 3000,
}: UseCopyButtonOptions<T>): UseCopyButtonResult<T> {
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

  const handleClick = useCallback(
    (e: SyntheticEvent) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const announcement =
        typeof ariaLabelOnCopy === 'string' ? ariaLabelOnCopy : 'Copied to clipboard';

      // eslint-disable-next-line compat/compat
      navigator.clipboard?.writeText(content).then(() => {
        onCopy?.(e);
        setCopied(true);
        announce(announcement, 'polite');

        timerRef.current = setTimeout(() => {
          setCopied(false);
          clearAnnouncer('polite');
          timerRef.current = null;
        }, duration);
      });
    },
    [content, onCopy, ariaLabelOnCopy, duration]
  );

  return {
    // @ts-expect-error - TypeScript is not realising T is constrained identically in both interfaces.
    children: copied ? childrenOnCopy! : children!,
    buttonProps: useMemo(
      () => ({
        onClick: handleClick,
        ariaLabel: copied ? ariaLabelOnCopy : ariaLabel,
      }),
      [handleClick, copied, ariaLabelOnCopy, ariaLabel]
    ),
  };
}
