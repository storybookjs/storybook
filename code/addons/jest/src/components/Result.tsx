import React, { Fragment, useState } from 'react';

import { convert, styled, themes } from 'storybook/internal/theming';

import { ChevronSmallDownIcon } from '@storybook/icons';

// eslint-disable-next-line import/no-named-as-default
import Message from './Message';

const Wrapper = styled.div<{ status: string }>(({ theme, status }) => ({
  display: 'flex',
  width: '100%',
  borderTop: `1px solid ${theme.appBorderColor}`,
  '&:hover': {
    background: status === `failed` ? theme.background.hoverable : undefined,
  },
}));

const HeaderBar = styled.div<{ status: string }>(({ theme, status }) => ({
  padding: theme.layoutMargin,
  paddingLeft: theme.layoutMargin - 3,
  background: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: status === `failed` ? 'pointer' : undefined,
  borderLeft: '3px solid transparent',
  width: '100%',
  display: 'flex',

  '&:focus': {
    outline: '0 none',
    borderLeft: `3px solid ${theme.color.secondary}`,
  },
}));

const Icon = styled(ChevronSmallDownIcon)(({ theme }) => ({
  color: theme.textMutedColor,
  marginRight: 10,
  transition: 'transform 0.1s ease-in-out',
  alignSelf: 'center',
  display: 'inline-flex',
}));

const capitalizeFirstLetter = (text: string) => {
  return text.charAt(0).toUpperCase().concat(text.slice(1));
};

interface ResultProps {
  fullName?: string;
  title?: string;
  failureMessages: any;
  status: string;
}

export function Result(props: ResultProps) {
  const [isOpen, setIsOpen] = useState(false);

  const onToggle = () => {
    setIsOpen(!isOpen);
  };

  const { fullName, title, failureMessages, status } = props;
  return (
    <Fragment>
      <Wrapper status={status}>
        <HeaderBar onClick={onToggle} role="button" status={status}>
          {status === `failed` ? (
            <Icon
              color={convert(themes.light).textMutedColor}
              style={{
                transform: `rotate(${isOpen ? 0 : -90}deg)`,
              }}
            />
          ) : null}
          <div>{capitalizeFirstLetter(fullName ?? '') || capitalizeFirstLetter(title ?? '')}</div>
        </HeaderBar>
      </Wrapper>
      {isOpen ? (
        <Fragment>
          {failureMessages.map((msg: string, i: number) => (
            <Message msg={msg} key={i} />
          ))}
        </Fragment>
      ) : null}
    </Fragment>
  );
}
