import { type Dispatch, type RefObject, type SetStateAction, useEffect, useRef } from 'react';

import {
  MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX,
  TOOLBAR_HEIGHT_PX,
} from '../../../../core/src/manager/constants.ts';

const SNAP_THRESHOLD_PX = 30;
const STIFFNESS = 0.9;
const KEYBOARD_STEP_PX = 10;
const KEYBOARD_SHIFT_MULTIPLIER = 5;
const RESIZE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const interpolate = (relativeValue: number, min: number, max: number) =>
  min + (max - min) * relativeValue;

const computePanelMaxSize = () => {
  if (typeof window === 'undefined') {
    return 0;
  }
  return Math.max(window.innerHeight - TOOLBAR_HEIGHT_PX, 0);
};

export const useReviewPanelDrag = ({
  panelHeight,
  setPanelHeight,
  isDragging,
  setIsDragging,
  previewFrameRef,
}: {
  panelHeight: number;
  setPanelHeight: Dispatch<SetStateAction<number>>;
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  previewFrameRef: RefObject<HTMLIFrameElement>;
}) => {
  const panelResizerRef = useRef<HTMLDivElement>(null);
  const panelMaxSize = computePanelMaxSize();

  useEffect(() => {
    const panelResizer = panelResizerRef.current;
    const previewIframe = previewFrameRef.current;
    if (!panelResizer) {
      return undefined;
    }

    const onDragEnd = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', onDragEnd);
      previewIframe?.removeAttribute('style');
    };

    const onDrag = (e: MouseEvent) => {
      if (e.buttons === 0) {
        onDragEnd();
        return;
      }

      const panelDragSize = e.view ? e.view.innerHeight - e.clientY : 0;
      const maxSize = computePanelMaxSize();

      if (panelDragSize === panelHeight) {
        return;
      }
      if (panelDragSize <= SNAP_THRESHOLD_PX) {
        setPanelHeight(0);
        return;
      }
      if (panelDragSize <= MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX) {
        setPanelHeight(interpolate(STIFFNESS, panelDragSize, MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX));
        return;
      }
      setPanelHeight(clamp(panelDragSize, MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX, maxSize));
    };

    const onDragStart = (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', onDragEnd);
      if (previewIframe) {
        previewIframe.style.pointerEvents = 'none';
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!RESIZE_KEYS.includes(e.key)) {
        return;
      }
      e.preventDefault();
      const step = e.shiftKey ? KEYBOARD_STEP_PX * KEYBOARD_SHIFT_MULTIPLIER : KEYBOARD_STEP_PX;
      const maxSize = computePanelMaxSize();

      switch (e.key) {
        case 'ArrowUp':
          setPanelHeight((current) =>
            clamp(current + step, MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX, maxSize)
          );
          break;
        case 'ArrowDown':
          setPanelHeight((current) => {
            const next = clamp(current - step, 0, maxSize);
            return next < MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX ? 0 : next;
          });
          break;
        case 'Home':
          setPanelHeight(0);
          break;
        case 'End':
          setPanelHeight(maxSize);
          break;
        default:
          break;
      }
    };

    panelResizer.addEventListener('mousedown', onDragStart);
    panelResizer.addEventListener('keydown', onKeyDown);

    return () => {
      panelResizer.removeEventListener('mousedown', onDragStart);
      panelResizer.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', onDragEnd);
    };
  }, [panelHeight, previewFrameRef, setIsDragging, setPanelHeight]);

  return { panelResizerRef, panelMaxSize, isDragging };
};
