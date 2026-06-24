import { CommonModule } from '@angular/common';
import type { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import {
  Component,
  Directive,
  Injectable,
  InjectionToken,
  Input,
  Output,
  Pipe,
  importProvidersFrom,
  ɵReflectionCapabilities as ReflectionCapabilities,
} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  BrowserAnimationsModule,
  NoopAnimationsModule,
  provideAnimations,
  provideNoopAnimations,
} from '@angular/platform-browser/animations';
import { dedent } from 'ts-dedent';

import type { NgModuleMetadata } from '../../types.ts';
import { isComponentAlreadyDeclared } from './NgModulesAnalyzer.ts';

export const reflectionCapabilities = new ReflectionCapabilities();
export const REMOVED_MODULES = new InjectionToken('REMOVED_MODULES');
export const uniqueArray = (arr: any[]) => {
  return arr
    .flat(Number.MAX_VALUE)
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);
};

export class PropertyExtractor implements NgModuleMetadata {
  declarations?: any[] = [];
  imports?: any[];
  providers?: Provider[];
  applicationProviders?: Array<Provider | ReturnType<typeof importProvidersFrom>>;

  constructor(
    private metadata: NgModuleMetadata,
    private component?: any
  ) {}

  public async init() {
    const analyzed = await this.analyzeMetadata(this.metadata);
    this.imports = uniqueArray([CommonModule, analyzed.imports]);
    this.providers = uniqueArray(analyzed.providers);
    this.applicationProviders = uniqueArray(analyzed.applicationProviders);
    this.declarations = uniqueArray(analyzed.declarations);

    if (this.component) {
      const { isDeclarable, isStandalone } = PropertyExtractor.analyzeDecorators(this.component);
      const isDeclared = isComponentAlreadyDeclared(
        this.component,
        analyzed.declarations,
        this.imports
      );

      if (isStandalone) {
        this.imports.push(this.component);
      } else if (isDeclarable && !isDeclared) {
        this.declarations.push(this.component);
      }
    }
  }

  /**
   * Analyze NgModule Metadata
   *
   * - Removes Restricted Imports
   * - Extracts providers from ModuleWithProviders
   * - Returns a new NgModuleMetadata object
   */
  private analyzeMetadata = async (metadata: NgModuleMetadata) => {
    const declarations = [...(metadata?.declarations || [])];
    const providers = [...(metadata?.providers || [])];
    const applicationProviders: Array<Provider | ReturnType<typeof importProvidersFrom>> = [];
    const imports = await Promise.all(
      [...(metadata?.imports || [])].map(async (imported) => {
        const [isRestricted, restrictedProviders] =
          await PropertyExtractor.analyzeRestricted(imported);
        if (isRestricted) {
          applicationProviders.unshift(restrictedProviders || []);
          return null;
        }
        // A standalone component cannot import a ModuleWithProviders (e.g. `Module.forRoot()`).
        // Hoist its providers into the environment injector and keep importing the plain
        // NgModule so its exported directives and pipes stay available to the template.
        if (PropertyExtractor.isModuleWithProviders(imported)) {
          applicationProviders.push(importProvidersFrom(imported));
          return imported.ngModule;
        }
        return imported;
      })
    ).then((results) => results.filter(Boolean));

    return { ...metadata, imports, providers, applicationProviders, declarations };
  };

  static isModuleWithProviders = (imported: unknown): imported is ModuleWithProviders<any> => {
    return typeof imported === 'object' && imported !== null && 'ngModule' in imported;
  };

  static analyzeRestricted = (ngModule: NgModule): [boolean] | [boolean, Provider] => {
    if (ngModule === BrowserModule) {
      console.warn(
        dedent`
          Storybook Warning:
          "BrowserModule" is not needed when using bootstrapApplication — its providers are included automatically.
          Please remove "BrowserModule" from moduleMetadata.imports to remove this warning.
        `
      );
      return [true];
    }

    if (ngModule === BrowserAnimationsModule) {
      console.warn(
        dedent`
          Storybook Warning:
          "BrowserAnimationsModule" was added to moduleMetadata.imports.
          Use the 'applicationConfig' decorator from '@storybook/angular-vite' and add 'provideAnimations()' to its providers instead.
        `
      );
      return [true, provideAnimations()];
    }

    if (ngModule === NoopAnimationsModule) {
      console.warn(
        dedent`
          Storybook Warning:
          "NoopAnimationsModule" was added to moduleMetadata.imports.
          Use the 'applicationConfig' decorator from '@storybook/angular-vite' and add 'provideNoopAnimations()' to its providers instead.
        `
      );
      return [true, provideNoopAnimations()];
    }

    return [false];
  };

  static analyzeDecorators = (component: any) => {
    const decorators = reflectionCapabilities.annotations(component);

    const isComponent = decorators.some((d) => this.isDecoratorInstanceOf(d, 'Component'));
    const isDirective = decorators.some((d) => this.isDecoratorInstanceOf(d, 'Directive'));
    const isPipe = decorators.some((d) => this.isDecoratorInstanceOf(d, 'Pipe'));

    const isDeclarable = isComponent || isDirective || isPipe;

    // Check if the hierarchically lowest Component or Directive decorator (the only relevant for importing dependencies) is standalone.

    const isStandalone =
      (isComponent || isDirective) &&
      [...decorators]
        .reverse() // reflectionCapabilities returns decorators in a hierarchically top-down order
        .find(
          (d) =>
            this.isDecoratorInstanceOf(d, 'Component') || this.isDecoratorInstanceOf(d, 'Directive')
        )?.standalone;

    return { isDeclarable, isStandalone: isStandalone ?? true };
  };

  static isDecoratorInstanceOf = (decorator: any, name: string) => {
    let factory;
    switch (name) {
      case 'Component':
        factory = Component;
        break;
      case 'Directive':
        factory = Directive;
        break;
      case 'Pipe':
        factory = Pipe;
        break;
      case 'Injectable':
        factory = Injectable;
        break;
      case 'Input':
        factory = Input;
        break;
      case 'Output':
        factory = Output;
        break;
      default:
        throw new Error(`Unknown decorator type: ${name}`);
    }
    return decorator instanceof factory || decorator.ngMetadataName === name;
  };
}
