import { styled } from 'storybook/theming';

export const NoResults = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  textAlign: 'center',
  textWrap: 'balance',
  gap: 4,
  lineHeight: `18px`,
  fontSize: `${theme.typography.size.s2}px`,
  color: theme.color.defaultText,
  small: {
    color: theme.textMutedColor,
    fontSize: `${theme.typography.size.s1}px`,
  },
}));
