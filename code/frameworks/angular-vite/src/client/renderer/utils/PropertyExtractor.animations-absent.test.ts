import { CommonModule } from '@angular/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simulate a project where `@angular/animations` (an optional peer of `@angular/platform-browser`)
// is not installed: importing `@angular/platform-browser/animations` must fail. PropertyExtractor
// must degrade gracefully instead of breaking every story render.
vi.mock('@angular/platform-browser/animations', () => {
  throw new Error('simulated: @angular/animations is not installed');
});

import type { NgModuleMetadata } from '../../types.ts';
import { PropertyExtractor } from './PropertyExtractor.ts';

class BrowserAnimationsModule {}
class NoopAnimationsModule {}

const analyzeMetadata = async (metadata: NgModuleMetadata) => {
  const propertyExtractor = new PropertyExtractor(metadata);
  await propertyExtractor.init();
  return propertyExtractor;
};

describe('PropertyExtractor without @angular/animations installed', () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn');

  beforeEach(() => {
    consoleWarnSpy.mockImplementation(() => {});
    consoleWarnSpy.mockClear();
  });

  it('should not throw when moduleMetadata.imports contains BrowserAnimationsModule', async () => {
    const { imports, providers, applicationProviders } = await analyzeMetadata({
      imports: [BrowserAnimationsModule],
    });

    expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule, BrowserAnimationsModule]);
    expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
    expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('BrowserAnimationsModule')
    );
  });

  it('should not throw when moduleMetadata.imports contains NoopAnimationsModule', async () => {
    const { imports, providers, applicationProviders } = await analyzeMetadata({
      imports: [NoopAnimationsModule],
    });

    expect(imports.flat(Number.MAX_VALUE)).toEqual([CommonModule, NoopAnimationsModule]);
    expect(providers.flat(Number.MAX_VALUE)).toEqual([]);
    expect(applicationProviders.flat(Number.MAX_VALUE)).toEqual([]);
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('NoopAnimationsModule')
    );
  });
});
