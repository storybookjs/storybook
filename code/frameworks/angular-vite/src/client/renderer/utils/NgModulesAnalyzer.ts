import { NgModule, ɵReflectionCapabilities as ReflectionCapabilities } from '@angular/core';

const reflectionCapabilities = new ReflectionCapabilities();

/**
 * Avoid component redeclaration
 *
 * Checks recursively if the component has already been declared in all import Module
 */
export const isComponentAlreadyDeclared = (
  componentToFind: any,
  moduleDeclarations: any[],
  moduleImports: any[]
): boolean => {
  if (
    moduleDeclarations &&
    moduleDeclarations.flat().some((declaration) => declaration === componentToFind)
  ) {
    // Found component in declarations array
    return true;
  }
  if (!moduleImports) {
    return false;
  }

  return moduleImports.flat().some((importItem) => {
    const extractedNgModuleMetadata = extractNgModuleMetadata(importItem);
    if (!extractedNgModuleMetadata) {
      // Not an NgModule
      return false;
    }
    return isComponentAlreadyDeclared(
      componentToFind,
      extractedNgModuleMetadata.declarations,
      extractedNgModuleMetadata.imports
    );
  });
};

const extractNgModuleMetadata = (importItem: any): NgModule => {
  const target = importItem && importItem.ngModule ? importItem.ngModule : importItem;
  const decorators = reflectionCapabilities.annotations(target);

  if (!decorators || decorators.length === 0) {
    return null;
  }

  const ngModuleDecorator: NgModule | undefined = decorators.find(
    (decorator) => decorator instanceof NgModule
  );
  if (!ngModuleDecorator) {
    return null;
  }
  return ngModuleDecorator;
};
