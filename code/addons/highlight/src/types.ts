import type { CSSProperties } from 'react';

export interface HighlightParameters {
  /**
   * Highlight configuration
   *
   * @see https://storybook.js.org/docs/essentials/highlight#parameters
   */
  highlight: {
    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;
  };
}

export interface HighlightInfo {
  /** HTML selectors of the elements */
  selectors: string[];
  /** CSS styles to apply to the highlight */
  styles: CSSProperties;
  /** Whether the highlight is selectable / hoverable */
  selectable?: boolean;
  /** CSS styles to apply to the highlight when it is selected or hovered */
  selectedStyles?: CSSProperties;
  /** Keyframes required for animations */
  keyframes?: string;
  /** Menu items to show when the highlight is selected, or true to show the element's HTML */
  menuListItems?: {
    id: string;
    title: string;
    center?: string;
    right?: string;
    href?: string;
    clickEvent?: string;
  }[];
}

// Legacy format
export interface LegacyHighlightInfo {
  /** @deprecated Use selectors instead */
  elements: string[];
  /** @deprecated Use styles instead */
  color: string;
  /** @deprecated Use styles instead */
  style: 'dotted' | 'dashed' | 'solid' | 'double';
}

export type Highlight = HighlightInfo | LegacyHighlightInfo;

export type Box = {
  element: Element;
  styles: HighlightInfo['styles'];
  selectable?: HighlightInfo['selectable'];
  selectedStyles?: HighlightInfo['selectedStyles'];
  menuListItems?: HighlightInfo['menuListItems'];
  top: number;
  left: number;
  width: number;
  height: number;
};
