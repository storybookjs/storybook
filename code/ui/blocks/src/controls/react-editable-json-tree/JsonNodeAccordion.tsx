import { styled } from '@storybook/theming';
import type { ComponentPropsWithoutRef } from 'react';
import React from 'react';

const Container = styled.div(({ theme }) => ({
  position: 'relative',
  ':hover': {
    '& > .rejt-accordion-button::after': {
      background: theme.color.secondary,
    },
    '& > .rejt-accordion-region > :is(.rejt-plus-menu, .rejt-minus-menu)': {
      opacity: 1,
    },
  },
}));

const Trigger = styled.button(({ theme }) => ({
  padding: 0,
  background: 'transparent',
  border: 'none',
  marginRight: '3px',
  lineHeight: '22px',
  color: theme.color.secondary,
  '::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    display: 'block',
    width: '100%',
    marginLeft: '-1rem',
    height: '22px',
    background: 'transparent',
    borderRadius: 4,
    transition: 'background 0.2s',
    opacity: 0.1,
    paddingRight: '20px',
  },
  '::before': {
    content: '""',
    position: 'absolute',
  },
  '&[aria-expanded="true"]::before': {
    left: -10,
    top: 10,
    borderTop: '3px solid rgba(153,153,153,0.6)',
    borderLeft: '3px solid transparent',
    borderRight: '3px solid transparent',
  },
  '&[aria-expanded="false"]::before': {
    left: -8,
    top: 8,
    borderTop: '3px solid transparent',
    borderBottom: '3px solid transparent',
    borderLeft: '3px solid rgba(153,153,153,0.6)',
  },
}));

const Region = styled.div({
  display: 'inline',
});

type AccordionProps = {
  name: string;
  keyPath: string[];
  collapsed: boolean;
  deep: number;
} & ComponentPropsWithoutRef<'button'>;

export function JsonNodeAccordion({
  children,
  name,
  collapsed,
  keyPath,
  deep,
  ...props
}: AccordionProps) {
  const parentPropertyName = keyPath.at(-1) ?? 'root';

  const accordionKey = `${parentPropertyName}-${name}-${deep}`;

  const ids = {
    trigger: `${accordionKey}-trigger`,
    region: `${accordionKey}-region`,
  };

  const containerTag = keyPath.length > 0 ? 'li' : 'div';

  return (
    <Container as={containerTag}>
      <Trigger
        type="button"
        aria-expanded={!collapsed}
        id={ids.trigger}
        aria-controls={ids.region}
        className="rejt-accordion-button"
        {...props}
      >
        {name} :
      </Trigger>
      <Region
        role="region"
        id={ids.region}
        aria-labelledby={ids.trigger}
        className="rejt-accordion-region"
      >
        {children}
      </Region>
    </Container>
  );
}
