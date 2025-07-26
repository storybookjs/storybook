import type { Component, ModuleWithProviders, NgModule, Type } from '@angular/core';
import type { MetadataOverride } from '@angular/core/testing';

export const GenerateComponentMetaData = (
  selector: string,
  componentProvider: any[],
  styles: string[],
  schemas: any[],
  wrapperModule: Type<any>
) => {
  const overrideMetadata = {
    add: {
      providers: componentProvider ?? [],
      styles: styles ?? [],
      selector: selector,
      imports: [wrapperModule],
    },
  } as MetadataOverride<Component>;

  if (schemas !== null && schemas !== undefined && schemas.length !== 0) {
    overrideMetadata.add.schemas = schemas;
  }

  return overrideMetadata;
};

export const GenerateModuleMetaData = (
  environmentProvider: any[],
  declarations: any[],
  imports: any[]
) => {
  const moduleWithProviders = imports.filter(isModuleWithProviders) as ModuleWithProviders<any>[];
  const plainModules = imports.filter((imp) => !isModuleWithProviders(imp));
  return {
    add: {
      exports: [...declarations, ...moduleWithProviders.map((x) => x.ngModule), ...plainModules],
      declarations: declarations,
      imports: [...moduleWithProviders.map((x) => x.ngModule), ...plainModules],
      providers: [...environmentProvider, ...moduleWithProviders.flatMap((x) => x.providers)],
    },
  } as MetadataOverride<NgModule>;
};

function isModuleWithProviders(obj: any): obj is ModuleWithProviders<any> {
  return obj && typeof obj === 'object' && 'ngModule' in obj;
}
