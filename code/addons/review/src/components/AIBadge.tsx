import { Badge } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

export const AIBadge = styled(Badge)(({ theme }) => ({
  color: theme.fgColor.agentic,
  background: theme.bgColor.agentic,
  boxShadow: `inset 0 0 0 1px ${theme.borderColor.agentic}`,
  svg: { marginTop: 0 },
}));
