import type { ReactElement } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { styled } from 'storybook/theming';
import type { ResizeHandler } from 'use-resize-observer';
import useResizeObserver from 'use-resize-observer';

const ZoomElementWrapper = styled.div<{ centered?: boolean; scale: number; elementHeight: number }>(
  ({ centered = false, scale = 1, elementHeight }) => ({
    height: elementHeight || 'auto',
    transformOrigin: centered ? 'center top' : 'left top',
    transform: `scale(${1 / scale})`,
  })
);

type ZoomProps = {
  centered?: boolean;
  scale: number;
  children: ReactElement | ReactElement[];
};

export function ZoomElement({ centered, scale, children }: ZoomProps) {
  const componentWrapperRef = useRef<HTMLDivElement>(null);
  const [elementHeight, setElementHeight] = useState(0);

  const onResize = useCallback<ResizeHandler>(
    ({ height }) => {
      if (height) {
        setElementHeight(height / scale);
      }
    },
    [scale]
  );

  useEffect(() => {
    if (componentWrapperRef.current) {
      setElementHeight(componentWrapperRef.current.getBoundingClientRect().height);
    }
  }, [scale]);

  useResizeObserver({
    ref: componentWrapperRef,
    onResize,
  });

  return (
    <ZoomElementWrapper centered={centered} scale={scale} elementHeight={elementHeight}>
      <div ref={componentWrapperRef} className="innerZoomElementWrapper">
        {children}
      </div>
    </ZoomElementWrapper>
  );
}
