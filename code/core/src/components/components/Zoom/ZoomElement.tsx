import type { ReactElement } from 'react';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ResizeHandler } from 'use-resize-observer';
import useResizeObserver from 'use-resize-observer';
import { styled } from '@storybook/core/theming';

const ZoomElementWrapper = styled.div<{ scale: number; elementHeight: number }>(
  ({ scale = 1, elementHeight }) => ({
    height: elementHeight || 'auto',
    transformOrigin: 'top left',
    transform: `scale(${1 / scale})`,
  })
);

type ZoomProps = {
  scale: number;
  children: ReactElement | ReactElement[];
};

export function ZoomElement({ scale, children }: ZoomProps) {
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
    <ZoomElementWrapper scale={scale} elementHeight={elementHeight}>
      <div ref={componentWrapperRef} className="innerZoomElementWrapper">
        {children}
      </div>
    </ZoomElementWrapper>
  );
}
