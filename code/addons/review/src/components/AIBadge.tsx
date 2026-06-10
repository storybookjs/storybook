import { Badge } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

// Temporary purple override until a shared "AI" badge variant is decided.
// Light: purple-on-lavender. Dark: lighter purple text on a dark tinted base.
export const AIBadge = styled(Badge)(({ theme }) => ({
  color: theme.base === 'dark' ? '#b07fdc' : '#723aa6',
  background: theme.base === 'dark' ? 'rgba(114,58,166,0.15)' : '#f5f0fa',
  boxShadow: `inset 0 0 0 1px ${theme.base === 'dark' ? 'rgba(114,58,166,0.35)' : '#e1d2ef'}`,
  svg: { marginTop: 0 },
}));
