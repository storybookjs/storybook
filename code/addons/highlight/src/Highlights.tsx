import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { styled } from 'storybook/internal/theming';

type Highlight = {
  element: Element;
  top: number;
  left: number;
  width: number;
  height: number;
};

const Container = styled.div({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 2147483647,
});

const Selection = styled.div(({ theme }) => ({
  position: 'absolute',
  backgroundColor: theme.background.content,
  borderRadius: 6,
  width: 300,
  marginTop: 15,
  marginLeft: -150,
  padding: 4,
  zIndex: 1,
  boxShadow: `0 2px 5px 0 rgba(0, 0, 0, 0.05), 0 5px 15px 0 rgba(0, 0, 0, 0.1)`,
}));

const SelectionItem = styled.div<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  backgroundColor: theme.background.content,
  borderRadius: 4,
  padding: 8,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'default',
  fontSize: theme.typography.size.s1,
  fontFamily: theme.typography.fonts.mono,
  ...(isSelected && {
    color: theme.color.secondary,
    backgroundColor: theme.background.hoverable,
  }),
}));

const Highlight = styled.div<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  position: 'absolute',
  boxSizing: 'border-box',
  border: '1px solid rgba(255, 68, 0, 0.7)',
  backgroundColor: 'rgba(255, 68, 0, 0.4)',
  padding: 5,
  cursor: 'pointer',
  ':hover': {
    backgroundColor: 'transparent',
  },
  ...(isSelected && {
    backgroundColor: 'transparent',
  }),
}));

const getElements = (selectors: string[]): Element[] => {
  const root = document.getElementById('storybook-root');
  return selectors.flatMap((selector) => Array.from(root?.querySelectorAll(selector) || []));
};

const getHighlights = (elements: Element[]): Highlight[] =>
  elements
    .map((element) => {
      const { top, left, width, height } = element.getBoundingClientRect();
      return { element, top, left, width, height };
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);

export const Highlights = ({ selectors }: { selectors: string[] }) => {
  const [elements, setElements] = useState<Element[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [{ x, y }, setCoordinates] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [targets, setTargets] = useState<Highlight[]>([]);
  const [selected, setSelected] = useState<Element>();

  // Updates the tracked elements when selectors change or the DOM tree changes
  useEffect(() => {
    setElements(getElements(selectors));
    const observer = new MutationObserver(() => {
      setElements(getElements(selectors));
    });
    observer.observe(document.getElementById('storybook-root')!, {
      subtree: true,
      childList: true,
    });
    return () => observer.disconnect();
  }, [selectors]);

  // Updates the tracked highlights when elements are resized
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setHighlights(getHighlights(elements));
    });
    observer.observe(document.getElementById('storybook-root')!);
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [elements]);

  // Updates click targets when elements are removed
  useEffect(() => {
    setTargets((t) => t.filter(({ element }) => elements.includes(element)));
  }, [elements]);

  const handleClick = ({ clientX, clientY }: React.MouseEvent<HTMLDivElement>) => {
    const results = highlights.filter(
      ({ top, left, width, height }) =>
        clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height
    );
    setCoordinates({ x: clientX, y: clientY });
    setTargets(results);
    setSelected(results[0]?.element);
  };

  return createPortal(
    <Container id="addon-highlight-container" onClick={handleClick}>
      <Selection
        style={{ top: y, left: x, display: targets.length ? 'block' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {targets.map((target, index) => {
          const { element, top, left, width, height } = target;
          const isSelected = selected === element;
          return (
            <SelectionItem
              key={`${top}-${left}-${width}-${height}-${index}`}
              isSelected={isSelected}
              onMouseEnter={() => setSelected(element)}
            >
              {element.outerHTML}
            </SelectionItem>
          );
        })}
      </Selection>

      {highlights.map((target, index) => {
        const { element, top, left, width, height } = target;
        const isSelected = selected === element;
        return (
          <Highlight
            key={`${top}-${left}-${width}-${height}-${index}`}
            style={{ top, left, width, height }}
            isSelected={isSelected}
          >
            {`x${left} y${top} w${width} h${height}`}
          </Highlight>
        );
      })}
    </Container>,
    document.body
  );
};
