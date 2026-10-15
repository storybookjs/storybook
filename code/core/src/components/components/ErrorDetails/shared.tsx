import { styled } from 'storybook/theming';

/**
 * The card shell shared by the error primitives: padded flex column on the content background.
 * Each primitive adds only its gap and its border tone.
 */
export const CardShell = styled.div<{ gap?: number }>(({ theme, gap = 12 }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
  padding: 16,
  borderRadius: theme.appBorderRadius,
  background: theme.background.content,
  color: theme.color.defaultText,
}));

/** One row primitive for action/detail rows; derived variants adjust gap only. */
export const Row = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });

export const ActionsRow = styled(Row)({ gap: 12 });
