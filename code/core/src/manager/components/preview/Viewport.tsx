import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ActionList } from 'storybook/internal/components';

import { TransferIcon, UndoIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import {
  VIEWPORT_MIN_HEIGHT,
  VIEWPORT_MIN_WIDTH,
  useViewport,
} from '../../../viewport/useViewport';
import { IFrame } from './Iframe';
import { NumericInput } from './NumericInput';

type DragSide = 'none' | 'both' | 'bottom' | 'right';

const ViewportWrapper = styled.div<{
  active: boolean;
  isDefault: boolean;
}>(({ active, isDefault, theme }) => ({
  gridArea: '1 / 1',
  alignSelf: 'start',
  justifySelf: 'start',
  display: active ? 'inline-flex' : 'none',
  flexDirection: 'column',
  gap: 6,
  width: '100%',
  height: '100%',
  paddingTop: isDefault ? 0 : 6,
  paddingBottom: isDefault ? 0 : 40,
  paddingInline: isDefault ? 0 : 40,

  '&:has([data-size-input="width"]:focus-visible)': {
    '[data-dragging]': {
      borderRightColor: theme.color.secondary,
      boxShadow: `4px 0 5px -2px ${theme.background.hoverable}`,
    },
  },
  '&:has([data-size-input="height"]:focus-visible)': {
    '[data-dragging]': {
      borderBottomColor: theme.color.secondary,
      boxShadow: `0 4px 5px -2px ${theme.background.hoverable}`,
    },
  },
}));

const ViewportControls = styled.div({
  display: 'flex',
  gap: 6,
});

const ViewportDimensions = styled.div({
  display: 'flex',
  gap: 2,
});

const FrameWrapper = styled.div<{
  isDefault: boolean;
  'data-dragging': DragSide;
}>(({ isDefault, 'data-dragging': dragging, theme }) => ({
  position: 'relative',
  minWidth: VIEWPORT_MIN_WIDTH,
  minHeight: VIEWPORT_MIN_HEIGHT,
  boxSizing: 'content-box', // we're sizing the contents, not the box itself
  border: `1px solid ${theme.button.border}`,
  borderWidth: isDefault ? 0 : 1,
  borderRadius: isDefault ? 0 : 4,
  transition: 'border-color 0.2s, box-shadow 0.2s',
  '&:has([data-side="right"]:hover), &[data-dragging="right"]': {
    borderRightColor: theme.color.secondary,
    boxShadow: `4px 0 5px -2px ${theme.background.hoverable}`,
    '[data-side="right"]::after': {
      opacity: 1,
    },
  },
  '&:has([data-side="bottom"]:hover), &[data-dragging="bottom"]': {
    borderBottomColor: theme.color.secondary,
    boxShadow: `0 4px 5px -2px ${theme.background.hoverable}`,
    '[data-side="bottom"]::after': {
      opacity: 1,
    },
  },
  '&:has([data-side="both"]:hover), &[data-dragging="both"]': {
    boxShadow: `3px 3px 5px -2px ${theme.background.hoverable}`,
    '&::after, [data-side]::after': {
      opacity: 1,
    },
  },
  '&::after': {
    content: '""',
    display: 'block',
    position: 'absolute',
    pointerEvents: 'none',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    opacity: 0,
    transition: 'opacity 0.2s',
    background: `linear-gradient(to top left,
      rgba(0,0,0,0) 0%,
      rgba(0,0,0,0) calc(25% - 1px),
      ${theme.color.secondary} 25%,
      rgba(0,0,0,0) calc(25% + 1px),
      rgba(0,0,0,0) calc(45% - 1px),
      ${theme.color.secondary} 45%,
      rgba(0,0,0,0) calc(45% + 1px),
      rgba(0,0,0,0) 100%)`,
  },
  iframe: {
    pointerEvents: dragging === 'none' ? 'auto' : 'none',
  },
}));

const DragHandle = styled.div<{
  isDefault: boolean;
  'data-side': DragSide;
}>(
  { display: 'none' },
  ({ theme, isDefault }) =>
    !isDefault && {
      display: 'block',
      position: 'absolute',
      fontSize: 10,
      '&[data-side="both"]': {
        right: -12,
        bottom: -12,
        width: 25,
        height: 25,
        cursor: 'nwse-resize',
      },
      '&[data-side="bottom"]': {
        left: 0,
        right: 13,
        bottom: -12,
        height: 20,
        cursor: 'row-resize',
        '&::after': {
          content: 'attr(data-value)',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: 4,
          backgroundColor: theme.background.hoverable,
          padding: '2px 4px',
          opacity: 0,
          transition: 'opacity 0.2s',
        },
      },
      '&[data-side="right"]': {
        top: 0,
        right: -12,
        bottom: 13,
        width: 20,
        cursor: 'col-resize',
        '&::after': {
          content: 'attr(data-value)',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: 4,
          backgroundColor: theme.background.hoverable,
          padding: '2px 4px',
          opacity: 0,
          transition: 'opacity 0.2s',
        },
      },
    }
);

const ScrollEdge = styled.div<{ 'data-edge': DragSide }>({
  position: 'absolute',
  pointerEvents: 'none',
  width: 0,
  height: 0,
  '&[data-edge="right"]': {
    right: -40,
    height: '100%',
  },
  '&[data-edge="bottom"]': {
    bottom: -40,
    width: '100%',
  },
  '&[data-edge="both"]': {
    right: -40,
    bottom: -40,
  },
});

const SizeInput = styled(NumericInput)({
  width: 85,
  height: 28,
  minHeight: 28,
});

export const Viewport = ({
  active,
  id,
  src,
  scale,
}: {
  active: boolean;
  id: string;
  src: string;
  scale: number;
}) => {
  const { width, height, isCustom, isDefault, lastSelectedOption, resize, rotate, select } =
    useViewport();

  const [dragging, setDragging] = useState<DragSide>('none');
  const targetRef = useRef<HTMLDivElement>(null);
  const dragRefX = useRef<HTMLDivElement>(null);
  const dragRefY = useRef<HTMLDivElement>(null);
  const dragRefXY = useRef<HTMLDivElement>(null);
  const dragSide = useRef<DragSide>('none');
  const dragStart = useRef<[number, number] | undefined>();
  const dragScrollTarget = useRef<Element | null | undefined>(null);

  useEffect(() => {
    const onDrag = (e: MouseEvent) => {
      if (!targetRef.current || !dragStart.current) {
        return;
      }
      if (dragRefX.current && (dragSide.current === 'both' || dragSide.current === 'right')) {
        const newWidth = Math.max(VIEWPORT_MIN_WIDTH, dragStart.current[0] + e.clientX);
        targetRef.current.style.width = `${newWidth}px`;
        dragRefX.current.dataset.value = `${Math.round(newWidth / scale)}`;
      }
      if (dragRefY.current && (dragSide.current === 'both' || dragSide.current === 'bottom')) {
        const newHeight = Math.max(VIEWPORT_MIN_HEIGHT, dragStart.current[1] + e.clientY);
        targetRef.current.style.height = `${newHeight}px`;
        dragRefY.current.dataset.value = `${Math.round(newHeight / scale)}`;
      }
      if (dragScrollTarget.current) {
        dragScrollTarget.current.scrollIntoView({ block: 'center', inline: 'center' });
      }
    };

    const onEnd = () => {
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('mousemove', onDrag);
      setDragging('none');
      dragStart.current = undefined;
      if (targetRef.current) {
        const { clientWidth, clientHeight, dataset } = targetRef.current;
        const scale = Number(dataset.scale) || 1;
        resize(`${Math.round(clientWidth / scale)}px`, `${Math.round(clientHeight / scale)}px`);
      }
    };

    const onStart = (e: MouseEvent) => {
      e.preventDefault();
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('mousemove', onDrag);
      dragSide.current = (e.currentTarget as HTMLElement).dataset.side as DragSide;
      dragStart.current = [
        (targetRef.current?.clientWidth ?? 0) - e.clientX,
        (targetRef.current?.clientHeight ?? 0) - e.clientY,
      ];
      dragScrollTarget.current = targetRef.current?.querySelector(
        `[data-edge="${dragSide.current}"]`
      );
      setDragging(dragSide.current);
    };

    const handles = [dragRefX.current, dragRefY.current, dragRefXY.current];
    handles.forEach((el) => el?.addEventListener('mousedown', onStart));
    return () => handles.forEach((el) => el?.removeEventListener('mousedown', onStart));
  }, [resize, scale]);

  const dimensions = useMemo(() => {
    const [, nx = '', ux = 'px'] = width.match(/^(\d+(?:\.\d+)?)(\%|[a-z]{1,4})?$/) || [];
    const [, ny = '', uy = 'px'] = height.match(/^(\d+(?:\.\d+)?)(\%|[a-z]{1,4})?$/) || [];
    return {
      frame: {
        width: `calc(${width} * ${scale})`,
        height: `calc(${height} * ${scale})`,
      },
      display: {
        width: `${nx || width}${ux === 'px' ? '' : ux}`,
        height: `${ny || height}${uy === 'px' ? '' : uy}`,
      },
      locked: {
        width: !nx,
        height: !ny,
      },
    };
  }, [width, height, scale]);

  return (
    <ViewportWrapper key={id} active={active} isDefault={isDefault}>
      {!isDefault && (
        <ViewportControls>
          <ViewportDimensions>
            <SizeInput
              aria-label="Viewport width"
              data-size-input="width"
              label="Viewport width"
              before={
                <ActionList.Action size="small" readOnly aria-hidden>
                  W
                </ActionList.Action>
              }
              value={width}
              minValue={0}
              setValue={(value) => resize(value, height)}
              disabled={dimensions.locked.width}
            />
            <ActionList.Button
              key="viewport-rotate"
              size="small"
              padding="small"
              ariaLabel="Rotate viewport"
              onClick={rotate}
            >
              <TransferIcon />
            </ActionList.Button>
            <SizeInput
              aria-label="Viewport height"
              data-size-input="height"
              label="Viewport height"
              before={
                <ActionList.Action size="small" readOnly aria-hidden>
                  H
                </ActionList.Action>
              }
              value={height}
              minValue={0}
              setValue={(value) => resize(width, value)}
              disabled={dimensions.locked.height}
            />
            {isCustom && lastSelectedOption && (
              <ActionList.Button
                key="viewport-restore"
                size="small"
                padding="small"
                ariaLabel="Restore viewport"
                onClick={() => select(lastSelectedOption)}
              >
                <UndoIcon />
              </ActionList.Button>
            )}
          </ViewportDimensions>
        </ViewportControls>
      )}
      <FrameWrapper
        isDefault={isDefault}
        data-dragging={dragging}
        data-scale={scale}
        style={isDefault ? { height: '100%', width: '100%' } : dimensions.frame}
        ref={targetRef}
      >
        <div
          style={{
            height: `${(1 / scale) * 100}%`,
            width: `${(1 / scale) * 100}%`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <IFrame allowFullScreen active={active} key={id} id={id} title={id} src={src} scale={1} />
          {!isDefault && (
            <>
              <ScrollEdge data-edge="right" />
              <ScrollEdge data-edge="bottom" />
              <ScrollEdge data-edge="both" />
            </>
          )}
        </div>
        {!dimensions.locked.width && (
          <DragHandle
            ref={dragRefX}
            isDefault={isDefault}
            data-side="right"
            data-value={dimensions.display.width}
          />
        )}
        {!dimensions.locked.height && (
          <DragHandle
            ref={dragRefY}
            isDefault={isDefault}
            data-side="bottom"
            data-value={dimensions.display.height}
          />
        )}
        {!dimensions.locked.width && !dimensions.locked.height && (
          <DragHandle ref={dragRefXY} isDefault={isDefault} data-side="both" />
        )}
      </FrameWrapper>
    </ViewportWrapper>
  );
};
