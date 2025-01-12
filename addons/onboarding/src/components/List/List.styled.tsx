import { styled } from 'storybook/internal/theming';

export const ListWrapper = styled.ul(() => ({
  display: 'flex',
  flexDirection: 'column',
  rowGap: 16,
  padding: 0,
  margin: 0,
}));
