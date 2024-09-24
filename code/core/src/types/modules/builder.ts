/* eslint-disable @typescript-eslint/naming-convention */
export interface BuilderStats {
  //
  toJson: () => any;
}

export type Builder_WithRequiredProperty<Type, Key extends keyof Type> = Type & {
  [Property in Key]-?: Type[Property];
};

export type Builder_Unpromise<T extends Promise<any>> = T extends Promise<infer U> ? U : never;

export type Builder_EnvsRaw = Record<string, string>;
