/* eslint-env browser */
import { global } from '@storybook/global';
import { addons } from 'storybook/internal/preview-api';
import { STORY_CHANGED } from 'storybook/internal/core-events';
import { HIGHLIGHT, RESET_HIGHLIGHT, HIGHLIGHT_STYLE_ID } from './constants';

const { document } = global;

type OutlineStyle = 'dotted' | 'dashed' | 'solid' | 'double';

const highlightStyle = (color = '#FF4785', style: OutlineStyle = 'dashed') => `
  outline: 2px ${style} ${color};
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(255,255,255,0.6);
`;

interface HighlightInfo {
  /** html selector of the element */
  elements: string[];
  color: string;
  style: OutlineStyle;
}

const channel = addons.getChannel();

const highlight = (infos: HighlightInfo) => {
  const id = HIGHLIGHT_STYLE_ID;
  resetHighlight();

  // Make sure there are no duplicated selectors
  const elements = Array.from(new Set(infos.elements));

  const sheet = document.createElement('style');
  sheet.setAttribute('id', id);
  sheet.innerHTML = elements
    .map(
      (target) =>
        `${target}{
          ${highlightStyle(infos.color, infos.style)}
         }`
    )
    .join(' ');
  document.head.appendChild(sheet);
};

const resetHighlight = () => {
  const id = HIGHLIGHT_STYLE_ID;
  const sheetToBeRemoved = document.getElementById(id);
  if (sheetToBeRemoved) {
    sheetToBeRemoved.parentNode?.removeChild(sheetToBeRemoved);
  }
};

channel.on(STORY_CHANGED, resetHighlight);
channel.on(RESET_HIGHLIGHT, resetHighlight);
channel.on(HIGHLIGHT, highlight);
