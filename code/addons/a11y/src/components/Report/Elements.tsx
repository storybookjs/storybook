import type { FC } from 'react';
import React from 'react';

import { Button } from 'storybook/internal/components';

import * as Tabs from '@radix-ui/react-tabs';
import type { NodeResult } from 'axe-core';
import { styled } from 'storybook/theming';

import type { RuleType } from '../A11YPanel';
import { Instances } from './Instances';

const Columns = styled.div({
  display: 'grid',
  gridTemplateColumns: '50% 50%',
  gap: 15,
});

const Item = styled(Button)(({ theme }) => ({
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

interface ElementsProps {
  elements: NodeResult[];
  type: RuleType;
}

export const Elements: FC<ElementsProps> = ({ elements, type }) => (
  <Tabs.Root defaultValue="tab0" orientation="vertical" asChild>
    <Columns>
      <Tabs.List aria-label="tabs example">
        {elements.map((element, index) => (
          <Tabs.Trigger key={`tab${index}`} value={`tab${index}`} asChild>
            <Item variant="ghost" size="medium">
              {index + 1}. {element.target[0]}
            </Item>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {elements.map((element, index) => {
        const { any, all, none } = element;
        const rules = [...any, ...all, ...none];
        return (
          <Tabs.Content key={`tab${index}`} value={`tab${index}`} asChild>
            <Instances rules={rules} />
          </Tabs.Content>
        );
      })}
    </Columns>
  </Tabs.Root>
);
