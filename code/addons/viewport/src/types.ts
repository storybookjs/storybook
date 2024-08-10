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

export type GlobalState = { value: string | undefined; isRotated: boolean };
export type GlobalStateUpdate = Partial<GlobalState>;
