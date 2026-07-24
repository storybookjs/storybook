/**
 * Generator for a synthetic Angular project consumable by a standalone Compodoc CLI run.
 *
 * Compodoc documents inputs/outputs from the TypeScript AST, so the generated tree ships a minimal
 * fake `(at)angular/core` type surface inside its own node_modules (hermetic - no npm install of the
 * real framework) just so type resolution stays clean.
 *
 * Run directly:
 *   node --import jiti/register scripts/bench/docgen-perf/generators/angular.ts --out ../storybook-sandboxes/docgen-perf-angular --components 100
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface AngularGenerateOptions {
  outDir: string;
  components: number;
  /** Extra `@Input()` members per component on top of the fixed baseline set. */
  props: number;
}

export interface GeneratedAngularProject {
  outDir: string;
  configPath: string;
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

function emitFakeAngularCore(projectDir: string): void {
  const dir = path.join(projectDir, 'node_modules', '@angular', 'core');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: '@angular/core', version: '0.0.0-bench', types: 'index.d.ts' }, null, 2)
  );
  fs.writeFileSync(path.join(dir, 'index.d.ts'), FAKE_ANGULAR_CORE);
}

/**
 * A component's source. `extraProps` grows the input surface by one per warm-run touch, so the
 * second Compodoc run sees a genuinely changed file.
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
  fs.mkdirSync(path.join(outDir, 'src', 'app'), { recursive: true });

  emitFakeAngularCore(outDir);

  const configPath = path.join(outDir, 'tsconfig.json');
  fs.writeFileSync(configPath, JSON.stringify(TSCONFIG, null, 2));

  const componentPaths: string[] = [];
  for (let i = 0; i < options.components; i++) {
    const componentPath = path.join(outDir, 'src', 'app', `comp${i}.component.ts`);
    fs.writeFileSync(componentPath, angularComponentSource(i, options.props));
    componentPaths.push(componentPath);
  }

  return { outDir, configPath, componentPaths };
}

function parseArgs(argv: string[]): AngularGenerateOptions {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    outDir: get('--out', '../storybook-sandboxes/docgen-perf-angular'),
    components: Number(get('--components', '100')),
    props: Number(get('--props', '8')),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const start = Date.now();
  const result = generateAngularProject(options);
  console.log(
    `Generated ${options.components} Angular components into ${result.outDir} in ${Date.now() - start}ms`
  );
}
