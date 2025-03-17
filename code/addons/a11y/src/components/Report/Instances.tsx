import React, { type FC } from 'react';

import { Button, SyntaxHighlighter } from 'storybook/internal/components';

import { CopyIcon, LocationIcon } from '@storybook/icons';

import type { CheckResult } from 'axe-core';
import { styled } from 'storybook/theming';

const List = styled.div({
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: 4,
  paddingRight: 4,
  paddingTop: 4,
  fontWeight: 400,
});

const Item = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 15,
  flexDirection: 'column',
  fontSize: theme.typography.size.s2,
}));

const Actions = styled.div({
  display: 'flex',
  gap: 10,
});

interface RuleProps {
  rule: CheckResult;
}

const Instance: FC<RuleProps> = ({ rule }) => (
  <Item>
    <div>{rule.message}</div>
    <Actions>
      <Button>
        <LocationIcon /> Jump to element
      </Button>
      <Button>
        <CopyIcon /> Copy link
      </Button>
    </Actions>
    <SyntaxHighlighter language="html">{`// element`}</SyntaxHighlighter>
  </Item>
);

interface InstancesProps {
  rules: CheckResult[];
}

export const Instances: FC<InstancesProps> = ({ rules }) => {
  return (
    <List>
      {rules.map((rule, index) => (
        <Instance rule={rule} key={index} />
      ))}
    </List>
  );
};
