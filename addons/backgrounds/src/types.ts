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
