/**
 * Generator for an isolated, stress-test Storybook-shaped React project.
 *
 * Produces N component files (each with a non-trivial props interface that extends React DOM types,
 * so TypeScript type resolution has realistic cost) plus a co-located `.stories.tsx` with M variants.
 * Used by both the in-process memory harness (`memory-harness.ts`) and — at larger scale — as a real
 * buildable/deployable Storybook for the "+5K components" benchmark from
 * https://github.com/storybookjs/storybook/issues/34824.
 *
 * The `--heavy` lever (optionally scaled with `--heavy-factor N`) grows the TypeScript checker
 * working set to a realistic per-component density (~2.6 MB/component, matching real libraries) by
 * emitting inline literal-union props that `serializeType` expands into retained enum arrays. That is
 * what lets the in-process harness actually OOM.
 *
 * Run directly:
 *   node --import jiti/register scripts/bench/docgen-memory/generate-project.ts --out ../storybook-sandboxes/docgen-stress --components 5000 --variants 5
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export interface GenerateOptions {
  /** Absolute (or cwd-relative) output directory for the generated project. */
  outDir: string;
  /** Number of component+story file pairs to generate. */
  components: number;
  /** Number of story variants per component. */
  variants: number;
  /** Number of extra props per component (on top of the fixed baseline props). */
  props: number;
  /**
   * Inflate the *type-resolution* cost per component with large constructed types (big unions,
   * mapped types, deep nesting, generics) — the lever that actually grows the TypeScript checker
   * working set, mirroring complex real-world component libraries.
   */
  heavyTypes: boolean;
  /**
   * Multiplier (≥1) applied to {@link heavyTypes}. Scales both the size of each constructed type
   * (token unions, mapped-type keys) and the number of heavy props per component. The dominant
   * lever is the count of *inline literal-union* props: `serializeType` expands those into retained
   * enum arrays on the emitted doc, so a higher factor grows the permanently-retained working set
   * (the real-world failure mode where the warm set sits just under the heap cap), not just the
   * transient per-save spike. Ignored unless `heavyTypes` is set.
   */
  heavyFactor: number;
  /**
   * Inject a base64 data string of this many KB into each component as a runtime constant. This is
   * a control: it bloats source text (parse + retained program memory) but NOT the type-resolution
   * working set.
   */
  base64Kb: number;
  /** Copy a minimal node_modules (react, @types/react, csstype, prop-types) into the project. */
  withNodeModules: boolean;
}

/** Base number of union members / mapped-type keys used by `--heavy` (scaled by `--heavy-factor`). */
const HEAVY_TOKEN_COUNT = 300;

/** Base number of inline literal-union props per component (scaled by `--heavy-factor`). */
const HEAVY_ENUM_PROPS = 6;

export interface GeneratedProject {
  outDir: string;
  configPath: string;
  /** Absolute paths of every generated component implementation file, in component order. */
  componentPaths: string[];
  /** Absolute paths of every generated story file, in component order. */
  storyPaths: string[];
}

const NODE_MODULES_DIR = path.resolve(require.resolve('react/package.json'), '../..');

/** Copy the minimal node_modules packages TypeScript needs for React type resolution. */
function copyNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  const typesSrc = path.join(NODE_MODULES_DIR, '@types');
  fs.mkdirSync(path.join(dest, '@types'), { recursive: true });

  for (const pkg of ['react', 'csstype']) {
    fs.cpSync(path.join(NODE_MODULES_DIR, pkg), path.join(dest, pkg), {
      recursive: true,
      dereference: true,
    });
  }
  for (const pkg of ['react', 'prop-types']) {
    fs.cpSync(path.join(typesSrc, pkg), path.join(dest, '@types', pkg), {
      recursive: true,
      dereference: true,
    });
  }
}

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    jsx: 'react-jsx',
    strict: true,
    esModuleInterop: true,
    moduleResolution: 'bundler',
    skipLibCheck: true,
  },
  include: ['./src/**/*.ts', './src/**/*.tsx'],
};

/** A spread of prop kinds so each component carries realistic type-resolution weight. */
function propLines(componentIndex: number, extraProps: number): string {
  const lines = [
    `  /** Primary label shown to the user. */`,
    `  label: string;`,
    `  /** Numeric size token. */`,
    `  size?: number;`,
    `  /** Visual variant. */`,
    `  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';`,
    `  /** Disable interaction. */`,
    `  disabled?: boolean;`,
    `  /** Click handler. */`,
    `  onAction?: (event: { id: string; value: number }) => void;`,
    `  /** Rich item list. */`,
    `  items?: Array<{ id: string; label: string; meta?: Record<string, unknown> }>;`,
    `  /** Render slot. */`,
    `  renderSlot?: (ctx: { index: number }) => React.ReactNode;`,
  ];
  for (let p = 0; p < extraProps; p++) {
    lines.push(`  /** Extra prop ${p} for component ${componentIndex}. */`);
    lines.push(
      p % 3 === 0
        ? `  extra${p}?: 'a' | 'b' | 'c';`
        : p % 3 === 1
          ? `  extra${p}?: number | string;`
          : `  extra${p}?: { nested: { deep: boolean } };`
    );
  }
  return lines.join('\n');
}

/**
 * Large constructed types that force the checker to materialize big per-component type state.
 *
 * Two distinct cost levers, both scaled by `factor`:
 *
 *   - Transient resolution: a big token union + a mapped type over it + a deeply nested generic.
 *     These inflate the per-save type-checking spike but are emitted as type *aliases*, so
 *     `serializeType` only prints their name — they are not deeply retained on the doc.
 *   - Retained working set: `inline literal-union` props whose members are unique per component and
 *     per prop. `serializeType` expands these into `enum` value arrays stored on the emitted doc, so
 *     they stay resident for the life of the program — mirroring real libraries whose warm working
 *     set sits permanently near the heap cap.
 */
