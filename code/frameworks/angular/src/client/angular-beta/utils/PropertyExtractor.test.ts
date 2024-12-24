import { CommonModule } from '@angular/common';
import { Component, Directive, Injectable, InjectionToken, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  BrowserAnimationsModule,
  NoopAnimationsModule,
  provideAnimations,
  provideNoopAnimations,
} from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';

import { NgModuleMetadata } from '../../types';
import { WithOfficialModule } from '../__testfixtures__/test.module';
import { PropertyExtractor } from './PropertyExtractor';

const TEST_TOKEN = new InjectionToken('testToken');
const TestTokenProvider = { provide: TEST_TOKEN, useValue: 123 };
const TestService = Injectable()(class {});
const TestComponent1 = Component({})(class {});
const TestComponent2 = Component({})(class {});
const StandaloneTestComponent = Component({ standalone: true })(class {});
const StandaloneTestDirective = Directive({ standalone: true })(class {});
const MixedTestComponent1 = Component({ standalone: true })(
  class extends StandaloneTestComponent {}
);
const MixedTestComponent2 = Component({})(class extends MixedTestComponent1 {});
const MixedTestComponent3 = Component({ standalone: true })(class extends MixedTestComponent2 {});
const TestModuleWithDeclarations = NgModule({ declarations: [TestComponent1] })(class {});
const TestModuleWithImportsAndProviders = NgModule({
  imports: [TestModuleWithDeclarations],
  providers: [TestTokenProvider],
})(class {});

const analyzeMetadata = (metadata: NgModuleMetadata, component?: any) => {
  return new PropertyExtractor(metadata, component);
};
const extractImports = (metadata: NgModuleMetadata, component?: any) => {
  const { imports } = new PropertyExtractor(metadata, component);
  return imports;
};
const extractDeclarations = (metadata: NgModuleMetadata, component?: any) => {
  const { declarations } = new PropertyExtractor(metadata, component);
  return declarations;
};
const extractProviders = (metadata: NgModuleMetadata, component?: any) => {
  const { providers } = new PropertyExtractor(metadata, component);
  return providers;
};
const extractApplicationProviders = (metadata: NgModuleMetadata, component?: any) => {
  const { applicationProviders } = new PropertyExtractor(metadata, component);
  return applicationProviders;
};

describe('PropertyExtractor', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  describe('analyzeMetadata', () => {
    it('should remove BrowserModule', () => {
      const metadata = {
        imports: [BrowserModule],
      };
      const { imports, providers, applicationProviders } = analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    });

    it('should remove BrowserAnimationsModule and use its providers instead', () => {
      const metadata = {
        imports: [BrowserAnimationsModule],
      };
      const { imports, providers, applicationProviders } = analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual(provideAnimations());
    });

    it('should remove NoopAnimationsModule and use its providers instead', () => {
      const metadata = {
        imports: [NoopAnimationsModule],
      };
      const { imports, providers, applicationProviders } = analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual(provideNoopAnimations());
    });

    it('should remove Browser/Animations modules recursively', () => {
      const metadata = {
        imports: [BrowserAnimationsModule, BrowserModule],
      };
      const { imports, providers, applicationProviders } = analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual(provideAnimations());
    });

    it('should not destructure Angular official module', () => {
      const metadata = {
        imports: [WithOfficialModule],
      };
      const { imports, providers, applicationProviders } = analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule, WithOfficialModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    });
  });

  describe('extractImports', () => {
    it('should return Angular official modules', () => {
      const imports = extractImports({ imports: [TestModuleWithImportsAndProviders] });
      expect(imports).toEqual([CommonModule, TestModuleWithImportsAndProviders]);
    });

    it('should return standalone components', () => {
      const imports = extractImports(
        {
          imports: [TestModuleWithImportsAndProviders],
        },
        StandaloneTestComponent
      );
      expect(imports).toEqual([
        CommonModule,
        TestModuleWithImportsAndProviders,
        StandaloneTestComponent,
      ]);
    });

    it('should return standalone directives', () => {
      const imports = extractImports(
        {
          imports: [TestModuleWithImportsAndProviders],
        },
        StandaloneTestDirective
      );
      expect(imports).toEqual([
        CommonModule,
        TestModuleWithImportsAndProviders,
        StandaloneTestDirective,
      ]);
    });
  });

  describe('extractDeclarations', () => {
    it('should return an array of declarations that contains `storyComponent`', () => {
      const declarations = extractDeclarations({ declarations: [TestComponent1] }, TestComponent2);
      expect(declarations).toEqual([TestComponent1, TestComponent2]);
    });
  });

  describe('analyzeDecorators', () => {
    it('isStandalone should be false', () => {
      const { isStandalone } = PropertyExtractor.analyzeDecorators(TestComponent1);
      expect(isStandalone).toBe(false);
    });

    it('isStandalone should be true', () => {
      const { isStandalone } = PropertyExtractor.analyzeDecorators(StandaloneTestComponent);
      expect(isStandalone).toBe(true);
    });

    it('isStandalone should be true', () => {
      const { isStandalone } = PropertyExtractor.analyzeDecorators(MixedTestComponent1);
      expect(isStandalone).toBe(true);
    });

    it('isStandalone should be false', () => {
      const { isStandalone } = PropertyExtractor.analyzeDecorators(MixedTestComponent2);
      expect(isStandalone).toBe(false);
    });

    it('isStandalone should be true', () => {
      const { isStandalone } = PropertyExtractor.analyzeDecorators(MixedTestComponent3);
      expect(isStandalone).toBe(true);
    });
  });

  describe('extractProviders', () => {
    it('should return an array of providers', () => {
      const providers = extractProviders({
        providers: [TestService],
      });
      expect(providers).toEqual([TestService]);
    });

    it('should return an array of singletons extracted', () => {
      const singeltons = extractApplicationProviders({
        imports: [BrowserAnimationsModule],
      });

      expect(singeltons).toEqual(provideAnimations());
    });
  });
});
