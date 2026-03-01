import { describe, expect, it } from 'vitest';

import type { Directive } from '../client/compodoc-types';
import { buildComponentImport } from './getComponentImports';

const makeComponent = (overrides: Partial<Directive> & { file?: string } = {}): Directive =>
  ({
    name: 'ButtonComponent',
    type: 'component',
    inputsClass: [],
    outputsClass: [],
    propertiesClass: [],
    methodsClass: [],
    file: 'src/app/button/button.component.ts',
    ...overrides,
  }) as any;

describe('buildComponentImport', () => {
  it('should build a package import when packageName is provided', () => {
    const result = buildComponentImport(
      makeComponent(),
      'src/stories/button.stories.ts',
      '@my-lib/ui'
    );
    expect(result).toBe("import { ButtonComponent } from '@my-lib/ui';");
  });

  it('should build a relative import from story file to component file', () => {
    const result = buildComponentImport(
      makeComponent({ file: 'src/app/button/button.component.ts' } as any),
      'src/stories/button.stories.ts'
    );
    expect(result).toBe(
      "import { ButtonComponent } from '../app/button/button.component';"
    );
  });

  it('should add ./ prefix for components in the same directory', () => {
    const result = buildComponentImport(
      makeComponent({ file: 'src/stories/button.component.ts' } as any),
      'src/stories/button.stories.ts'
    );
    expect(result).toBe("import { ButtonComponent } from './button.component';");
  });

  it('should strip .ts extension from import path', () => {
    const result = buildComponentImport(
      makeComponent({ file: 'src/app/button.component.ts' } as any),
      'src/stories/button.stories.ts'
    );
    expect(result).not.toContain('.ts');
  });

  it('should use component name as fallback when file is not set', () => {
    const result = buildComponentImport(
      makeComponent({ file: undefined } as any),
      'src/stories/button.stories.ts'
    );
    expect(result).toBe("import { ButtonComponent } from './ButtonComponent';");
  });

  it('should prioritize packageName over relative import', () => {
    const result = buildComponentImport(
      makeComponent({ file: 'src/app/button/button.component.ts' } as any),
      'src/stories/button.stories.ts',
      '@design-system/buttons'
    );
    expect(result).toBe("import { ButtonComponent } from '@design-system/buttons';");
  });
});
