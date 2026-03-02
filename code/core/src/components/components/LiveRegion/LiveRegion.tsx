import type { HTMLAttributes } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import {
  announce as ariaAnnounce,
  clearAnnouncer,
  destroyAnnouncer,
} from '@react-aria/live-announcer';

export type Politeness = 'polite' | 'assertive';

export interface LiveRegionProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The politeness level for the live region.
   *
   * - `"polite"` – announcement is deferred until the user is idle (default).
   * - `"assertive"` – announcement interrupts the user immediately.
   */
  politeness?: Politeness;
  /**
   * When `true` (the default), the region is visually hidden but still accessible to screen readers
   * (uses the `sb-sr-only` class).
   *
   * Set to `false` to render a visible region (e.g. for form error messages).
   */
  visuallyHidden?: boolean;
}

/**
 * A declarative React component that renders an `aria-live` region.
 *
 * Content passed as `children` is announced by assistive technology whenever it changes.
 *
 * ```tsx
 * <LiveRegion politeness="polite">3 tests passed</LiveRegion>;
 * ```
 *
 * For the visually-hidden (default) variant the component applies the `sb-sr-only` utility class so
 * the region is invisible but still read by screen readers. Set `visuallyHidden={false}` to render
 * a visible region that doubles as an on-screen message area (e.g. form errors).
 */
export const LiveRegion = ({
  politeness = 'polite',
  visuallyHidden = true,
  children,
  className,
  ...rest
}: LiveRegionProps) => {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={visuallyHidden ? ['sb-sr-only', className].filter(Boolean).join(' ') : className}
      {...rest}
    >
      {children}
    </div>
  );
};

/**
 * Imperatively announce a message to assistive technology using `@react-aria/live-announcer`.
 *
 * This is useful when you need to announce something outside of a React render cycle.
 */
export const announce: typeof ariaAnnounce = ariaAnnounce;

export { clearAnnouncer, destroyAnnouncer };

export interface UseAnnouncerOptions {
  politeness?: Politeness;
  /** Timeout in ms after which the announcement is cleared (default: 7000). */
  timeout?: number;
}

/**
 * Hook that returns an `announce` callback bound to the given politeness level. Cleans up the
 * announcer on unmount.
 *
 * ```ts
 * const announce = useAnnouncer({ politeness: 'polite' });
 * announce('3 tests passed');
 * ```
 */
export function useAnnouncer({ politeness = 'polite', timeout }: UseAnnouncerOptions = {}) {
  const announceFn = useRef((message: string) => {
    ariaAnnounce(message, politeness, timeout);
  });

  useEffect(() => {
    announceFn.current = (message: string) => {
      ariaAnnounce(message, politeness, timeout);
    };
  }, [politeness, timeout]);

  // Stable reference that delegates to the latest options.
  const [stableAnnounce] = useState(() => (message: string) => announceFn.current(message));

  return stableAnnounce;
}
