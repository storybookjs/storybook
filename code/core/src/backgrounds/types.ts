import type { PARAM_KEY } from './constants';

export interface Background {
  name: string;
  value: string;
}

export type BackgroundMap = Record<string, Background>;

export interface GridConfig {
  cellAmount: number;
  cellSize: number;
  opacity: number;
  offsetX?: number;
  offsetY?: number;
}

export type GlobalState = { value: string | undefined; grid?: boolean };
export type GlobalStateUpdate = Partial<GlobalState>;

export interface BackgroundsParameters {
  /**
   * Backgrounds configuration
   *
   * @see https://storybook.js.org/docs/essentials/backgrounds#parameters
   */
  backgrounds?: {
    /** Default background color */
    default?: string;

    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;

    /** Configuration for the background grid */
    grid?: GridConfig;

    /** Available background colors */
    options?: BackgroundMap;
  };
}

export interface BackgroundsGlobals {
  /**
   * Backgrounds configuration
   *
   * @see https://storybook.js.org/docs/essentials/backgrounds#globals
   */
  [PARAM_KEY]?: GlobalState | GlobalState['value'];
}

export interface BackgroundTypes {
  parameters: BackgroundsParameters;
  globals: BackgroundsGlobals;
}
