import { Component, NgModule } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { isComponentAlreadyDeclared } from './NgModulesAnalyzer';

const FooComponent = Component({})(class {});

const BarComponent = Component({})(class {});

const BetaModule = NgModule({ declarations: [FooComponent] })(class {});

const AlphaModule = NgModule({ imports: [BetaModule] })(class {});

describe('isComponentAlreadyDeclaredInModules', () => {
  it('should return true when the component is already declared in one of modules', () => {
    expect(isComponentAlreadyDeclared(FooComponent, [], [AlphaModule])).toEqual(true);
  });

  it('should return true if the component is in moduleDeclarations', () => {
    expect(isComponentAlreadyDeclared(BarComponent, [BarComponent], [AlphaModule])).toEqual(true);
  });

  it('should return false if the component is not declared', () => {
    expect(isComponentAlreadyDeclared(BarComponent, [], [AlphaModule])).toEqual(false);
  });
});
