import React, { type CSSProperties, useEffect, useState } from 'react';

import type { Channel } from 'storybook/internal/channels';
import { STORY_CHANGED } from 'storybook/internal/core-events';

import { throttle } from 'es-toolkit';
import { styled } from 'storybook/theming';

import { HighlightMenu } from './HighlightMenu';
import { HIGHLIGHT, RESET_HIGHLIGHT, SCROLL_INTO_VIEW } from './constants';
import type { Box, Highlight, HighlightInfo } from './types';

const Rectangle = styled.div<{
  baseStyles: CSSProperties;
  selectedStyles?: CSSProperties;
  isSelectable: boolean;
  isSelected: boolean;
}>(({ baseStyles, selectedStyles, isSelected, isSelectable }) => ({
  position: 'absolute',
  boxSizing: 'border-box',
  cursor: isSelectable ? 'pointer' : 'default',
  pointerEvents: isSelectable ? 'auto' : 'none',
  ...baseStyles,
  ...(isSelected && {
    ...selectedStyles,
  }),
  ':hover': {
    ...selectedStyles,
  },
}));

const convertLegacy = (highlight: Highlight): HighlightInfo => {
  if ('elements' in highlight) {
    const { elements, color, style } = highlight;
    return {
      selectors: elements,
      styles: {
        outline: `2px ${style} ${color}`,
        outlineOffset: '2px',
        boxShadow: '0 0 0 6px rgba(255,255,255,0.6)',
      },
    };
  }
  return highlight;
};

const getElements = (highlights: HighlightInfo[]): Map<Element, HighlightInfo> => {
  const root = document.getElementById('storybook-root');
  return new Map(
    highlights.flatMap((highlight) =>
      highlight.selectors
        .flatMap((selector) => Array.from(root?.querySelectorAll(selector) || []))
        .map((element) => [element, highlight])
    )
  );
};

