import React from 'react';

// Copied and modified from https://usehooks.com/usemeasure
export function useMeasure<T extends Element>() {
  const [dimensions, setDimensions] = React.useState({
    width: null,
    height: null,
  });

  const prevObserver = React.useRef(null);

  const customRef = React.useCallback((node: T) => {
    if (prevObserver.current) {
      // @ts-expect-error (non strict)
      prevObserver.current.disconnect();
      prevObserver.current = null;
    }

    if (node?.nodeType === Node.ELEMENT_NODE) {
      const observer = new ResizeObserver(([entry]) => {
        if (entry && entry.borderBoxSize) {
          const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0];

          // @ts-expect-error (non strict)
          setDimensions({ width, height });
        }
      });

      observer.observe(node);
      // @ts-expect-error (non strict)
      prevObserver.current = observer;
    }
  }, []);

  return [customRef, dimensions] as const;
}
