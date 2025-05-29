import {
  Parameters as DefaultParameters,
  StoryContext as DefaultStoryContext,
  WebRenderer,
} from 'storybook/internal/types';
import { ExtraOptions, Routes } from '@angular/router';
import { EnvironmentProviders, Provider } from '@angular/core';

export interface NgModuleMetadata {
  /** List of components, directives, and pipes that belong to your component. */
  declarations?: any[];
  entryComponents?: any[];
  routing?: RoutingConfig;
  /**
   * List of modules that should be available to the root Storybook Component and all its children.
   * If you want to register application providers or if you want to use the forRoot() pattern,
   * please use the `applicationConfig` decorator in combination with the importProvidersFrom helper
   * function from @angular/core instead.
   */
  imports?: any[];
  schemas?: any[];
  /**
   * List of providers that should be available on the root component and all its children. Use the
   * `applicationConfig` decorator to register environemt and application-wide providers.
   */
  providers?: Provider[];
}
export interface ICollection {
  [p: string]: any;
}

export interface ApplicationConfig {
  providers?: Array<Provider | EnvironmentProviders>;
  routing?: RoutingConfig;
}

export interface RoutingConfig {
  routes?: Routes;
  options?: ExtraOptions;
}

export interface StoryFnAngularReturnType {
  props?: ICollection;
  moduleMetadata?: NgModuleMetadata;
  applicationConfig?: ApplicationConfig;
  template?: string;
  styles?: string[];
  userDefinedTemplate?: boolean;
}

export interface AngularRenderer extends WebRenderer {
  component: any;
  storyResult: StoryFnAngularReturnType;
}

export type Parameters = DefaultParameters & {
  bootstrapModuleOptions?: unknown;
  useTestBedRenderer?: boolean;
};

export type StoryContext = DefaultStoryContext<AngularRenderer> & { parameters: Parameters };
