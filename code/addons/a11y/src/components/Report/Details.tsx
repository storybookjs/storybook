import React, { Fragment, useCallback, useState } from 'react';

import { Button, Link, SyntaxHighlighter } from 'storybook/internal/components';

import { CheckIcon, CopyIcon, LocationIcon } from '@storybook/icons';

import * as Tabs from '@radix-ui/react-tabs';
import type { NodeResult, Result } from 'axe-core';
import { styled } from 'storybook/theming';

import type { RuleType } from '../../types';
import { useA11yContext } from '../A11yContext';

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)(
  ({ theme }) => ({
    fontSize: theme.typography.size.s1,
  }),
  ({ language }) =>
    // We appended ' {}' to the selector in order to get proper syntax highlighting. This rule hides the last 3 spans
    // (one character each) in the displayed output. Only siblings of .selector (the actual CSS selector characters)
    // are targeted so that the code comment line isn't affected.
    language === 'css' && {
      '.selector ~ span:nth-last-of-type(-n+3)': {
        display: 'none',
      },
    }
);

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const Description = styled.p({
  margin: 0,
});

const Wrapper = styled.div({
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  padding: '0 15px 20px 15px',
  gap: 20,
});

const Columns = styled.div({
  gap: 15,

  '@container (min-width: 800px)': {
    display: 'grid',
    gridTemplateColumns: '50% 50%',
  },
});

const Content = styled.div<{ side: 'left' | 'right' }>(({ theme, side }) => ({
  display: side === 'left' ? 'flex' : 'none',
  flexDirection: 'column',
  gap: 15,
  margin: side === 'left' ? '15px 0 20px 0' : 0,
  '&:focus-visible': {
    outline: 'none',
    borderRadius: 4,
    boxShadow: `0 0 0 1px inset ${theme.color.secondary}`,
  },

  '@container (min-width: 800px)': {
    display: side === 'left' ? 'none' : 'flex',
  },
}));

const Item = styled(Button)(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontWeight: theme.typography.weight.regular,
  color: theme.textMutedColor,
  height: 40,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0 12px',
  '&[data-state="active"]': {
    color: theme.color.secondary,
    backgroundColor: theme.background.hoverable,
  },
}));

const Messages = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const Actions = styled.div({
  display: 'flex',
  gap: 10,
});

const CopyButton = ({ onClick }: { onClick: () => void }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    onClick();
    setCopied(true);
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [onClick]);

  return (
    <Button onClick={handleClick}>
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
};

interface DetailsProps {
  item: Result;
  type: RuleType;
  selection: string | undefined;
  handleSelectionChange: (key: string) => void;
}

export const Details = ({ item, type, selection, handleSelectionChange }: DetailsProps) => (
  <Wrapper>
    <Info>
      <Description>
        {item.description.endsWith('.') ? item.description : `${item.description}.`}
      </Description>
      <Link href={item.helpUrl} target="_blank" withArrow>
        Learn how to resolve this violation
      </Link>
    </Info>

    <Tabs.Root
      defaultValue={selection}
      orientation="vertical"
      value={selection}
      onValueChange={handleSelectionChange}
      asChild
    >
      <Columns>
        <Tabs.List aria-label={type}>
          {item.nodes.map((node, index) => {
            const key = `${type}.${item.id}.${index + 1}`;
            return (
              <Fragment key={key}>
                <Tabs.Trigger value={key} asChild>
                  <Item variant="ghost" size="medium">
                    {index + 1}. {node.html}
                  </Item>
                </Tabs.Trigger>
                <Tabs.Content value={key} asChild>
                  <Content side="left">{getContent(node, key)}</Content>
                </Tabs.Content>
              </Fragment>
            );
          })}
        </Tabs.List>

        {item.nodes.map((node, index) => {
          const key = `${type}.${item.id}.${index + 1}`;
          return (
            <Tabs.Content key={key} value={key} asChild>
              <Content side="right">{getContent(node, key)}</Content>
            </Tabs.Content>
          );
        })}
      </Columns>
    </Tabs.Root>
  </Wrapper>
);

function getContent(node: NodeResult, key: string) {
  const { handleCopyLink, handleJumpToElement } = useA11yContext();
  const { any, all, none, html, target } = node;
  const rules = [...any, ...all, ...none];
  return (
    <>
      <Messages>
        {rules.map((rule) => (
          <div key={rule.id}>
            {`${rule.message}${/(\.|: [^.]+\.*)$/.test(rule.message) ? '' : '.'}`}
          </div>
        ))}
      </Messages>

      <Actions>
        <Button onClick={() => handleJumpToElement(node.target.toString())}>
          <LocationIcon /> Jump to element
        </Button>
        <CopyButton onClick={() => handleCopyLink(key)} />
      </Actions>

      {/* Technically this is HTML but we use JSX to avoid using an HTML comment */}
      <StyledSyntaxHighlighter
        language="jsx"
        wrapLongLines
      >{`/* element */\n${html}`}</StyledSyntaxHighlighter>

      {/* See note about the appended {} in the StyledSyntaxHighlighter component */}
      <StyledSyntaxHighlighter
        language="css"
        wrapLongLines
      >{`/* selector */\n${target} {}`}</StyledSyntaxHighlighter>
    </>
  );
}
