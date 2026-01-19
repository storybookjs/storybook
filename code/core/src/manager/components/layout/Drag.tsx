import { styled } from 'storybook/theming';

/**
 * Drag handle for the sidebar and panel resizers. Can be horizontal (bottom panel) or vertical
 * (sidebar or right panel). Can optionally be set to not overlap the content area (only render
 * outside of it), which is necessary when the panel is collapsed to prevent a layout shift when
 * scrollIntoView is used.
 */
export const Drag = styled.div<{
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