const getBoxes = (elements: Map<Element, HighlightInfo>): Box[] =>
  Array.from(elements.entries())
    .map(([element, { menuListItems, styles, selectedStyles, selectable = !!menuListItems }]) => {
      const { top, left, width, height } = element.getBoundingClientRect();
      const box = { top: top + window.scrollY, left: left + window.scrollX, width, height };
      return { element, menuListItems, styles, selectedStyles, selectable, ...box };
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);

export const HighlightOverlay = ({ channel }: { channel: Channel }) => {
  const [highlights, setHighlights] = useState<HighlightInfo[]>([]);
  const [elements, setElements] = useState<Map<Element, HighlightInfo>>(new Map());
  const [boxes, setBoxes] = useState<Box[]>([]);

  const [coordinates, setCoordinates] = useState<{ x: number; y: number } | undefined>();
  const [targets, setTargets] = useState<Box[]>([]);
  const [focused, setFocused] = useState<Element>();

  useEffect(() => {
    const onHighlight = (highlight: Highlight) =>
      setHighlights((value) => [...value, convertLegacy(highlight)]);
    const onReset = () => setHighlights([]);
    const onStoryChanged = () => setHighlights([]);
    const onScrollIntoView = (target: string, options?: ScrollIntoViewOptions) => {
      const element = document.querySelector(target);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center', ...options });
      setHighlights((value) => [
        ...value,
        {
          selectors: [target],
          selectable: false,
          styles: {
            outline: '2px solid #1EA7FD',
            outlineOffset: '2px',
            animation: 'pulse 3s linear forwards',
          },
          keyframes: `@keyframes pulse {
            0% { outline: 2px solid #1EA7FD; }
            20% { outline: 2px solid #1EA7FD00; }
            40% { outline: 2px solid #1EA7FD; }
            60% { outline: 2px solid #1EA7FD00; }
            80% { outline: 2px solid #1EA7FD; }
            100% { outline: 2px solid #1EA7FD00; }
          }`,
        },
      ]);
    };

    channel.on(HIGHLIGHT, onHighlight);
    channel.on(RESET_HIGHLIGHT, onReset);
    channel.on(STORY_CHANGED, onStoryChanged);
    channel.on(SCROLL_INTO_VIEW, onScrollIntoView);

    return () => {
      channel.off(HIGHLIGHT, onHighlight);
      channel.off(RESET_HIGHLIGHT, onReset);
      channel.off(STORY_CHANGED, onStoryChanged);
      channel.off(SCROLL_INTO_VIEW, onScrollIntoView);
    };
  }, [channel]);

  // Updates the tracked elements when highlights change or the DOM tree changes
  useEffect(() => {
    setElements(getElements(highlights));
    const observer = new MutationObserver(() => {
      setElements(getElements(highlights));
    });
    observer.observe(document.getElementById('storybook-root')!, {
      subtree: true,
      childList: true,
    });
    return () => observer.disconnect();
  }, [highlights]);

  // Updates the tracked highlights when elements are resized
  useEffect(() => {
    const storybookRoot = document.getElementById('storybook-root')!;
    const updateBoxes = throttle(() => setBoxes(getBoxes(elements)), 50);

    const observer = new ResizeObserver(updateBoxes);
    observer.observe(storybookRoot);
    Array.from(elements.keys()).forEach((element) => observer.observe(element));

    const scrollers = Array.from(storybookRoot.querySelectorAll('*')).filter((el) => {
      const { overflow, overflowX, overflowY } = window.getComputedStyle(el);
      return ['auto', 'scroll'].some((o) => [overflow, overflowX, overflowY].includes(o));
    });
    scrollers.forEach((element) => element.addEventListener('scroll', updateBoxes));

    return () => {
      observer.disconnect();
      scrollers.forEach((element) => element.removeEventListener('scroll', updateBoxes));
    };
  }, [elements]);

  // Updates click targets when elements are removed
  useEffect(() => {
    setTargets((t) => t.filter(({ element }) => elements.has(element)));
  }, [elements]);

  // Ensure the selected element is always an active target
  useEffect(() => {
    if (targets.length) {
      setFocused((s) => (targets.some((t) => t.element === s) ? s : targets[0]?.element));
    } else {
      setCoordinates(undefined);
      setFocused(undefined);
    }
  }, [targets]);

  useEffect(() => {
    const onClick = ({ pageX: px, pageY: py }: MouseEvent) => {
      const menu = document.getElementById('addon-highlight-menu')?.getBoundingClientRect();
      if (
        menu?.top &&
        menu?.left &&
        px >= menu.left + window.scrollX &&
        px <= menu.left + menu.width + window.scrollX &&
        py >= menu.top + window.scrollY &&
        py <= menu.top + menu.height + window.scrollY
      ) {
        return;
      }
      const results = boxes.filter(
        ({ selectable, top, left, width, height }) =>
          selectable && px >= left && px <= left + width && py >= top && py <= top + height
      );
      setCoordinates(results ? { x: px, y: py } : undefined);
      setTargets(results);
    };

    document.body.addEventListener('click', onClick);
    return () => document.body.removeEventListener('click', onClick);
  }, [boxes]);

  return (
    <>
      {coordinates && focused && (
        <HighlightMenu
          channel={channel}
          coordinates={coordinates}
          targets={targets}
          setFocused={setFocused}
        />
      )}

      {highlights.map(({ keyframes }, index) =>
        keyframes ? <style key={index}>{keyframes}</style> : null
      )}

      {boxes.map((target, index) => {
        const { element, top, left, width, height, styles, selectable, selectedStyles } = target;
        return (
          <Rectangle
            key={`${top}-${left}-${width}-${height}-${index}`}
            isSelectable={!!selectable}
            isSelected={focused === element}
            baseStyles={{ ...styles, top, left, width, height }}
            selectedStyles={selectedStyles}
          />
        );
      })}
    </>
  );
};
