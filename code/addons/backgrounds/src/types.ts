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

export interface Config {
  options: BackgroundMap;
  disable: boolean;
  grid: GridConfig;
}

export type GlobalState = { value: string | undefined; grid: boolean };
export type GlobalStateUpdate = Partial<GlobalState>;

export interface BackgroundsParameters {
  /**
   * Backgrounds configuration
   *
   * @see https://storybook.js.org/docs/essentials/backgrounds#parameters
   */
  backgrounds: {
    /** Default background color */
    default?: string;

    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;

    /** Configuration for the background grid */
    grid?: Partial<GridConfig>;

    /** Available background colors */
    values?: Array<Background>;
  };
}

export interface BackgroundsGlobals {
  /**
   * Backgrounds configuration
   *
   * @see https://storybook.js.org/docs/essentials/backgrounds#globals
   */
  backgrounds: GlobalState;
}
