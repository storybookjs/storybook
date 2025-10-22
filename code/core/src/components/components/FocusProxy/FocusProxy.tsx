import { styled } from 'storybook/theming';

export const FocusProxy = styled.div<{ htmlFor: string; outlineOffset?: number }>(
  ({ theme, htmlFor, outlineOffset = 0 }) => ({
    width: '100%',
    borderRadius: 'inherit',
    transition: 'outline-color var(--transition-duration, 0.2s)',
    outline: `2px solid transparent`,
    outlineOffset,

    [`&:focus, &:has(#${htmlFor}:focus-visible)`]: {
      outlineColor: theme.color.secondary,
    },
  })
);
