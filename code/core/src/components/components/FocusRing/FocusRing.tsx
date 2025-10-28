import React, { useEffect, useRef, useState } from 'react';

import { styled } from 'storybook/theming';

import { useLocationHash } from '../shared/useLocationHash';

export const FocusOutline = styled.div<{ active?: boolean; outlineOffset?: number }>(
  ({ theme, active = false, outlineOffset = 0 }) => ({
    width: '100%',
    borderRadius: 'inherit',
    transition: 'outline-color var(--transition-duration, 0.2s)',
    outline: `2px solid ${active ? theme.color.secondary : 'transparent'}`,
    outlineOffset,
  })
);

export const FocusProxy = styled(FocusOutline)<{ targetId: string }>(({ theme, targetId }) => ({
  [`&:has(#${targetId}:focus-visible)`]: {
    outlineColor: theme.color.secondary,
  },
}));

export const FocusRing = ({
  active = false,
  highlightDuration,
  nodeRef,
  ...props
}: React.ComponentProps<typeof FocusOutline> & {
  highlightDuration?: number;
  nodeRef?: React.RefObject<HTMLDivElement>;
}) => {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    setVisible(active);
    const timeout = setTimeout(setVisible, highlightDuration, false);
    return () => clearTimeout(timeout);
  }, [active, highlightDuration]);

  return <FocusOutline {...props} active={highlightDuration ? visible : active} ref={nodeRef} />;
};

export const FocusTarget = ({
  targetHash,
  highlightDuration,
  ...props
}: Omit<React.ComponentProps<typeof FocusRing>, 'active'> & {
  targetHash: string;
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const locationHash = useLocationHash();
  const [active, setActive] = useState(locationHash === targetHash);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    setActive(false);
    if (locationHash === targetHash) {
      setTimeout(() => {
        setActive(true);
        nodeRef.current?.focus({ preventScroll: true });
        nodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      if (highlightDuration) {
        timeout = setTimeout(setActive, highlightDuration, false);
      }
    }

    return () => clearTimeout(timeout);
  }, [locationHash, targetHash, highlightDuration]);

  return <FocusRing {...props} active={active} nodeRef={nodeRef} tabIndex={-1} />;
};
