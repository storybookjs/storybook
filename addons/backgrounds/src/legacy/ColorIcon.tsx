import { styled } from 'storybook/internal/theming';

export const ColorIcon = styled.span(
  ({ background }: { background: string }) => ({
    borderRadius: '1rem',
    display: 'block',
    height: '1rem',
    width: '1rem',
    background,
  }),
  ({ theme }) => ({
    boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
  })
);
