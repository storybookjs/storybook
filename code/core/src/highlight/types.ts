import type { IconName } from './icons.ts';

export interface HighlightTypes {
  parameters: HighlightParameters;
}

export interface HighlightParameters {
  /**
   * Highlight configuration
   *
   * @see https://storybook.js.org/docs/essentials/highlight#parameters
   */
  highlight?: {
    /**
     * Removes the tool and disables the feature's behavior. If you wish to turn off this feature
     * for the entire Storybook, you can set the option in your `main.js|ts` configuration file.
     *
     * @see https://storybook.js.org/docs/essentials/highlight#disable
     */
    disable?: boolean;
  };
}

export interface HighlightMenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Title of the menu item */
  title: string;
  /** Description of the menu item */
  description?: string;
  /** Icon for the menu item, left side */
  iconLeft?: IconName;
  /** Icon for the menu item, right side */
  iconRight?: IconName;
  /**
   * Render the item as a button. Clicking it emits `HIGHLIGHT_MENU_CLICK` with the highlight `id`,
   * the item `id` and the `ClickEventDetails` of the clicked element.
   */
  clickable?: boolean;
  /** HTML selectors for which this menu item should show (subset of `selectors`) */
  selectors?: HighlightOptions['selectors'];
}

export interface HighlightOptions {
  /** Unique identifier for the highlight, used to remove it later and to attribute menu clicks */
  id: string;
  /** HTML selectors of the elements */
  selectors: string[];
  /** Priority of the highlight, higher takes precedence, defaults to 0 */
  priority?: number;
  /** CSS styles to apply to the highlight */
  styles?: Record<string, string>;
  /** CSS styles to apply to the highlight when it is hovered */
  hoverStyles?: Record<string, string>;
  /** CSS styles to apply to the highlight when it is focused or selected */
  focusStyles?: Record<string, string>;
  /** Keyframes required for animations */
  keyframes?: string;
  /** Groups of menu items to show when the highlight is selected */
  menu?: HighlightMenuItem[][];
}

export interface ClickEventDetails {
  top: number;
  left: number;
  width: number;
  height: number;
  selectors: string[];
  element: {
    localName: string;
    tagName: string;
  };
}

export type Highlight = {
  id: string;
  priority: number;
  selectors: string[];
  styles: Record<string, string>;
  hoverStyles?: Record<string, string>;
  focusStyles?: Record<string, string>;
  menu?: HighlightMenuItem[][];
};

export type Box = {
  element: HTMLElement;
  id: Highlight['id'];
  selectors: Highlight['selectors'];
  styles: Highlight['styles'];
  hoverStyles?: Highlight['hoverStyles'];
  focusStyles?: Highlight['focusStyles'];
  menu?: Highlight['menu'];
  top: number;
  left: number;
  width: number;
  height: number;
};

/** A single clickable target in the highlight menu, as sent from the preview to the manager. */
export type HighlightMenuTarget = {
  /** The id of the highlight the target belongs to, used to attribute `HIGHLIGHT_MENU_CLICK`s */
  id: Highlight['id'];
  /**
   * A short, non-content label identifying the element (e.g. `div#id.class`), rendered in the
   * manager menu's element list. Derived from the tag name, id and class names only, so the
   * preview never sends renderable DOM content over the channel.
   */
  label: string;
  details: ClickEventDetails;
};

/**
 * Payload of the internal `HIGHLIGHT_MENU` event (preview → manager). `coords` are relative to the
 * preview iframe's viewport; an empty `targets` array hides the menu.
 */
export type HighlightMenuState = {
  targets: HighlightMenuTarget[];
  selected: number | null;
  coords: { x: number; y: number } | null;
};

/** Payload of the internal `HIGHLIGHT_MENU_INTERACTION` event (manager → preview). */
export type HighlightMenuInteraction =
  | { action: 'select' | 'focus'; index: number }
  | { action: 'deselect' | 'blur' };
