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
  /** Hint to show as a tooltip when the highlight is hovered */
  hint?: string;
  /** Menu items to show when the highlight is selected (implies selectable: true) */
  menu?: {
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
  hint?: HighlightOptions['hint'];
  menu?: HighlightOptions['menu'];
};

export type Box = {
  element: HTMLElement;
  selectors: Highlight['selectors'];
  selectable?: Highlight['selectable'];
  styles: Highlight['styles'];
  hoverStyles?: Highlight['hoverStyles'];
  focusStyles?: Highlight['focusStyles'];
  hint?: Highlight['hint'];
  menu?: Highlight['menu'];
  top: number;
  left: number;
  width: number;
  height: number;
};
