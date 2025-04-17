/* eslint-env browser */
import { STORY_CHANGED } from 'storybook/internal/core-events';

import { addons, definePreview } from 'storybook/preview-api';

import { HIGHLIGHT, RESET_HIGHLIGHT, SCROLL_INTO_VIEW } from './constants';

interface HighlightOptions {
  /** HTML selectors of the elements */
  elements: string[];
  /** Color of the outline */
  color?: string;
  /** Style of the outline */
  style?: 'dotted' | 'dashed' | 'solid' | 'double';
  /** Width of the outline */
  width?: string;
  /** Offset of the outline */
  offset?: string;
  /**
   * Duration in milliseconds of the fade out animation. Note you must use a 6-character hex color
   * to use this option.
   */
  fadeOut?: number;
  /**
   * Duration in milliseconds of the pulse out animation. Note you must use a 6-character hex color
   * to use this option.
   */
  pulseOut?: number;
}

if (addons && addons.ready && typeof globalThis.document !== 'undefined') {
  const highlightStyle = (
    selectors: string[],
    {
      color = '#FF4785',
      style = 'solid',
      width = '1px',
      offset = '2px',
      fadeOut = 0,
      pulseOut = 0,
    }: HighlightOptions
  ) => {
    const animationName = Math.random().toString(36).substring(2, 15);
    let keyframes = '';
    if (pulseOut) {
      keyframes = `@keyframes ${animationName} {
        0% { outline: ${width} ${style} ${color}; }
        20% { outline: ${width} ${style} ${color}00; }
        40% { outline: ${width} ${style} ${color}; }
        60% { outline: ${width} ${style} ${color}00; }
        80% { outline: ${width} ${style} ${color}; }
        100% { outline: ${width} ${style} ${color}00; }
      }\n`;
    } else if (fadeOut) {
      keyframes = `@keyframes ${animationName} {
        0% { outline: ${width} ${style} ${color}; }
        100% { outline: ${width} ${style} ${color}00; }
      }\n`;
    }

    return `${keyframes}${selectors.join(', ')} {
      outline: ${width} ${style} ${color};
      outline-offset: ${offset};
      ${pulseOut || fadeOut ? `animation: ${animationName} ${pulseOut || fadeOut}ms linear forwards;` : ''}
    }`;
  };
  addons.ready().then(() => {
    const channel = addons.getChannel();
    const sheetIds = new Set<string>();

    const highlight = (options: HighlightOptions) => {
      const sheetId = Math.random().toString(36).substring(2, 15);
      sheetIds.add(sheetId);

      const sheet = document.createElement('style');
      sheet.innerHTML = highlightStyle(Array.from(new Set(options.elements)), options);
      sheet.setAttribute('id', sheetId);
      document.head.appendChild(sheet);

      const timeout = options.pulseOut || options.fadeOut;
      if (timeout) {
        setTimeout(() => removeHighlight(sheetId), timeout + 500);
      }
    };

    const removeHighlight = (id: string) => {
      const sheetElement = document.getElementById(id);
      sheetElement?.parentNode?.removeChild(sheetElement);
      sheetIds.delete(id);
    };

    const resetHighlight = () => {
      sheetIds.forEach(removeHighlight);
    };

    const scrollIntoView = (target: string, options?: ScrollIntoViewOptions) => {
      const element = document.querySelector(target);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center', ...options });
      highlight({
        elements: [target],
        color: '#1EA7FD',
        width: '2px',
        offset: '2px',
        pulseOut: 3000,
      });
    };

    channel.on(STORY_CHANGED, resetHighlight);
    channel.on(SCROLL_INTO_VIEW, scrollIntoView);
    channel.on(RESET_HIGHLIGHT, resetHighlight);
    channel.on(HIGHLIGHT, highlight);
  });
}
export default () => definePreview({});