function heavyTypeBlock(i: number, factor: number): { typeDefs: string; propLines: string } {
  const tokenCount = HEAVY_TOKEN_COUNT * factor;
  const enumProps = HEAVY_ENUM_PROPS * factor;
  const tokens = Array.from({ length: tokenCount }, (_, t) => `'t${t}'`).join(' | ');

  // Inline literal-union props: unique members per (component, prop) so the checker and the emitted
  // doc cannot dedupe them across components. These are the dominant retained-memory lever.
  const enumLines = Array.from({ length: enumProps }, (_, k) => {
    const members = Array.from(
      { length: tokenCount },
      (_, t) => `'c${i}_p${k}_v${t}'`
    ).join(' | ');
    return `  /** Inline literal union ${k}. */
  enum${k}?: ${members};`;
  }).join('\n');

  return {
    typeDefs: `type Token${i} = ${tokens};
type ThemeMap${i} = { [K in Token${i}]: { fg: string; bg: string; border: number; shadow: string } };
interface Deep${i} { a: { b: { c: { d: { e: Token${i}; f: ThemeMap${i} } } } } }
`,
    propLines: `  /** Heavy token union. */
  token?: Token${i};
  /** Mapped type over every token. */
  theme?: ThemeMap${i};
  /** Deeply nested generic structure. */
  deep?: Deep${i};
  /** Array of per-token records. */
  matrix?: Array<Record<Token${i}, number>>;
${enumLines}`,
  };
}

/** A base64 data string roughly `kb` kilobytes long (control payload that grows source text only). */
function base64Block(i: number, kb: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const length = kb * 1024;
  let body = '';
  for (let c = 0; c < length; c++) {
    body += chars[c % chars.length];
  }
  return `const ASSET${i} = "data:image/png;base64,${body}";\nvoid ASSET${i};\n`;
}

export function componentSource(
  i: number,
  extraProps: number,
  opts: { heavyTypes?: boolean; heavyFactor?: number; base64Kb?: number } = {}
): string {
  const heavy = opts.heavyTypes
    ? heavyTypeBlock(i, Math.max(1, opts.heavyFactor ?? 1))
    : undefined;
  const base64 = opts.base64Kb ? base64Block(i, opts.base64Kb) : '';
  return `import * as React from 'react';

${heavy?.typeDefs ?? ''}${base64}export interface Comp${i}Props extends React.HTMLAttributes<HTMLDivElement> {
${propLines(i, extraProps)}${heavy ? `\n${heavy.propLines}` : ''}
}

/**
 * Comp${i} — generated stress-test component.
 */
export const Comp${i} = ({ label, ...rest }: Comp${i}Props) => {
  return <div {...rest}>{label}</div>;
};
`;
}

function storySource(i: number, variants: number): string {
  const variantExports = Array.from({ length: variants }, (_, v) => {
    const variant = ['primary', 'secondary', 'tertiary', 'ghost'][v % 4];
    return `export const Variant${v} = {
  render: () => <Comp${i} label="hello-${v}" size={${v}} variant="${variant}" />,
};`;
  }).join('\n\n');

  return `import * as React from 'react';

import { Comp${i} } from './Comp${i}';

const meta = {
  title: 'Generated/Comp${i}',
  component: Comp${i},
};
export default meta;

${variantExports}
`;
}

export function generateProject(options: GenerateOptions): GeneratedProject {
  const outDir = path.resolve(options.outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });

  const configPath = path.join(outDir, 'tsconfig.json');
  fs.writeFileSync(configPath, JSON.stringify(TSCONFIG, null, 2));

  if (options.withNodeModules) {
    copyNodeModules(outDir);
  }

  const componentPaths: string[] = [];
  const storyPaths: string[] = [];

  for (let i = 0; i < options.components; i++) {
    const dir = path.join(outDir, 'src', `Comp${i}`);
    fs.mkdirSync(dir, { recursive: true });
    const componentPath = path.join(dir, `Comp${i}.tsx`);
    const storyPath = path.join(dir, `Comp${i}.stories.tsx`);
    fs.writeFileSync(
      componentPath,
      componentSource(i, options.props, {
        heavyTypes: options.heavyTypes,
        heavyFactor: options.heavyFactor,
        base64Kb: options.base64Kb,
      })
    );
    fs.writeFileSync(storyPath, storySource(i, options.variants));
    componentPaths.push(componentPath);
    storyPaths.push(storyPath);
  }

  return { outDir, configPath, componentPaths, storyPaths };
}

function parseArgs(argv: string[]): GenerateOptions {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    outDir: get('--out', '../storybook-sandboxes/docgen-memory-stress'),
    components: Number(get('--components', '500')),
    variants: Number(get('--variants', '4')),
    props: Number(get('--props', '8')),
    heavyTypes: argv.includes('--heavy'),
    heavyFactor: Number(get('--heavy-factor', '1')),
    base64Kb: Number(get('--base64-kb', '0')),
    withNodeModules: !argv.includes('--no-node-modules'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const start = Date.now();
  const result = generateProject(options);
  console.log(
    `Generated ${options.components} components (×${options.variants} variants, ${options.props} extra props) ` +
      `into ${result.outDir} in ${Date.now() - start}ms`
  );
}
