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
  /** Unique identifier for the highlight, required if you want to remove the highlight later */
  id?: string;
  /** HTML selectors of the elements */
  selectors: string[];
  /** CSS styles to apply to the highlight */
  styles: Record<string, string>;
  /** Priority of the highlight, higher takes precedence, defaults to 0 */
  priority?: number;
  /** Whether the highlight is selectable / hoverable */
  selectable?: boolean;
  /** CSS styles to apply to the highlight when it is selected or hovered */
  selectedStyles?: Record<string, string>;
  /** Keyframes required for animations */
  keyframes?: string;
  /** Menu items to show when the highlight is selected, or true to show the element's HTML */
  menuItems?: {
    id: string;
    title: string;
    description?: string;
    right?: string;
    href?: string;
    clickEvent?: string;
    selectors?: string[];
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

export type RawHighlightInfo = HighlightInfo | LegacyHighlightInfo;

export type Highlight = {
  id: string;
  priority: number;
  selectors: string[];
  styles: Record<string, string>;
  selectable: boolean;
  selectedStyles?: Record<string, string>;
  menuItems?: HighlightInfo['menuItems'];
};

export type Box = {
  element: HTMLElement;
  selectors: Highlight['selectors'];
  styles: Highlight['styles'];
  selectable?: Highlight['selectable'];
  selectedStyles?: Highlight['selectedStyles'];
  menuItems?: Highlight['menuItems'];
  top: number;
  left: number;
  width: number;
  height: number;
};
