import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { styled } from 'storybook/internal/theming';

type Box = {
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
  pointerEvents: 'none',
});

const getElements = (selectors: string[]): Element[] => {
  const root = document.getElementById('storybook-root');
  return selectors.flatMap((selector) => Array.from(root?.querySelectorAll(selector) || []));
};

const getHighlights = (elements: Element[]): Box[] =>
  elements.map((element) => {
    const { top, left, width, height } = element.getBoundingClientRect();
    return { top, left, width, height };
  });

export const Highlights = ({ selectors }: { selectors: string[] }) => {
  const [elements, setElements] = useState<Element[]>([]);
  const [highlights, setHighlights] = useState<Box[]>([]);

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

  return createPortal(
    <Container id="addon-highlight-container">
      {Array.from(highlights.values()).map((box) => (
        <div
          key={`${box.top}-${box.left}-${box.width}-${box.height}`}
          style={{
            position: 'absolute',
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxSizing: 'border-box',
            border: '1px solid rgba(255, 68, 0, 0.7)',
            backgroundColor: 'rgba(255, 68, 0, 0.4)',
            padding: 5,
          }}
        >
          {`x${box.left} y${box.top} w${box.width} h${box.height}`}
        </div>
      ))}
    </Container>,
    document.body
  );
};
