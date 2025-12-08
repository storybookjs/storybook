import React, { useEffect, useRef, useState } from 'react';

import { ActionList, PopoverProvider } from 'storybook/internal/components';

import { TransferIcon, UndoIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { useViewport } from '../../../viewport/useViewport';
import { iconsMap } from '../../../viewport/viewportIcons';
import { IFrame } from './Iframe';
import { SizeInput } from './SizeInput';

type DragSide = 'both' | 'bottom' | 'right';

const ViewportWrapper = styled.div<{
  active: boolean;
  isDefault: boolean;
}>(({ active, isDefault }) => ({
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
}));

const ViewportControls = styled.div({
  display: 'flex',
  gap: 6,
});

const ViewportDimensions = styled.div({
  display: 'flex',
  gap: 2,
});

const Dimensions = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 2,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1 - 1,
  fontWeight: theme.typography.weight.regular,
  color: theme.textMutedColor,
}));

const FrameWrapper = styled.div<{
  isDefault: boolean;
  'data-dragging': DragSide | undefined;
}>(({ isDefault, 'data-dragging': dragging, theme }) => ({
  position: 'relative',
  border: `1px solid ${theme.button.border}`,
  borderWidth: isDefault ? 0 : 1,
  borderRadius: isDefault ? 0 : 4,
  transition: 'border-color 0.2s, box-shadow 0.2s',
  '&:has([data-side="right"]:hover), &[data-dragging="right"]': {
    borderRightColor: theme.color.secondary,
    boxShadow: `4px 0 5px -2px ${theme.background.hoverable}`,
  },
  '&:has([data-side="bottom"]:hover), &[data-dragging="bottom"]': {
    borderBottomColor: theme.color.secondary,
    boxShadow: `0 4px 5px -2px ${theme.background.hoverable}`,
  },
  '&:has([data-side="both"]:hover), &[data-dragging="both"]': {
    boxShadow: `3px 3px 5px -2px ${theme.background.hoverable}`,
    '&::after': {
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
    borderRadius: 'inherit',
    pointerEvents: dragging ? 'none' : 'auto',
  },
}));

const DragHandle = styled.div<{
  'data-side': DragSide;
}>(
  { position: 'absolute' },
  ({ 'data-side': side }) =>
    side === 'both' && {
      right: -12,
      bottom: -12,
      width: 25,
      height: 25,
      cursor: 'nwse-resize',
    },
  ({ 'data-side': side }) =>
    side === 'bottom' && {
      left: 0,
      right: 13,
      bottom: -12,
      height: 20,
      cursor: 'row-resize',
    },
  ({ 'data-side': side }) =>
    side === 'right' && {
      top: 0,
      right: -12,
      bottom: 13,
      width: 20,
      cursor: 'col-resize',
    }
);

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
  const {
    name,
    type,
    width,
    height,
    option,
    isCustom,
    isDefault,
    isLocked,
    options,
    lastSelectedOption,
    resize,
    rotate,
    select,
  } = useViewport();

  const [dragging, setDragging] = useState<DragSide | undefined>(undefined);
  const targetRef = useRef<HTMLDivElement>(null);
  const dragRefX = useRef<HTMLDivElement>(null);
  const dragRefY = useRef<HTMLDivElement>(null);
  const dragRefXY = useRef<HTMLDivElement>(null);
  const dragSide = useRef<DragSide>('both');
  const dragStart = useRef<[number, number] | undefined>();

  useEffect(() => {
    const onDrag = (e: MouseEvent) => {
      if (dragSide.current === 'right' || dragSide.current === 'both') {
        targetRef.current!.style.width = `${dragStart.current![0] + e.clientX}px`;
      }
      if (dragSide.current === 'bottom' || dragSide.current === 'both') {
        targetRef.current!.style.height = `${dragStart.current![1] + e.clientY}px`;
      }
    };

    const onEnd = () => {
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('mousemove', onDrag);
      setDragging(undefined);
      resize(targetRef.current!.style.width, targetRef.current!.style.height);
      dragStart.current = undefined;
    };

    const onStart = (e: MouseEvent) => {
      e.preventDefault();
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('mousemove', onDrag);
      dragSide.current = (e.currentTarget as HTMLElement).dataset.side as DragSide;
      dragStart.current = [
        (targetRef.current?.offsetWidth ?? 0) - e.clientX,
        (targetRef.current?.offsetHeight ?? 0) - e.clientY,
      ];
      setDragging(dragSide.current);
    };

    const handles = [dragRefX.current, dragRefY.current, dragRefXY.current];
    handles.forEach((el) => el?.addEventListener('mousedown', onStart));
    return () => handles.forEach((el) => el?.removeEventListener('mousedown', onStart));
  }, [resize]);

  return (
    <ViewportWrapper key={id} active={active} isDefault={isDefault}>
      {!isDefault && (
        <ViewportControls>
          <PopoverProvider
            offset={4}
            padding={0}
            popover={() => (
              <ActionList style={{ minWidth: 240 }}>
                {Object.entries(options).map(([key, { name, styles, type = 'other' }]) => (
                  <ActionList.Item key={key} active={key === option}>
                    <ActionList.Action ariaLabel={false} onClick={() => select(key)}>
                      <ActionList.Icon>{iconsMap[type]}</ActionList.Icon>
                      <ActionList.Text>{name}</ActionList.Text>
                      <Dimensions>
                        <span>{styles.width.replace('px', '')}</span>
                        <span>&times;</span>
                        <span>{styles.height.replace('px', '')}</span>
                      </Dimensions>
                    </ActionList.Action>
                  </ActionList.Item>
                ))}
              </ActionList>
            )}
          >
            <ActionList.Button
              size="small"
              variant="outline"
              disabled={isLocked}
              readOnly={isLocked}
            >
              <ActionList.Icon>{iconsMap[type]}</ActionList.Icon>
              <ActionList.Text>{name}</ActionList.Text>
            </ActionList.Button>
          </PopoverProvider>

          <ViewportDimensions>
            <SizeInput
              label="Viewport width:"
              prefix="W"
              value={width}
              setValue={(value) => resize(value, height)}
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
              label="Viewport height:"
              prefix="H"
              value={height}
              setValue={(value) => resize(width, value)}
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
        style={{ width, height }}
        ref={targetRef}
      >
        <IFrame
          active={active}
          key={id}
          id={id}
          title={id}
          src={src}
          allowFullScreen
          scale={scale}
        />
        <DragHandle data-side="right" ref={dragRefX} />
        <DragHandle data-side="bottom" ref={dragRefY} />
        <DragHandle data-side="both" ref={dragRefXY} />
      </FrameWrapper>
    </ViewportWrapper>
  );
};
