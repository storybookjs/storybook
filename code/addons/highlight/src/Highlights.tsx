import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  return selectors.flatMap((selector) => {
    const elements = root?.querySelectorAll(selector) || [];
    return Array.from(elements).filter((element) => element.id !== 'addon-highlight-container');
  });
};

const getBoxes = (elements: Element[]): Map<Element, Box> =>
  new Map(
    elements.map((element) => {
      const { top, left, width, height } = element.getBoundingClientRect();
      return [element, { top, left, width, height }];
    })
  );

const equalBoxes = (a: Box, b?: Box) =>
  a.top === b?.top && a.left === b?.left && a.width === b?.width && a.height === b?.height;

export const Highlights = ({ selectors }: { selectors: string[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<Element[]>([]);

  const [boxes, setBoxes] = useState<Map<Element, Box>>(() => getBoxes(getElements(selectors)));

  const observer = useMemo(
    () =>
      new ResizeObserver(() => {
        const updated = getBoxes(elementsRef.current);
        setBoxes((current) =>
          current.size === updated.size &&
          current.entries().every(([element, box]) => equalBoxes(box, updated.get(element)))
            ? current
            : updated
        );
      }),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const elements = getElements(selectors);
    elementsRef.current = elements;

    observer.observe(container);
    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.unobserve(container);
      elements.forEach((element) => observer.unobserve(element));
    };
  }, [observer, selectors]);

  return (
    <Container id="addon-highlight-container" ref={containerRef}>
      {Array.from(boxes.values()).map((box) => (
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
    </Container>
  );
};
