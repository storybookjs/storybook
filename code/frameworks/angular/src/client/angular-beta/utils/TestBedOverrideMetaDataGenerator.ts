import { Component, NgModule, Type } from '@angular/core';
import { MetadataOverride } from '@angular/core/testing';

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

  if (schemas != null && schemas.length != 0) {
    overrideMetadata.add.schemas = schemas;
  }

  return overrideMetadata;
};

export const GenerateModuleMetaData = (
  environmentProvider: any[],
  declarations: any[],
  imports: any[]
) => {
  return {
    add: {
      exports: [...declarations, ...imports],
      declarations: declarations,
      imports: imports,
      providers: environmentProvider,
    },
  } as MetadataOverride<NgModule>;
};
