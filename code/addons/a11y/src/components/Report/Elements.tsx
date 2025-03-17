import type { FC } from 'react';
import React from 'react';

import type { NodeResult } from 'axe-core';
import { styled } from 'storybook/theming';

import type { RuleType } from '../A11YPanel';
import { Rules } from './Rules';

const Item = styled.li({
  fontWeight: 600,
});

const ItemTitle = styled.span(({ theme }) => ({
  borderBottom: `1px solid ${theme.appBorderColor}`,
  width: '100%',
  display: 'flex',
  paddingBottom: 6,
  marginBottom: 6,
  justifyContent: 'space-between',
}));

interface ElementProps {
  element: NodeResult;
  type: RuleType;
}

const Element: FC<ElementProps> = ({ element, type }) => {
  const { any, all, none } = element;
  const rules = [...any, ...all, ...none];

  return (
    <Item>
      <ItemTitle>{element.target[0]}</ItemTitle>
      <Rules rules={rules} />
    </Item>
  );
};

interface ElementsProps {
  elements: NodeResult[];
  type: RuleType;
}

export const Elements: FC<ElementsProps> = ({ elements, type }) => (
  <ol>
    {elements.map((element, index) => (
      <Element element={element} key={index} type={type} />
    ))}
  </ol>
);
