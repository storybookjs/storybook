import type { ReactNode } from 'react';
import React from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { styled } from 'storybook/theming';

import { Link } from '../typography/link/link';

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const Desc = styled.span();

const Links = styled.div(({ theme }) => ({
  marginTop: 8,
  textAlign: 'center',

  '> *': {
    margin: '0 8px',
    fontWeight: theme.typography.weight.bold,
  },
}));

const Message = styled.div(({ theme }) => ({
  color: theme.color.defaultText,
  lineHeight: '18px',
}));

const MessageWrapper = styled.div({
  padding: 15,
  width: 280,
  boxSizing: 'border-box',
});

export interface TooltipMessageProps {
  title?: ReactNode;
  desc?: ReactNode;
  links?: {
    title: string;
    href?: string;
    onClick?: () => void;
  }[];
}

export const TooltipMessage = ({ title, desc, links }: TooltipMessageProps) => {
  deprecate(
    '`TooltipLinkList` is deprecated and will be removed in Storybook 11, use `Popover` and `PopoverProvider` instead.'
  );

  return (
    <MessageWrapper>
      <Message>
        {title && <Title>{title}</Title>}
        {desc && <Desc>{desc}</Desc>}
      </Message>
      {links && (
        <Links>
          {links.map(({ title: linkTitle, ...other }) => (
            <Link {...other} key={linkTitle}>
              {linkTitle}
            </Link>
          ))}
        </Links>
      )}
    </MessageWrapper>
  );
};
