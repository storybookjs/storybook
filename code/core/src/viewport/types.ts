export interface Viewport {
  name: string;
  styles: ViewportStyles;
  type?: 'desktop' | 'mobile' | 'tablet' | 'other';
}

export interface ViewportStyles {
  height: string;
  width: string;
}

export type ViewportMap = Record<string, Viewport>;

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
  isRotated?: boolean;
};

export type GlobalStateUpdate = Partial<GlobalState>;

export interface ViewportParameters {
  /**
   * Viewport configuration
   *
   * @see https://storybook.js.org/docs/essentials/viewport#parameters
   */
  viewport?: {
    /**
     * Removes the tool and disables the feature's behavior. If you wish to turn off this feature
     * for the entire Storybook, you can set the option in your `main.js|ts` configuration file.
     *
     * @see https://storybook.js.org/docs/essentials/viewport#disable
     */
    disable?: boolean;

    /**
     * Specify the available viewports. The width and height values must include the unit, e.g.
     * '320px'.
     */
    options: Record<string, Viewport>;
  };
}

export interface ViewportGlobals {
  /**
   * Viewport configuration
   *
   * @see https://storybook.js.org/docs/essentials/viewport#globals
   */
  viewport?: GlobalState | GlobalState['value'];
}

export interface ViewportTypes {
  parameters: ViewportParameters;
  globals: ViewportGlobals;
}
