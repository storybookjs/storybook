import { styled } from 'storybook/internal/theming';

export const ListItemWrapper = styled.li(() => ({
  display: 'flex',
  alignItems: 'flex-start',
  columnGap: 12,
}));

export const ListItemContentWrapper = styled.div`
  font-family: ${({ theme }) => theme.typography.fonts.base};
  color: ${({ theme }) => theme.color.darker};
  font-size: 13px;
  line-height: 18px;
  margin-top: 2px;
`;

export const ListItemIndexWrapper = styled.div<{ isCompleted: boolean }>(
  ({ isCompleted, theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${!isCompleted ? theme.color.medium : 'transparent'}`,
    width: 20,
    height: 20,
    flexShrink: 0,
    borderRadius: '50%',
    backgroundColor: isCompleted ? theme.color.green : 'white',
    fontFamily: theme.typography.fonts.base,
    fontSize: 10,
    fontWeight: 600,
    color: theme.color.dark,
  })
);
