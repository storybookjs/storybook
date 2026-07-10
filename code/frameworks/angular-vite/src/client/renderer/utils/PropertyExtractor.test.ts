import { CommonModule } from '@angular/common';
import { Component, Directive, Injectable, InjectionToken, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NgModuleMetadata } from '../../types.ts';
import { WithOfficialModule } from '../__testfixtures__/test.module.ts';
import { PropertyExtractor } from './PropertyExtractor.ts';

const TEST_TOKEN = new InjectionToken('testToken');
const TestTokenProvider = { provide: TEST_TOKEN, useValue: 123 };
const TestService = Injectable()(class {});
const TestComponent1 = Component({ standalone: false })(class {});
const TestComponent2 = Component({ standalone: false })(class {});
const StandaloneTestComponent = Component({})(class {});
const StandaloneTestDirective = Directive({})(class {});
const MixedTestComponent1 = Component({})(class extends StandaloneTestComponent {});
const MixedTestComponent2 = Component({ standalone: false })(class extends MixedTestComponent1 {});
const MixedTestComponent3 = Component({})(class extends MixedTestComponent2 {});
const TestModuleWithDeclarations = NgModule({ declarations: [TestComponent1] })(class {});
const TestModuleWithImportsAndProviders = NgModule({
  imports: [TestModuleWithDeclarations],
  providers: [TestTokenProvider],
})(class {});
class BrowserAnimationsModule {}
class NoopAnimationsModule {}

const analyzeMetadata = async (metadata: NgModuleMetadata, component?: any) => {
  const propertyExtractor = new PropertyExtractor(metadata, component);
  await propertyExtractor.init();
  return propertyExtractor;
};
const extractImports = async (metadata: NgModuleMetadata, component?: any) => {
  const propertyExtractor = new PropertyExtractor(metadata, component);
  await propertyExtractor.init();
  return propertyExtractor.imports;
};
const extractDeclarations = async (metadata: NgModuleMetadata, component?: any) => {
  const propertyExtractor = new PropertyExtractor(metadata, component);
  await propertyExtractor.init();
  return propertyExtractor.declarations;
};
const extractProviders = async (metadata: NgModuleMetadata, component?: any) => {
  const propertyExtractor = new PropertyExtractor(metadata, component);
  await propertyExtractor.init();
  return propertyExtractor.providers;
};
const extractApplicationProviders = async (metadata: NgModuleMetadata, component?: any) => {
  const propertyExtractor = new PropertyExtractor(metadata, component);
  await propertyExtractor.init();
  return propertyExtractor.applicationProviders;
};

describe('PropertyExtractor', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn');

  beforeEach(() => {
    consoleWarnSpy.mockImplementation(() => {});
    consoleWarnSpy.mockClear();
  });

  describe('analyzeMetadata', () => {
    it('should remove BrowserModule', async () => {
      const metadata = {
        imports: [BrowserModule],
      };
      const { imports, providers, applicationProviders } = await analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    });

    it('should warn and remove BrowserAnimationsModule without adding providers', async () => {
      const metadata = {
        imports: [BrowserAnimationsModule],
      };
      const { imports, providers, applicationProviders } = await analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BrowserAnimationsModule')
      );
    });

    it('should warn and remove NoopAnimationsModule without adding providers', async () => {
      const metadata = {
        imports: [NoopAnimationsModule],
      };
      const { imports, providers, applicationProviders } = await analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('NoopAnimationsModule'));
    });

    it('should remove Browser/Animations modules recursively', async () => {
      const metadata = {
        imports: [BrowserAnimationsModule, BrowserModule],
      };
      const { imports, providers, applicationProviders } = await analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    });

    it('should not destructure Angular official module', async () => {
      const metadata = {
        imports: [WithOfficialModule],
      };
      const { imports, providers, applicationProviders } = await analyzeMetadata(metadata);
      expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule, WithOfficialModule]);
      expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    });
  });

  describe('extractImports', () => {
    it('should return Angular official modules', async () => {
      const imports = await extractImports({ imports: [TestModuleWithImportsAndProviders] });
      expect(imports).toEqual([CommonModule, TestModuleWithImportsAndProviders]);
    });

    it('should return standalone components', async () => {
      const imports = await extractImports(
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

    it('should return standalone directives', async () => {
      const imports = await extractImports(
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
    it('should return an array of declarations that contains `storyComponent`', async () => {
      const declarations = await extractDeclarations(
        { declarations: [TestComponent1] },
        TestComponent2
      );
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
    it('should return an array of providers', async () => {
      const providers = await extractProviders({
        providers: [TestService],
      });
      expect(providers).toEqual([TestService]);
    });
  });

  describe('extractApplicationProviders', () => {
    it('should not extract providers from legacy animation modules', async () => {
      const applicationProviders = await extractApplicationProviders({
        imports: [BrowserAnimationsModule],
      });

      expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BrowserAnimationsModule')
      );
    });
  });
});
