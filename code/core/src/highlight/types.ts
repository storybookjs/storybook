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

export interface HighlightOptions {
  /** Unique identifier for the highlight, required if you want to remove the highlight later */
  id?: string;
  /** HTML selectors of the elements */
  selectors: string[];
  /** Priority of the highlight, higher takes precedence, defaults to 0 */
  priority?: number;
  /** Whether the highlight is selectable (reveals the element's HTML) */
  selectable?: boolean;
  /** CSS styles to apply to the highlight */
  styles: Record<string, string>;
  /** CSS styles to apply to the highlight when it is hovered */
  hoverStyles?: Record<string, string>;
  /** CSS styles to apply to the highlight when it is focused or selected */
  focusStyles?: Record<string, string>;
  /** Keyframes required for animations */
  keyframes?: string;
  /** Menu items to show when the highlight is selected (implies selectable: true) */
  menu?: {
    /** Unique identifier for the menu item */
    id: string;
    /** Title of the menu item */
    title: string;
    /** Description of the menu item */
    description?: string;
    /** Name for a channel event to trigger when the menu item is clicked */
    clickEvent?: string;
    /** HTML selectors for which this menu item should show (subset of `selectors`) */
    selectors?: string[];
  }[];
}

// Legacy format
export interface LegacyHighlightOptions {
  /** @deprecated Use selectors instead */
  elements: string[];
  /** @deprecated Use styles instead */
  color: string;
  /** @deprecated Use styles instead */
  style: 'dotted' | 'dashed' | 'solid' | 'double';
}

export type RawHighlightOptions = HighlightOptions | LegacyHighlightOptions;

export type Highlight = {
  id: string;
  priority: number;
  selectors: string[];
  selectable: boolean;
  styles: HighlightOptions['styles'];
  hoverStyles?: HighlightOptions['hoverStyles'];
  focusStyles?: HighlightOptions['focusStyles'];
  menu?: HighlightOptions['menu'];
};

export type Box = {
  element: HTMLElement;
  selectors: Highlight['selectors'];
  selectable?: Highlight['selectable'];
  styles: Highlight['styles'];
  hoverStyles?: Highlight['hoverStyles'];
  focusStyles?: Highlight['focusStyles'];
  menu?: Highlight['menu'];
  top: number;
  left: number;
  width: number;
  height: number;
};

export type ClickEventDetails = {
  top: number;
  left: number;
  width: number;
  height: number;
  selectors: string[];
  element: {
    attributes: Record<string, string>;
    localName: string;
    tagName: string;
    outerHTML: string;
  };
};
