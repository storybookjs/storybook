// TODO: remove the function type from styles in 9.0
export type Styles = ViewportStyles | ((s: ViewportStyles | undefined) => ViewportStyles) | null;

export interface Viewport {
  name: string;
  styles: Styles;
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
}
export interface ModernViewport {
  name: string;
  styles: ViewportStyles;
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
}

export interface ViewportStyles {
  height: string;
  width: string;
}

export type ViewportMap = Record<string, Viewport>;

export interface Config {
  options: Record<string, ModernViewport>;
  disable: boolean;
}

export type GlobalState = {
  /**
   * When set, the viewport is applied and cannot be changed using the toolbar. Must match the key
   * of one of the available viewports.
   */
  value: string | undefined;

  /**
   * When true the viewport applied will be rotated 90°, e.g. it will rotate from portrait to
   * landscape orientation.
   */
  isRotated: boolean;
};
export type GlobalStateUpdate = Partial<GlobalState>;

export interface ViewportParameters {
  /**
   * Viewport configuration
   *
   * @see https://storybook.js.org/docs/essentials/viewport#parameters
   */
  viewport: {
    /**
     * Specifies the default orientation used when viewing a story. Only available if you haven't
     * enabled the globals API.
     */
    defaultOrientation?: 'landscape' | 'portrait';

    /**
     * Specifies the default viewport used when viewing a story. Must match a key in the viewports
     * (or options) object.
     */
    defaultViewport?: string;

    /**
     * Remove the addon panel and disable the addon's behavior . If you wish to turn off this addon
     * for the entire Storybook, you should do so when registering addon-essentials
     *
     * @see https://storybook.js.org/docs/essentials/index#disabling-addons
     */
    disabled?: boolean;

    /**
     * Specify the available viewports. The width and height values must include the unit, e.g.
     * '320px'.
     */
    viewports?: Viewport; // TODO: use ModernViewport in 9.0
  };
}

export interface ViewportGlobals {
  /**
   * Viewport configuration
   *
   * @see https://storybook.js.org/docs/essentials/viewport#globals
   */
  viewport: {
    [key: string]: GlobalState;
  };
}
