import { styled } from 'storybook/theming';

export const NoResults = styled.div({
  display: 'flex',
  flexDirection: 'column',
  textAlign: 'center',
  textWrap: 'balance',
  gap: 4,
  padding: '20px 0',
  lineHeight: `18px`,
  fontSize: 'var(--sb-typography-size-s2)',
  color: 'var(--sb-color-defaultText)',
  small: {
    color: 'var(--sb-textMutedColor)',
    fontSize: 'var(--sb-typography-size-s1)',
  },
});
