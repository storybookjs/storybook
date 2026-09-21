/**
 * Generator for a synthetic Angular project consumable by a standalone Compodoc CLI run.
 *
 * Ships a minimal fake `(at)angular/core` type surface inside its own node_modules so the tree is
 * hermetic - no npm install of the real framework is needed for type resolution.
 *
 * Run directly, from code/lib/docgen-harness (--out defaults into the sandbox directory):
 *   node src/perf/docgen-perf/generators/angular.ts --components 100
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';

export interface AngularGenerateOptions {
  outDir: string;
  components: number;
  /** Extra `@Input()` members per component on top of the fixed baseline set. */
  props: number;
}

export interface GeneratedAngularProject {
  outDir: string;
  /** Absolute component file paths, in component order. */
  componentPaths: string[];
}

const FAKE_ANGULAR_CORE = `export declare function Component(metadata: {
  selector?: string;
  template?: string;
  standalone?: boolean;
}): ClassDecorator;
export declare function Input(bindingPropertyName?: string): PropertyDecorator;
export declare function Output(bindingPropertyName?: string): PropertyDecorator;
export declare class EventEmitter<T> {
  emit(value?: T): void;
  subscribe(next: (value: T) => void): { unsubscribe(): void };
}
`;

/** The generated tree, as paths relative to the output directory. */
export interface AngularProjectFiles {
  /** Every file the generator emits, keyed by its path relative to the output directory. */
  files: Record<string, string>;
  /** The component files, in component order. */
  componentPaths: string[];
}

/**
 * The project as data, before anything touches disk. Everything this generator emits is here, so
 * the shape of the tree - and how a component reaches the fake framework types - can be read
 * without generating one.
 */
export function angularProjectFiles(
  options: Pick<AngularGenerateOptions, 'components' | 'props'>
): AngularProjectFiles {
  const files: Record<string, string> = {
    // A fake `@angular/core` inside the project's own node_modules keeps the tree hermetic: compodoc
    // resolves the decorators it needs without the real framework being installed.
    'node_modules/@angular/core/package.json': JSON.stringify(
      { name: '@angular/core', version: '0.0.0-bench', types: 'index.d.ts' },
      null,
      2
    ),
    'node_modules/@angular/core/index.d.ts': FAKE_ANGULAR_CORE,
    // The compodoc adapter passes `-p tsconfig.json` with the project dir as cwd.
    'tsconfig.json': JSON.stringify(TSCONFIG, null, 2),
  };

  const componentPaths: string[] = [];
  for (let i = 0; i < options.components; i++) {
    const componentPath = `src/app/comp${i}.component.ts`;
    files[componentPath] = angularComponentSource(i, options.props);
    componentPaths.push(componentPath);
  }

  return { files, componentPaths };
}

/**
 * `extraProps` grows the input surface by one per warm-run touch, so the second Compodoc run sees
 * a genuinely changed file.
 */
export function angularComponentSource(i: number, extraProps: number): string {
  const extras = Array.from(
    { length: extraProps },
    (_, p) => `  /** Extra input ${p} for component ${i}. */
  @Input() extra${p}?: ${p % 3 === 0 ? `'a' | 'b' | 'c'` : p % 3 === 1 ? 'number' : 'string'};`
  ).join('\n');

  return `import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Comp${i} - generated bench component.
 */
@Component({
  selector: 'bench-comp${i}',
  template: '<div>{{ label }}</div>',
})
export class Comp${i}Component {
  /** Primary label shown to the user. */
  @Input() label = '';
  /** Numeric size token. */
  @Input() size?: number;
  /** Visual variant. */
  @Input() variant?: 'primary' | 'secondary' | 'tertiary';
  /** Disable interaction. */
  @Input() disabled = false;
${extras ? `${extras}\n` : ''}  /** Emits when the user acts on the component. */
  @Output() action = new EventEmitter<{ id: string; value: number }>();
}
`;
}

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    skipLibCheck: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: false,
  },
  include: ['src/**/*.ts'],
};

export function generateAngularProject(options: AngularGenerateOptions): GeneratedAngularProject {
  const outDir = path.resolve(options.outDir);
  fs.rmSync(outDir, { recursive: true, force: true });

  const { files, componentPaths } = angularProjectFiles(options);
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }

  return { outDir, componentPaths: componentPaths.map((p) => path.join(outDir, p)) };
}

function parseOptions(argv: string[]): AngularGenerateOptions {
  return parseHarnessOptions<AngularGenerateOptions>(
    argv,
    { out: { type: 'string' }, components: { type: 'string' }, props: { type: 'string' } } as const,
    z.object({
      outDir: z.string().default(path.join(SANDBOX_DIRECTORY, 'docgen-perf-angular')),
      components: countOption(100),
      props: countOption(8),
    }),
    (values) => ({ ...values, outDir: values.out })
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(process.argv.slice(2));
  const start = Date.now();
  const result = generateAngularProject(options);
  console.log(
    `Generated ${options.components} Angular components into ${result.outDir} in ${Date.now() - start}ms`
  );
}
