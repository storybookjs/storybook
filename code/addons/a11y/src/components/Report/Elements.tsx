import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/internal/theming';

import type { NodeResult } from 'axe-core';
import { Rules } from './Rules';

import type { RuleType } from '../A11YPanel';
import HighlightToggle from './HighlightToggle';

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

const HighlightToggleElement = styled.span({
  fontWeight: 'normal',
  alignSelf: 'center',
  paddingRight: 15,
  input: {
    margin: 0,
    display: 'block',
  },
});

interface ElementProps {
  element: NodeResult;
  type: RuleType;
}

const Element: FC<ElementProps> = ({ element, type }) => {
  const { any, all, none } = element;
  const rules = [...any, ...all, ...none];
  const highlightToggleId = `${type}-${element.target[0]}`;

  return (
    <Item>
      <ItemTitle>
        {element.target[0]}
        <HighlightToggleElement>
          <HighlightToggle toggleId={highlightToggleId} elementsToHighlight={[element]} />
        </HighlightToggleElement>
      </ItemTitle>
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
