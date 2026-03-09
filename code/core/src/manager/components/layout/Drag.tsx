import React, { forwardRef, useMemo } from 'react';

import { styled } from 'storybook/theming';

import { TooltipNote } from '../../../components/components/tooltip/TooltipNote';
import { TooltipProvider } from '../../../components/components/tooltip/TooltipProvider';

interface DragProps {
  /** Visual orientation of the drag handle line. */
  orientation?: 'horizontal' | 'vertical';

  /** Whether the drag handle overlaps the adjacent content area. */
  overlapping?: boolean;

  /** Which side the drag handle sits on, relative to the content it resizes. */
  position?: 'left' | 'right';

  /** Accessible orientation for the separator role (determines arrow key mapping). */
  'aria-orientation'?: 'horizontal' | 'vertical';

  /** Accessible label describing what this separator resizes. */
  'aria-label': string;

  /** Current size (in pixels) of the region controlled by this separator. */
  'aria-valuenow': number;

  /** Maximum size (in pixels) for the region controlled by this separator. */
  'aria-valuemax'?: number;
}

/**
 * Drag handle for the sidebar and panel resizers. Can be horizontal (bottom panel) or vertical
 * (sidebar or right panel). Implements the WAI-ARIA separator role with keyboard resize support.
 *
 * The component automatically sets `role="separator"`, `tabIndex={0}`, and `aria-valuemin={0}`. A
 * tooltip is shown on focus advertising the arrow keys available for keyboard resizing.
 */
export const Drag = forwardRef<HTMLDivElement, DragProps>(function Drag(props, ref) {
  const {
    orientation,
    overlapping,
    position,
    'aria-orientation': ariaOrientation = 'horizontal',
    'aria-label': ariaLabel,
    'aria-valuenow': ariaValueNow,
    'aria-valuemax': ariaValueMax,
    ...rest
  } = props;

  const tooltipNote = useMemo(() => {
    if (ariaOrientation === 'vertical') {
      return '← → to resize';
    }
    return '↑ ↓ to resize';
  }, [ariaOrientation]);

  return (
    <TooltipProvider
      triggerOnFocusOnly
      placement="top"
      tooltip={<TooltipNote note={tooltipNote} />}
    >
      <DragHandle
        ref={ref}
        orientation={orientation}
        overlapping={overlapping}
        position={position}
        role="separator"
        tabIndex={0}
        aria-orientation={ariaOrientation}
        aria-label={ariaLabel}
        aria-valuenow={ariaValueNow}
        aria-valuemin={0}
        aria-valuemax={ariaValueMax}
        {...rest}
      />
    </TooltipProvider>
  );
});

const DragHandle = styled.div<{
  orientation?: 'horizontal' | 'vertical';
  overlapping?: boolean;
  position?: 'left' | 'right';
}>(
  ({ theme }) => ({
    position: 'absolute',
    opacity: 0,
    transition: 'opacity 0.2s ease-in-out',
    zIndex: 100,

    '&:after': {
      content: '""',
      display: 'block',
      backgroundColor: theme.color.secondary,
    },

    '&:hover': {
      opacity: 1,
    },
  }),
  ({ theme, orientation = 'vertical' }) => ({
    '&:focus-visible': {
      opacity: 1,
      outline: 'none',
      ...(orientation === 'horizontal' ? { height: 7 } : { width: 7 }),
      boxShadow: `inset 0 0 0 4px ${theme.color.secondary}`,
    },
  }),
  ({ orientation = 'vertical', overlapping = true, position = 'left' }) =>
    orientation === 'vertical'
      ? {
          width: overlapping ? (position === 'left' ? 10 : 13) : 7,
          height: '100%',
          top: 0,
          right: position === 'left' ? -7 : undefined,
          left: position === 'right' ? -7 : undefined,

          '&:after': {
            width: 1,
            height: '100%',
            marginLeft: position === 'left' ? 3 : 6,
          },

          '&:hover': {
            cursor: 'col-resize',
          },
        }
      : {
          width: '100%',
          height: overlapping ? 13 : 7,
          top: -7,
          left: 0,

          '&:after': {
            width: '100%',
            height: 1,
            marginTop: 6,
          },

          '&:hover': {
            cursor: 'row-resize',
          },
        }
);
