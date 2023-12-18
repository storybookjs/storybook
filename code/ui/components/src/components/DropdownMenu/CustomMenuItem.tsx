import React from 'react';
import { styled } from '@storybook/theming';
import { transparentize } from 'polished';
import type { IconType } from '@storybook/components';
import { Icons } from '../icon/icon';
import { Badge } from '../Badge/Badge';
import { KeyboardShortcut } from '../KeyboardShortcut/KeyboardShortcut';

const IconContainer = styled.span(({ theme }) => ({
  height: '12px',
  width: '12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  color: theme.color.mediumdark,

  '&& *': {
    height: '12px',
    width: '12px',
  },
}));

const TextContainer = styled.div`
  margininlineend: auto;
`;

const LabelContainer = styled.p(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.regular,
  lineHeight: '1.5',
  color: theme.textColor,
}));

const DescriptionContainer = styled.p(({ theme }) => ({
  margin: 0,
  fontSize: 11,
  fontWeight: theme.typography.weight.regular,
  lineHeight: '1.5',
  color: theme.textMutedColor,
}));

type StyledItemProps = {
  active?: boolean;
  disabled?: boolean;
  startInlineIndent?: boolean;
};

const StyledItem = styled.div<StyledItemProps>(
  ({ theme }) => ({
    paddingBlock: '7px',
    paddingInline: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,

    '&:hover:not([disabled])': {
      backgroundColor: theme.background.hoverable,
    },

    '&:hover:not([disabled]) svg': {
      opacity: 1,
    },
  }),
  ({ active = false, theme }) =>
    active
      ? {
          '&& p, && svg': {
            color: theme.color.secondary,
          },
          '&& p:first-of-type': {
            fontWeight: theme.typography.weight.bold,
          },
        }
      : {},
  ({ disabled = false, theme }) =>
    disabled
      ? {
          '&& p, && svg': {
            color: transparentize(0.7, theme.color.defaultText),
          },
        }
      : {},
  ({ startInlineIndent }) =>
    startInlineIndent
      ? {
          paddingInlineStart: '32px',
        }
      : {}
);

type CustomMenuItemProps = StyledItemProps & {
  label: string;
  description?: string;
  icon?: IconType;
  keyboardShortcut?: React.ComponentProps<typeof KeyboardShortcut> & {
    /**
     * Will be used as the value of aria-keyshortcuts
     * which exposes the shortcut to people using assistive technologies
     * More information here: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-keyshortcuts
     */
    ariaKeyshortcuts: string;
  };
  badgeLabel?: string;
};

export function CustomMenuItem({
  label,
  description,
  icon,
  keyboardShortcut,
  active,
  startInlineIndent,
  disabled,
  badgeLabel,
}: CustomMenuItemProps) {
  return (
    <StyledItem
      {...(keyboardShortcut ? { 'aria-keyshortcuts': keyboardShortcut.ariaKeyshortcuts } : {})}
      active={active}
      disabled={disabled}
      startInlineIndent={startInlineIndent}
    >
      {icon ? (
        <IconContainer>
          <Icons icon={icon} />
        </IconContainer>
      ) : null}
      <TextContainer>
        <LabelContainer>
          {label} {badgeLabel ? <Badge status="positive">{badgeLabel}</Badge> : null}
        </LabelContainer>
        {description ? <DescriptionContainer>{description}</DescriptionContainer> : null}
      </TextContainer>
      {keyboardShortcut ? <KeyboardShortcut label={keyboardShortcut.label} /> : null}
    </StyledItem>
  );
}
