export interface BuilderStats {
  //
  toJson: () => any;
  turbosnapOutput?: TurbosnapOutputDraft;
}

/** Build output evidence used to validate selective configuration coverage. */
export interface TurbosnapOutputDraft {
  status: 'complete' | 'incomplete';
  reason: string;
  builder: { name: '@storybook/builder-vite' | '@storybook/builder-webpack5'; version: string };
  outputFiles: Record<string, string>;
  globalOutputHash: string;
  storyOutputHashes: Record<string, string>;
}

/** Final output and configuration bindings serialized in preview stats. */
export interface TurbosnapOutput extends TurbosnapOutputDraft {
  version: 1;
  projectRoot: string;
  configDir: string;
  modulesHash: string;
  configFiles: Record<string, { hash: string; realPath: string }>;
}

export type Builder_WithRequiredProperty<Type, Key extends keyof Type> = Type & {
  [Property in Key]-?: Type[Property];
};

export type Builder_Unpromise<T extends Promise<any>> = T extends Promise<infer U> ? U : never;

export type Builder_EnvsRaw = Record<string, string>;
