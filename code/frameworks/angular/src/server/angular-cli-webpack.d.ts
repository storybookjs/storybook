import { BuilderContext } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';

export declare function getWebpackConfig(
  baseConfig: any,
  options: { builderOptions: JsonObject; builderContext: BuilderContext }
): any;
