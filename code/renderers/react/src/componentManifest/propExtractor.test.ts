import path from 'node:path';

import { describe, expect, it } from 'vitest';

import ts from 'typescript';

import { type ComponentDoc, detectComponents, extractComponentDocs } from './propExtractor';

// Use the monorepo root so TypeScript can find @types/react in node_modules
const VIRTUAL_ROOT = path.resolve(__dirname, '../../../../..');

// ---------------------------------------------------------------------------
// Shared compiler infrastructure — parse @types/react once, reuse everywhere
// ---------------------------------------------------------------------------

const SHARED_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

// Global cache for parsed source files (lib.d.ts, @types/react, etc.)
// Survives across all createVirtualProgram calls so TS never re-parses them.
const sourceFileCache = new Map<string, ts.SourceFile>();

// Seed the cache by creating one throwaway program that resolves react types
const seedHost = ts.createCompilerHost(SHARED_OPTIONS);
const seedFile = path.join(VIRTUAL_ROOT, '__seed__.ts');
const origGetSourceFile = seedHost.getSourceFile.bind(seedHost);
seedHost.getSourceFile = (fileName, langVer) => {
  if (fileName === seedFile) {
    return ts.createSourceFile(seedFile, 'import React from "react";', ts.ScriptTarget.ES2020);
  }
  const cached = sourceFileCache.get(fileName);
  if (cached) return cached;
  const sf = origGetSourceFile(fileName, langVer);
  if (sf) sourceFileCache.set(fileName, sf);
  return sf;
};
ts.createProgram([seedFile], SHARED_OPTIONS, seedHost);

// ---------------------------------------------------------------------------
// Test helper: create a TypeScript program from virtual source files
// ---------------------------------------------------------------------------

/**
 * Creates a ts.Program from a map of virtual file paths to source code.
 * Virtual files are placed under the monorepo root so module resolution
 * for 'react' and other packages works via the real node_modules.
 *
 * Uses a shared source file cache so @types/react is parsed only once
 * across the entire test suite (~90s → ~10s).
 */
function createVirtualProgram(
  files: Record<string, string>,
  compilerOptions?: ts.CompilerOptions
): ts.Program {
  const options: ts.CompilerOptions = { ...SHARED_OPTIONS, ...compilerOptions };

  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);

  host.getSourceFile = (fileName, languageVersionOrOptions) => {
    if (files[fileName] !== undefined) {
      const version =
        typeof languageVersionOrOptions === 'number'
          ? languageVersionOrOptions
          : languageVersionOrOptions.languageVersion;
      return ts.createSourceFile(fileName, files[fileName], version);
    }
    // Return cached source file if available (lib.d.ts, @types/react, etc.)
    const cached = sourceFileCache.get(fileName);
    if (cached) return cached;
    const sf = originalGetSourceFile(fileName, languageVersionOrOptions);
    if (sf) sourceFileCache.set(fileName, sf);
    return sf;
  };

  host.fileExists = (fileName) => {
    if (files[fileName] !== undefined) return true;
    if (sourceFileCache.has(fileName)) return true;
    return originalFileExists(fileName);
  };

  host.readFile = (fileName) => {
    if (files[fileName] !== undefined) return files[fileName];
    const cached = sourceFileCache.get(fileName);
    if (cached) return cached.text;
    return originalReadFile(fileName);
  };

  const originalDirectoryExists = host.directoryExists?.bind(host);
  host.directoryExists = (dir) => {
    const dirWithSlash = dir.endsWith('/') ? dir : dir + '/';
    for (const key of Object.keys(files)) {
      if (key.startsWith(dirWithSlash)) return true;
    }
    return originalDirectoryExists ? originalDirectoryExists(dir) : true;
  };

  return ts.createProgram(Object.keys(files), options, host);
}

/** Extract docs for the first virtual file in the map. */
function extract(files: Record<string, string>): ComponentDoc[] {
  const program = createVirtualProgram(files);
  const filePath = Object.keys(files)[0];
  return extractComponentDocs(ts, filePath, program);
}

/** Shorthand: extract from a single component file using a path under the monorepo root. */
function extractSingle(
  code: string,
  fileName = path.join(VIRTUAL_ROOT, '__virtual__/Component.tsx')
): ComponentDoc[] {
  return extract({ [fileName]: code });
}

/**
 * Runs detectComponents on a single virtual file and returns the export names
 * that were identified as components.
 */
function detect(
  code: string,
  fileName = path.join(VIRTUAL_ROOT, '__virtual__/Component.tsx')
): string[] {
  const program = createVirtualProgram({ [fileName]: code });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName)!;
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)!;
  const exports = checker.getExportsOfModule(moduleSymbol);

  const candidates = exports
    .filter((exp) => {
      const name = exp.getName();
      if (name !== 'default' && !/^[A-Z]/.test(name)) return false;
      const resolved =
        exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
      return !!resolved.valueDeclaration;
    })
    .map((exp) => ({
      exportName: exp.getName(),
      isDefault: exp.getName() === 'default',
    }));

  if (candidates.length === 0) return [];

  const result = detectComponents(ts, fileName, candidates, program);
  if (!result) return [];

  return [...result.propsTypes.keys()].sort();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectComponents', () => {
  describe('function components', () => {
    it('detects arrow function component', () => {
      expect(detect(`
        import React from 'react';
        interface Props { label: string }
        export const Button = (props: Props) => <button />;
      `)).toEqual(['Button']);
    });

    it('detects function declaration component', () => {
      expect(detect(`
        import React from 'react';
        export function Button(props: { label: string }) { return <button /> }
      `)).toEqual(['Button']);
    });

    it('detects component returning null', () => {
      expect(detect(`
        import React from 'react';
        export const Empty = (props: { show: boolean }) => props.show ? <div /> : null;
      `)).toEqual(['Empty']);
    });

    it('detects component with no props', () => {
      expect(detect(`
        import React from 'react';
        export const Logo = () => <svg />;
      `)).toEqual(['Logo']);
    });
  });

  describe('class components', () => {
    it('detects class extending React.Component', () => {
      expect(detect(`
        import React from 'react';
        export class Button extends React.Component<{ label: string }> {
          render() { return <button /> }
        }
      `)).toEqual(['Button']);
    });

    it('detects class extending React.PureComponent', () => {
      expect(detect(`
        import React from 'react';
        export class Button extends React.PureComponent<{ label: string }> {
          render() { return <button /> }
        }
      `)).toEqual(['Button']);
    });
  });

  describe('wrapped components', () => {
    it('detects React.memo', () => {
      expect(detect(`
        import React from 'react';
        const Inner = (props: { label: string }) => <button />;
        export const Button = React.memo(Inner);
      `)).toEqual(['Button']);
    });

    it('detects React.forwardRef', () => {
      expect(detect(`
        import React from 'react';
        export const Button = React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => (
          <button ref={ref} />
        ));
      `)).toEqual(['Button']);
    });

    it('detects React.memo(React.forwardRef(...))', () => {
      expect(detect(`
        import React from 'react';
        export const Button = React.memo(
          React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => <button ref={ref} />)
        );
      `)).toEqual(['Button']);
    });

    it('detects React.lazy', () => {
      // React.lazy needs the imported module to be resolvable for JSX
      // checking to determine the props type. We provide a real Button module.
      const componentFile = path.join(VIRTUAL_ROOT, '__virtual__/Lazy.tsx');
      const buttonFile = path.join(VIRTUAL_ROOT, '__virtual__/Button.tsx');
      const files = {
        [componentFile]: `
          import React from 'react';
          export const LazyButton = React.lazy(() => import('./Button'));
        `,
        [buttonFile]: `
          import React from 'react';
          const Button = (props: { label: string }) => <button />;
          export default Button;
        `,
      };
      const program = createVirtualProgram(files);
      const checker = program.getTypeChecker();
      const sourceFile = program.getSourceFile(componentFile)!;
      const moduleSymbol = checker.getSymbolAtLocation(sourceFile)!;
      const exports = checker.getExportsOfModule(moduleSymbol);

      const candidates = exports
        .filter((exp) => {
          const name = exp.getName();
          if (name !== 'default' && !/^[A-Z]/.test(name)) return false;
          const resolved =
            exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
          return !!resolved.valueDeclaration;
        })
        .map((exp) => ({
          exportName: exp.getName(),
          isDefault: exp.getName() === 'default',
        }));

      const result = detectComponents(ts, componentFile, candidates, program);
      expect(result).toBeDefined();
      expect([...result!.propsTypes.keys()]).toEqual(['LazyButton']);
    });
  });

  describe('default exports', () => {
    it('detects default exported component', () => {
      expect(detect(`
        import React from 'react';
        const Button = (props: { label: string }) => <button />;
        export default Button;
      `)).toEqual(['default']);
    });

    it('detects inline default export', () => {
      expect(detect(`
        import React from 'react';
        export default (props: { label: string }) => <button />;
      `)).toEqual(['default']);
    });

    it('detects default export function declaration', () => {
      expect(detect(`
        import React from 'react';
        export default function Button(props: { label: string }) { return <button /> }
      `)).toEqual(['default']);
    });
  });

  describe('non-components', () => {
    it('rejects plain object', () => {
      expect(detect(`
        export const Config = { key: 'value' };
      `)).toEqual([]);
    });

    it('rejects lowercase exports (JSX intrinsic rule)', () => {
      expect(detect(`
        import React from 'react';
        export const button = (props: { label: string }) => <button />;
      `)).toEqual([]);
    });

    it('rejects string constant', () => {
      expect(detect(`
        export const Title = 'Hello';
      `)).toEqual([]);
    });

    it('rejects number constant', () => {
      expect(detect(`
        export const Count = 42;
      `)).toEqual([]);
    });

    it('rejects array', () => {
      expect(detect(`
        export const Items = [1, 2, 3];
      `)).toEqual([]);
    });

    it('rejects type-only exports', () => {
      expect(detect(`
        export interface ButtonProps { label: string }
        export type Size = 'small' | 'large';
      `)).toEqual([]);
    });

    it('rejects class not extending Component', () => {
      expect(detect(`
        export class Store {
          data = {};
          get(key: string) { return this.data; }
        }
      `)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // RDT false positives — things react-docgen-typescript incorrectly detects
  // as components. Our approach uses React's JSXElementConstructor so these
  // should all be correctly rejected (or correctly accepted).
  // -------------------------------------------------------------------------
  describe('RDT false positives', () => {
    it('rejects lowercase function (RDT bug: detects any single-param fn)', () => {
      // RDT detects any function with 1 param as a component.
      // We reject this because lowercase = intrinsic element in JSX.
      expect(detect(`
        export function add(a: number) { return a + 1; }
      `)).toEqual([]);
    });

    it('accepts uppercase function returning ReactNode-assignable value', () => {
      // RDT detects this blindly (1 param → component). We also detect it, but
      // for the right reason: (timestamp: number) => string IS a valid
      // JSXElementConstructor<number> because string extends ReactNode.
      // React's type system considers this a component — we don't override that.
      expect(detect(`
        export function FormatDate(timestamp: number) { return new Date(timestamp).toISOString(); }
      `)).toEqual(['FormatDate']);
    });

    it('accepts function with primitive "props" param returning ReactNode', () => {
      // (props: string) => any is assignable to JSXElementConstructor<string>
      // because any extends ReactNode. React says it's a component.
      expect(detect(`
        export function ParseProps(props: string) { return JSON.parse(props); }
      `)).toEqual(['ParseProps']);
    });

    it('rejects hook returning non-ReactNode object', () => {
      // Return type { count: number; increment: () => void } is NOT assignable
      // to ReactNode — so this is correctly rejected by JSXElementConstructor check.
      expect(detect(`
        export function UseCounter(initial: number) {
          return { count: initial, increment: () => {} };
        }
      `)).toEqual([]);
    });

    it('rejects higher-order function returning non-component', () => {
      // Return type is a function returning { valid: boolean; errors: never[] }
      // — not assignable to ReactNode.
      expect(detect(`
        export function CreateValidator(schema: object) {
          return (data: unknown) => ({ valid: true, errors: [] });
        }
      `)).toEqual([]);
    });

    it('rejects enum-like const object', () => {
      // Object with no call/construct signature — never a JSXElementConstructor.
      expect(detect(`
        export const ButtonVariant = {
          Primary: 'primary',
          Secondary: 'secondary',
        } as const;
      `)).toEqual([]);
    });
  });

  describe('mixed exports', () => {
    it('only detects components among mixed exports', () => {
      expect(detect(`
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
        export const Config = { key: 'value' };
        export const Icon = (props: { name: string }) => <span />;
        export const SIZES = ['small', 'large'] as const;
      `)).toEqual(['Button', 'Icon']);
    });

    it('detects components alongside type exports', () => {
      expect(detect(`
        import React from 'react';
        export interface ButtonProps { label: string }
        export const Button = (props: ButtonProps) => <button />;
        export type Size = 'small' | 'large';
      `)).toEqual(['Button']);
    });
  });
});

describe('propExtractor', () => {
  describe('component detection', () => {
    it('detects a named arrow function component', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        export const Button = (props: Props) => <button>{props.label}</button>;
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].exportName).toBe('Button');
    });

    it('detects a named function declaration component', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        export function Button(props: Props) { return <button>{props.label}</button> }
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
    });

    it('detects a default exported component', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        const Button = (props: Props) => <button>{props.label}</button>;
        export default Button;
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].exportName).toBe('default');
    });

    it('skips non-component exports (lowercase)', () => {
      const docs = extractSingle(`
        export const helper = (x: number) => x + 1;
      `);

      expect(docs).toHaveLength(0);
    });

    it('skips non-component uppercase exports (no valid props)', () => {
      const docs = extractSingle(`
        export const Config = { key: 'value' };
      `);

      expect(docs).toHaveLength(0);
    });

    it('detects multiple component exports', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ButtonProps { label: string }
        interface IconProps { name: string }
        export const Button = (props: ButtonProps) => <button>{props.label}</button>;
        export const Icon = (props: IconProps) => <span>{props.name}</span>;
      `);

      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.displayName).sort()).toEqual(['Button', 'Icon']);
    });
  });

  describe('props extraction', () => {
    it('extracts basic prop types', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ButtonProps {
          label: string;
          count: number;
          disabled?: boolean;
        }
        export const Button = (props: ButtonProps) => <button />;
      `);

      expect(docs).toHaveLength(1);
      const { props } = docs[0];

      expect(props.label).toBeDefined();
      expect(props.label.type.name).toBe('string');
      expect(props.label.required).toBe(true);

      expect(props.count).toBeDefined();
      expect(props.count.type.name).toBe('number');
      expect(props.count.required).toBe(true);

      expect(props.disabled).toBeDefined();
      expect(props.disabled.type.name).toBe('boolean');
      expect(props.disabled.required).toBe(false);
    });

    it('extracts string literal union as enum', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          size: 'small' | 'medium' | 'large';
        }
        export const Button = (props: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.size.type.name).toBe('enum');
      expect(props.size.type.value).toEqual([
        { value: '"small"' },
        { value: '"medium"' },
        { value: '"large"' },
      ]);
    });

    it('extracts optional string literal union as enum', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          size?: 'small' | 'medium' | 'large';
        }
        export const Button = (props: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.size.type.name).toBe('enum');
      expect(props.size.required).toBe(false);
      // Should not include undefined in enum values
      expect(props.size.type.value).toEqual([
        { value: '"small"' },
        { value: '"medium"' },
        { value: '"large"' },
      ]);
    });

    it('extracts JSDoc descriptions', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          /** The button label text */
          label: string;
          /** Whether the button is in primary style */
          primary?: boolean;
        }
        export const Button = (props: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.label.description).toBe('The button label text');
      expect(props.primary.description).toBe('Whether the button is in primary style');
    });

    it('extracts component-level JSDoc description', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        /** Primary UI component for user interaction */
        export const Button = (props: Props) => <button />;
      `);

      expect(docs[0].description).toBe('Primary UI component for user interaction');
    });
  });

  describe('parent/source info', () => {
    it('attaches parent type info to props from named interfaces', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ButtonProps {
          label: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      expect(props.label.parent?.name).toBe('ButtonProps');
    });

    it('attaches declarations with TypeLiteral for inline types', () => {
      const docs = extractSingle(`
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
      `);

      const { props } = docs[0];
      // Inline type literal — declarations should include TypeLiteral
      expect(props.label.declarations).toBeDefined();
    });

    it('resolves parent through intersection type literals (Primer pattern)', () => {
      const docs = extractSingle(`
        import React from 'react';
        type BaseProps = { loading?: boolean }
        type ButtonProps = { variant?: string } & BaseProps;
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      // variant is in ButtonProps' type literal, loading is in BaseProps' type literal
      // Both should resolve parent through the intersection to the enclosing type alias
      expect(props.variant.parent?.name).toBe('ButtonProps');
      expect(props.loading.parent?.name).toBe('BaseProps');
    });

    it('resolves parent for forwardRef with as-cast (PolymorphicForwardRefComponent pattern)', () => {
      const docs = extractSingle(`
        import React from 'react';
        type BaseProps = { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>;
        type ButtonProps = { variant?: string } & BaseProps;
        type PolymorphicFC<As extends React.ElementType, P> =
          React.ForwardRefExoticComponent<P & { as?: As } & React.RefAttributes<any>>;
        export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
          (props, ref) => <button ref={ref} />
        ) as PolymorphicFC<'button', ButtonProps>;
      `);

      const { props } = docs[0];
      expect(props.variant).toBeDefined();
      expect(props.variant.parent?.name).toBe('ButtonProps');
      expect(props.loading.parent?.name).toBe('BaseProps');
    });
  });

  describe('display name', () => {
    it('uses export name for named exports', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        export const MyButton = (props: Props) => <button />;
      `);

      expect(docs[0].displayName).toBe('MyButton');
    });

    it('uses resolved symbol name for default exports', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        const MyButton = (props: Props) => <button />;
        export default MyButton;
      `);

      expect(docs[0].displayName).toBe('MyButton');
    });

    it('falls back to filename for anonymous default exports', () => {
      const docs = extractSingle(
        `
        import React from 'react';
        export default (props: { label: string }) => <button />;
      `,
        path.join(VIRTUAL_ROOT, '__virtual__/Widget.tsx')
      );

      // Should use filename without extension
      expect(docs[0].displayName).toBe('Widget');
    });

    it('uses parent directory for anonymous default exports from index.ts', () => {
      const files: Record<string, string> = {
        [path.join(VIRTUAL_ROOT, '__virtual__/TextInput/TextInput.tsx')]: `
          import React from 'react';
          export default (props: { value: string }) => <input />;
        `,
        [path.join(VIRTUAL_ROOT, '__virtual__/TextInput/index.ts')]: `
          export { default } from './TextInput';
        `,
      };
      const program = createVirtualProgram(files);
      const docs = extractComponentDocs(
        ts,
        path.join(VIRTUAL_ROOT, '__virtual__/TextInput/index.ts'),
        program
      );

      // Should use parent directory name, not "index"
      expect(docs[0].displayName).toBe('TextInput');
    });
  });

  describe('defaultValue', () => {
    it('extracts destructuring defaults from arrow function', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { size?: string; color?: string; label: string }
        export const Button = ({ size = 'md', color = 'blue', label }: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.color.defaultValue).toEqual({ value: "'blue'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts boolean and numeric defaults', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { disabled?: boolean; count?: number; label: string }
        export const Input = ({ disabled = false, count = 0, label }: Props) => <input />;
      `);

      const { props } = docs[0];
      expect(props.disabled.defaultValue).toEqual({ value: 'false' });
      expect(props.count.defaultValue).toEqual({ value: '0' });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts defaults from forwardRef', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { variant?: string; label: string }
        export const Button = React.forwardRef<HTMLButtonElement, Props>(
          ({ variant = 'primary', label }, ref) => <button ref={ref} />
        );
      `);

      const { props } = docs[0];
      expect(props.variant.defaultValue).toEqual({ value: "'primary'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts defaults from React.memo', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { size?: string; label: string }
        export const Badge = React.memo(({ size = 'sm', label }: Props) => <span />);
      `);

      const { props } = docs[0];
      expect(props.size.defaultValue).toEqual({ value: "'sm'" });
    });

    it('returns null when no destructuring is used', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { size?: string }
        export const Button = (props: Props) => <button />;
      `);

      expect(docs[0].props.size.defaultValue).toBeNull();
    });

    it('extracts defaults from body-level destructuring', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { color?: string; rounded?: boolean; label: string }
        export const Alert = (props: Props) => {
          const { color = 'info', rounded = true, label } = props;
          return <div />;
        };
      `);

      const { props } = docs[0];
      expect(props.color.defaultValue).toEqual({ value: "'info'" });
      expect(props.rounded.defaultValue).toEqual({ value: 'true' });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts defaults from body-level destructuring in forwardRef', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { color?: string; size?: string; label: string }
        export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
          const { color = 'info', size = 'md', label } = props;
          return <div ref={ref} />;
        });
      `);

      const { props } = docs[0];
      expect(props.color.defaultValue).toEqual({ value: "'info'" });
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts defaults from body-level destructuring via helper call', () => {
      // Pattern used by Flowbite: const { color = 'info' } = resolveProps(props, ...)
      const docs = extractSingle(`
        import React from 'react';
        interface Props { color?: string; rounded?: boolean }
        function resolveProps(a: any, b: any): Props { return a; }
        export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
          const { color = 'info', rounded = true } = resolveProps(props, {});
          return <div ref={ref} />;
        });
      `);

      const { props } = docs[0];
      expect(props.color.defaultValue).toEqual({ value: "'info'" });
      expect(props.rounded.defaultValue).toEqual({ value: 'true' });
    });

    it('extracts defaults through Object.assign compound component', () => {
      // Pattern used by Primer: Object.assign(forwardRef(...), { SubComponent })
      const docs = extract({
        [f('stack.tsx')]: `
          import React, { forwardRef, type ElementType } from 'react';

          interface StackProps {
            /** Stack direction */
            direction?: 'horizontal' | 'vertical';
            /** Alignment */
            align?: 'stretch' | 'start' | 'center';
          }

          const StackImpl = forwardRef(
            ({ direction = 'vertical', align = 'stretch', ...rest }: StackProps, ref: React.Ref<HTMLDivElement>) => {
              return <div ref={ref} {...rest} />;
            },
          );

          const StackItem = (props: { children: React.ReactNode }) => <div />;

          export const Stack = Object.assign(StackImpl, { Item: StackItem });
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].exportName).toBe('Stack');
      expect(docs[0].props.direction.defaultValue).toEqual({ value: "'vertical'" });
      expect(docs[0].props.align.defaultValue).toEqual({ value: "'stretch'" });
    });

    it('extracts JSDoc @default tags', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          /** @default 'md' */
          size?: string;
          label: string;
        }
        export const Button = (props: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('prefers destructuring default over JSDoc @default', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          /** @default 'lg' */
          size?: string;
        }
        export const Button = ({ size = 'md' }: Props) => <button />;
      `);

      // Destructuring default takes precedence (runtime behavior)
      expect(docs[0].props.size.defaultValue).toEqual({ value: "'md'" });
    });

    it('resolves identifier references to literal values', () => {
      const docs = extractSingle(`
        import React from 'react';
        const DEFAULT_SIZE = 'md';
        const DEFAULT_COUNT = 42;
        interface Props { size?: string; count?: number; label: string }
        export const Button = ({ size = DEFAULT_SIZE, count = DEFAULT_COUNT, label }: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.count.defaultValue).toEqual({ value: '42' });
      expect(props.label.defaultValue).toBeNull();
    });

    it('resolves sibling destructured parameter references', () => {
      // Pattern: inputLabel = placeholderText, where placeholderText = 'Filter items'
      const docs = extractSingle(`
        import React from 'react';
        interface Props { placeholderText?: string; inputLabel?: string; title: string }
        export const Panel = ({
          placeholderText = 'Filter items',
          inputLabel = placeholderText,
          title,
        }: Props) => <div />;
      `);

      const { props } = docs[0];
      expect(props.placeholderText.defaultValue).toEqual({ value: "'Filter items'" });
      expect(props.inputLabel.defaultValue).toEqual({ value: "'Filter items'" });
      expect(props.title.defaultValue).toBeNull();
    });

    it('resolves enum member references', () => {
      const docs = extractSingle(`
        import React from 'react';
        enum Size { Small = 'sm', Medium = 'md', Large = 'lg' }
        interface Props { size?: string }
        export const Button = ({ size = Size.Medium }: Props) => <button />;
      `);

      expect(docs[0].props.size.defaultValue).toEqual({ value: "'md'" });
    });

    it('extracts Component.defaultProps expression pattern', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { size?: string; color?: string; label: string }
        export const Button = (props: Props) => <button />;
        Button.defaultProps = { size: 'md', color: 'blue' };
      `);

      const { props } = docs[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.color.defaultValue).toEqual({ value: "'blue'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts static defaultProps from class components', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { size?: string; label: string }
        export class Button extends React.Component<Props> {
          static defaultProps = { size: 'md' };
          render() { return <button />; }
        }
      `);

      const { props } = docs[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('prefers destructuring default over defaultProps', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { size?: string; color?: string }
        export const Button = ({ size = 'sm' }: Props) => <button />;
        Button.defaultProps = { size: 'md', color: 'blue' };
      `);

      const { props } = docs[0];
      // Destructuring wins over defaultProps
      expect(props.size.defaultValue).toEqual({ value: "'sm'" });
      // defaultProps fills in what destructuring doesn't cover
      expect(props.color.defaultValue).toEqual({ value: "'blue'" });
    });

    it('resolves defaultProps with identifier references', () => {
      const docs = extractSingle(`
        import React from 'react';
        const DEFAULT_SIZE = 'md';
        interface Props { size?: string }
        export const Button = (props: Props) => <button />;
        Button.defaultProps = { size: DEFAULT_SIZE };
      `);

      expect(docs[0].props.size.defaultValue).toEqual({ value: "'md'" });
    });
  });

  describe('fixture: Button component', () => {
    it('extracts the standard Storybook Button fixture', () => {
      const docs = extractSingle(`
        import React from 'react';
        export interface ButtonProps {
          /** Description of primary */
          primary?: boolean;
          backgroundColor?: string;
          size?: 'small' | 'medium' | 'large';
          label: string;
          onClick?: () => void;
        }

        /**
         * Primary UI component for user interaction
         * @import import { Button } from '@design-system/components/override';
         */
        export const Button = ({
          primary = false,
          size = 'medium',
          backgroundColor,
          label,
          ...props
        }: ButtonProps) => {
          const mode = primary ? 'storybook-button--primary' : 'storybook-button--secondary';
          return (
            <button
              type="button"
              className={['storybook-button', \`storybook-button--\${size}\`, mode].join(' ')}
              style={{ backgroundColor }}
              {...props}
            >
              {label}
            </button>
          );
        };
      `);

      expect(docs).toHaveLength(1);
      const doc = docs[0];

      expect(doc.displayName).toBe('Button');
      expect(doc.exportName).toBe('Button');
      expect(doc.description).toContain('Primary UI component for user interaction');

      // Props
      expect(doc.props.primary).toBeDefined();
      expect(doc.props.primary.required).toBe(false);
      expect(doc.props.primary.type.name).toBe('boolean');
      expect(doc.props.primary.description).toBe('Description of primary');

      expect(doc.props.label).toBeDefined();
      expect(doc.props.label.required).toBe(true);
      expect(doc.props.label.type.name).toBe('string');

      expect(doc.props.size).toBeDefined();
      expect(doc.props.size.required).toBe(false);
      expect(doc.props.size.type.name).toBe('enum');
      expect(doc.props.size.type.value).toEqual([
        { value: '"small"' },
        { value: '"medium"' },
        { value: '"large"' },
      ]);

      expect(doc.props.backgroundColor).toBeDefined();
      expect(doc.props.backgroundColor.required).toBe(false);
      expect(doc.props.backgroundColor.type.name).toBe('string');

      expect(doc.props.onClick).toBeDefined();
      expect(doc.props.onClick.required).toBe(false);

      // Default values from destructuring
      expect(doc.props.primary.defaultValue).toEqual({ value: 'false' });
      expect(doc.props.size.defaultValue).toEqual({ value: "'medium'" });
      expect(doc.props.backgroundColor.defaultValue).toBeNull();
      expect(doc.props.label.defaultValue).toBeNull();
    });
  });

  describe('fixture: Header component (default export)', () => {
    it('extracts a default-exported component', () => {
      const headerPath = path.join(VIRTUAL_ROOT, '__virtual__/Header.tsx');
      const files: Record<string, string> = {
        [headerPath]: `
          import React from 'react';

          interface User {
            name: string;
          }

          export interface HeaderProps {
            user?: User;
            onLogin?: () => void;
            onLogout?: () => void;
            onCreateAccount?: () => void;
          }

          export default ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
            <header>
              <div>{user?.name}</div>
            </header>
          );
        `,
      };

      const program = createVirtualProgram(files);
      const docs = extractComponentDocs(ts, headerPath, program);

      expect(docs).toHaveLength(1);
      const doc = docs[0];

      // Default export — should use filename as display name
      expect(doc.exportName).toBe('default');
      expect(doc.displayName).toBe('Header');

      // Props
      expect(doc.props.user).toBeDefined();
      expect(doc.props.user.required).toBe(false);

      expect(doc.props.onLogin).toBeDefined();
      expect(doc.props.onLogin.required).toBe(false);

      expect(doc.props.onLogout).toBeDefined();
      expect(doc.props.onLogout.required).toBe(false);

      expect(doc.props.onCreateAccount).toBeDefined();
      expect(doc.props.onCreateAccount.required).toBe(false);
    });
  });

  describe('class components', () => {
    it('detects a class component', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        export class Button extends React.Component<Props> {
          render() { return <button>{this.props.label}</button> }
        }
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].props.label).toBeDefined();
      expect(docs[0].props.label.required).toBe(true);
      expect(docs[0].props.label.type.name).toBe('string');
    });
  });

  describe('memo and forwardRef', () => {
    it('detects a React.memo component', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        const Inner = (props: Props) => <button />;
        export const Button = React.memo(Inner);
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].props.label).toBeDefined();
    });

    it('detects a React.forwardRef component', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string }
        export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
          <button ref={ref}>{props.label}</button>
        ));
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      expect(docs[0].props.label).toBeDefined();
    });
  });

  describe('intersection types', () => {
    it('extracts props from intersection types', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface BaseProps { id: string }
        interface StyleProps { className?: string }
        type ButtonProps = BaseProps & StyleProps & { label: string };
        export const Button = (props: ButtonProps) => <button />;
      `);

      expect(docs).toHaveLength(1);
      const { props } = docs[0];
      expect(props.id).toBeDefined();
      expect(props.className).toBeDefined();
      expect(props.label).toBeDefined();
    });
  });

  describe('props extraction edge cases', () => {
    it('extracts Pick<> props correctly', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface FullProps {
          id: string;
          label: string;
          disabled: boolean;
          hidden: boolean;
        }
        type ButtonProps = Pick<FullProps, 'id' | 'label'>;
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      expect(Object.keys(props).sort()).toEqual(['id', 'label']);
      expect(props.id.type.name).toBe('string');
      expect(props.label.type.name).toBe('string');
    });

    it('extracts Omit<> props correctly', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface FullProps {
          id: string;
          label: string;
          internal: boolean;
        }
        type ButtonProps = Omit<FullProps, 'internal'>;
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      expect(Object.keys(props).sort()).toEqual(['id', 'label']);
    });

    it('extracts Partial<> props as all optional', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface FullProps {
          label: string;
          count: number;
        }
        export const Button = (props: Partial<FullProps>) => <button />;
      `);

      const { props } = docs[0];
      expect(props.label.required).toBe(false);
      expect(props.count.required).toBe(false);
    });

    it('extracts Required<> props as all required', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface OptionalProps {
          label?: string;
          count?: number;
        }
        export const Button = (props: Required<OptionalProps>) => <button />;
      `);

      const { props } = docs[0];
      expect(props.label.required).toBe(true);
      expect(props.count.required).toBe(true);
    });

    it('extracts extends interface props', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface BaseProps { id: string }
        interface ButtonProps extends BaseProps {
          label: string;
          variant?: 'primary' | 'secondary';
        }
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      expect(props.id).toBeDefined();
      expect(props.id.required).toBe(true);
      expect(props.label).toBeDefined();
      expect(props.variant).toBeDefined();
      expect(props.variant.type.name).toBe('enum');
    });

    it('extracts generic component props', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ListProps<T> {
          items: T[];
          renderItem: (item: T) => React.ReactNode;
        }
        export const StringList = (props: ListProps<string>) => <ul />;
      `);

      const { props } = docs[0];
      expect(props.items).toBeDefined();
      expect(props.items.type.name).toBe('string[]');
      expect(props.renderItem).toBeDefined();
    });

    it('extracts number literal union as enum', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { columns: 1 | 2 | 3 | 4 }
        export const Grid = (props: Props) => <div />;
      `);

      const { props } = docs[0];
      expect(props.columns.type.name).toBe('enum');
      expect(props.columns.type.value).toEqual([
        { value: '1' },
        { value: '2' },
        { value: '3' },
        { value: '4' },
      ]);
    });

    it('extracts mixed union (string | number) as type string, not enum', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { value: string | number }
        export const Input = (props: Props) => <input />;
      `);

      const { props } = docs[0];
      expect(props.value.type.name).toBe('string | number');
    });

    it('extracts function prop types', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          onClick: () => void;
          onChange: (value: string) => void;
          onSubmit: (event: React.FormEvent) => Promise<void>;
        }
        export const Form = (props: Props) => <form />;
      `);

      const { props } = docs[0];
      expect(props.onClick.type.name).toBe('() => void');
      expect(props.onChange.type.name).toBe('(value: string) => void');
    });

    it('extracts complex nested object props', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Theme {
          colors: { primary: string; secondary: string };
          spacing: number;
        }
        interface Props { theme: Theme; label: string }
        export const Button = (props: Props) => <button />;
      `);

      const { props } = docs[0];
      expect(props.theme).toBeDefined();
      expect(props.theme.type.name).toBe('Theme');
      expect(props.label.type.name).toBe('string');
    });

    it('extracts React.ReactNode and React.ReactElement prop types', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props {
          children: React.ReactNode;
          icon: React.ReactElement;
          header?: React.ReactNode;
        }
        export const Card = (props: Props) => <div />;
      `);

      const { props } = docs[0];
      expect(props.children).toBeDefined();
      expect(props.children.required).toBe(true);
      expect(props.icon).toBeDefined();
      expect(props.header).toBeDefined();
      expect(props.header.required).toBe(false);
    });

    it('handles component extending HTML element props with >30 filter', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          variant: 'primary' | 'secondary';
          label: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      // User-defined props should be present
      expect(props.variant).toBeDefined();
      expect(props.label).toBeDefined();
      // HTMLButtonElement has >30 props from node_modules — should be filtered
      expect(props.onClick).toBeUndefined();
      expect(props.className).toBeUndefined();
    });

    it('preserves small HTML element extends (under threshold)', () => {
      const docs = extractSingle(`
        import React from 'react';
        type ButtonProps = Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'type'> & {
          label: string;
        };
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      expect(props.label).toBeDefined();
      // Pick with only 2 HTML props — under threshold, should be kept
      expect(props.disabled).toBeDefined();
      expect(props.type).toBeDefined();
    });

    it('extracts forwardRef component props without ref/key noise', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Props { label: string; variant?: 'a' | 'b' }
        export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
          <button ref={ref} />
        ));
      `);

      const { props } = docs[0];
      expect(props.label).toBeDefined();
      expect(props.variant).toBeDefined();
      // ref and key come from RefAttributes — only 2 props, under >30 threshold
      // so they'll be present. That's expected.
    });
  });

  describe('source/parent tracking', () => {
    it('tracks parent through intersection types', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface BaseProps {
          /** Unique identifier */
          id: string;
        }
        interface StyleProps {
          /** Custom CSS class */
          className?: string;
        }
        type ButtonProps = BaseProps & StyleProps & {
          /** The label */
          label: string;
        };
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];

      // Props from named interfaces track their parent
      expect(props.id.parent?.name).toBe('BaseProps');
      expect(props.id.description).toBe('Unique identifier');

      expect(props.className.parent?.name).toBe('StyleProps');
      expect(props.className.description).toBe('Custom CSS class');

      // Inline type literal
      expect(props.label.description).toBe('The label');
    });

    it('tracks parent through extends', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface BaseProps {
          /** Unique identifier */
          id: string;
        }
        interface ButtonProps extends BaseProps {
          label: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      expect(props.id.parent?.name).toBe('BaseProps');
      expect(props.id.description).toBe('Unique identifier');
      expect(props.label.parent?.name).toBe('ButtonProps');
    });

    it('tracks declarations from multiple sources', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface A { shared: string }
        interface B { shared: string }
        type Props = A & B;
        export const Comp = (props: Props) => <div />;
      `);

      const { props } = docs[0];
      // 'shared' is declared in both A and B
      expect(props.shared.declarations).toBeDefined();
      expect(props.shared.declarations!.length).toBeGreaterThanOrEqual(2);
      const names = props.shared.declarations!.map((d) => d.name).sort();
      expect(names).toEqual(['A', 'B']);
    });

    it('source file is set for >30 filter', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          /** Custom variant */
          variant: 'primary' | 'secondary';
        }
        export const Button = (props: ButtonProps) => <button />;
      `);

      const { props } = docs[0];
      // variant is our own prop — should survive the >30 filter
      expect(props.variant).toBeDefined();
      expect(props.variant.parent?.name).toBe('ButtonProps');
      expect(props.variant.description).toBe('Custom variant');

      // onClick etc from ButtonHTMLAttributes are >30 per source file — filtered out
      expect(props.onClick).toBeUndefined();
    });
  });

  describe('type flattening (getApparentProperties)', () => {
    it('flattens Pick<> to concrete props', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Full { a: string; b: number; c: boolean }
        export const Comp = (props: Pick<Full, 'a' | 'b'>) => <div />;
      `);

      const { props } = docs[0];
      expect(Object.keys(props).sort()).toEqual(['a', 'b']);
      expect(props.a.type.name).toBe('string');
      expect(props.b.type.name).toBe('number');
    });

    it('flattens Omit<> to concrete props', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Full { a: string; b: number; c: boolean }
        export const Comp = (props: Omit<Full, 'c'>) => <div />;
      `);

      const { props } = docs[0];
      expect(Object.keys(props).sort()).toEqual(['a', 'b']);
    });

    it('flattens intersection to all member props', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface A { x: string }
        interface B { y: number }
        export const Comp = (props: A & B) => <div />;
      `);

      const { props } = docs[0];
      expect(Object.keys(props).sort()).toEqual(['x', 'y']);
      expect(props.x.type.name).toBe('string');
      expect(props.y.type.name).toBe('number');
    });

    it('flattens complex Pick & Omit combination', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface Full { a: string; b: number; c: boolean; d: string }
        type Props = Pick<Full, 'a' | 'b' | 'c'> & Omit<{ extra: string; d: number }, 'd'>;
        export const Comp = (props: Props) => <div />;
      `);

      const { props } = docs[0];
      expect(props.a).toBeDefined();
      expect(props.b).toBeDefined();
      expect(props.c).toBeDefined();
      expect(props.extra).toBeDefined();
      expect(props.d).toBeUndefined(); // omitted
    });

    it('resolves generic instantiation to concrete types', () => {
      const docs = extractSingle(`
        import React from 'react';
        interface ListProps<T> {
          items: T[];
          selected?: T;
        }
        export const NumberList = (props: ListProps<number>) => <ul />;
      `);

      const { props } = docs[0];
      expect(props.items.type.name).toBe('number[]');
      expect(props.selected.type.name).toBe('number');
    });
  });
});

// ---------------------------------------------------------------------------
// QA failure patterns — tests for patterns that react-docgen-typescript
// fails on in real design systems. These validate that our ComponentProps
// probe approach handles them correctly.
// See: plans/rdt-failing-tests.md
// ---------------------------------------------------------------------------

const f = (name: string) => path.join(VIRTUAL_ROOT, `__virtual__/${name}`);

describe('QA: patterns RDT fails on', () => {
  describe('Pattern 1: ForwardRefExoticComponent from HOC factory (Park UI)', () => {
    it('detects component returned by withProvider HOC', () => {
      const docs = extract({
        [f('styled.tsx')]: `
          import React from 'react';

          function withProvider<T extends HTMLElement, P>(
            Component: React.ComponentType<any>,
            _slot: string
          ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
            return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
          }

          interface RootProps {
            /** The accordion items */
            items: string[];
            /** Whether multiple items can be open */
            multiple?: boolean;
          }

          const InternalRoot = (props: RootProps) => <div />;

          export const Root = withProvider<HTMLDivElement, RootProps>(InternalRoot, 'root');
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Root');
      expect(docs[0].props).toHaveProperty('items');
      expect(docs[0].props).toHaveProperty('multiple');
      expect(docs[0].props.items.required).toBe(true);
      expect(docs[0].props.multiple.required).toBe(false);
      expect(docs[0].props.items.description).toBe('The accordion items');
    });

    it('detects component returned by withContext HOC', () => {
      const docs = extract({
        [f('context.tsx')]: `
          import React from 'react';

          function withContext<T extends HTMLElement, P>(
            Component: React.ComponentType<any>,
            _slot: string
          ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
            return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
          }

          interface ItemTriggerProps {
            /** Click handler */
            onClick?: () => void;
          }

          const BaseItemTrigger = (props: ItemTriggerProps) => <button />;

          export const ItemTrigger = withContext<HTMLButtonElement, ItemTriggerProps>(
            BaseItemTrigger, 'itemTrigger'
          );
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('ItemTrigger');
      expect(docs[0].props).toHaveProperty('onClick');
    });

    it('detects multiple HOC-wrapped sub-components in one file', () => {
      const docs = extract({
        [f('accordion.tsx')]: `
          import React from 'react';

          function withProvider<T extends HTMLElement, P>(
            Component: React.ComponentType<any>,
            _slot: string
          ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
            return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
          }

          function withContext<T extends HTMLElement, P>(
            Component: React.ComponentType<any>,
            _slot: string
          ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
            return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
          }

          interface RootProps { multiple?: boolean }
          interface ItemProps { value: string; disabled?: boolean }
          interface ItemTriggerProps { onClick?: () => void }

          const InternalRoot = (props: RootProps) => <div />;
          const InternalItem = (props: ItemProps) => <div />;
          const InternalTrigger = (props: ItemTriggerProps) => <button />;

          export const Root = withProvider<HTMLDivElement, RootProps>(InternalRoot, 'root');
          export const Item = withContext<HTMLDivElement, ItemProps>(InternalItem, 'item');
          export const ItemTrigger = withContext<HTMLButtonElement, ItemTriggerProps>(
            InternalTrigger, 'itemTrigger'
          );
        `,
      });

      expect(docs).toHaveLength(3);
      const names = docs.map((d) => d.displayName).sort();
      expect(names).toEqual(['Item', 'ItemTrigger', 'Root']);

      const item = docs.find((d) => d.displayName === 'Item')!;
      expect(item.props.value.required).toBe(true);
      expect(item.props.disabled.required).toBe(false);
    });
  });

  describe('Pattern 2: as-cast with marker intersection (Primer)', () => {
    it('detects component after as WithSlotMarker cast', () => {
      const docs = extractSingle(`
        import React from 'react';

        interface CheckboxProps {
          /** Whether the checkbox is checked */
          checked?: boolean;
          /** Change handler */
          onChange?: (checked: boolean) => void;
          /** Disabled state */
          disabled?: boolean;
        }

        interface SlotMarker { __SLOT__?: symbol }
        type WithSlotMarker<T> = T & SlotMarker;

        const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>((props, ref) => (
          <input type="checkbox" ref={ref} />
        ));

        (Checkbox as WithSlotMarker<typeof Checkbox>).__SLOT__ = Symbol('Checkbox');

        export default Checkbox as WithSlotMarker<typeof Checkbox>;
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].props).toHaveProperty('checked');
      expect(docs[0].props).toHaveProperty('onChange');
      expect(docs[0].props).toHaveProperty('disabled');
      expect(docs[0].props.checked.description).toBe('Whether the checkbox is checked');
    });
  });

  describe('Pattern 3: as PolymorphicForwardRefComponent (Primer)', () => {
    it('detects component cast to polymorphic forwardRef interface', () => {
      const docs = extract({
        [f('polymorphic.tsx')]: `
          import React from 'react';

          // Simplified version of Primer's PolymorphicForwardRefComponent
          type Merge<A, B> = Omit<A, keyof B> & B;

          interface PolymorphicForwardRefComponent<
            DefaultElement extends React.ElementType,
            OwnProps = {}
          > extends React.ForwardRefExoticComponent<
            Merge<React.ComponentPropsWithRef<DefaultElement>, OwnProps & { as?: DefaultElement }>
          > {
            <As extends React.ElementType = DefaultElement>(
              props: Merge<React.ComponentPropsWithRef<As>, OwnProps & { as?: As }>
            ): React.ReactElement | null;
          }

          interface ButtonProps {
            /** Button variant style */
            variant?: 'default' | 'primary' | 'danger';
            /** Button size */
            size?: 'small' | 'medium' | 'large';
          }

          const ButtonComponent = React.forwardRef<HTMLButtonElement, ButtonProps>(
            (props, ref) => <button ref={ref} />
          ) as PolymorphicForwardRefComponent<'button', ButtonProps>;

          ButtonComponent.displayName = 'Button';

          export { ButtonComponent as Button };
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].exportName).toBe('Button');
      expect(docs[0].props).toHaveProperty('variant');
      expect(docs[0].props).toHaveProperty('size');
      expect(docs[0].props.variant.description).toBe('Button variant style');
    });

    it('extracts destructuring defaults from forwardRef with as-cast', () => {
      const docs = extract({
        [f('stack.tsx')]: `
          import React, { forwardRef, type ElementType } from 'react';

          interface PolymorphicForwardRefComponent<
            DefaultElement extends React.ElementType,
            OwnProps = {}
          > extends React.ForwardRefExoticComponent<
            Omit<React.ComponentPropsWithRef<DefaultElement>, keyof OwnProps> & OwnProps & { as?: DefaultElement }
          > {
            <As extends React.ElementType = DefaultElement>(
              props: Omit<React.ComponentPropsWithRef<As>, keyof OwnProps> & OwnProps & { as?: As }
            ): React.ReactElement | null;
          }

          interface StackProps {
            /** Specify the direction for the stack */
            direction?: 'horizontal' | 'vertical';
            /** Specify the alignment */
            align?: 'stretch' | 'start' | 'center' | 'end';
            /** Specify wrapping */
            wrap?: 'wrap' | 'nowrap';
          }

          const Stack = forwardRef(
            ({
              direction = 'vertical',
              align = 'stretch',
              wrap = 'nowrap',
              ...rest
            }: StackProps, forwardedRef: React.Ref<HTMLDivElement>) => {
              return <div ref={forwardedRef} {...rest} />;
            },
          ) as PolymorphicForwardRefComponent<ElementType, StackProps>;

          export { Stack };
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].exportName).toBe('Stack');
      expect(docs[0].props.direction.defaultValue).toEqual({ value: "'vertical'" });
      expect(docs[0].props.align.defaultValue).toEqual({ value: "'stretch'" });
      expect(docs[0].props.wrap.defaultValue).toEqual({ value: "'nowrap'" });
    });
  });

  describe('Pattern 4: Object.assign compound component (Primer)', () => {
    it('detects component from Object.assign compound export', () => {
      const docs = extractSingle(`
        import React from 'react';

        interface FormControlProps {
          /** Unique identifier */
          id: string;
          /** Whether the field is required */
          required?: boolean;
          /** Whether the field is disabled */
          disabled?: boolean;
        }

        const FormControlBase = React.forwardRef<HTMLDivElement, FormControlProps>(
          (props, ref) => <div ref={ref} />
        );

        const Caption = (props: { children: React.ReactNode }) => <span />;
        const Label = (props: { children: React.ReactNode }) => <label />;

        const FormControl = Object.assign(FormControlBase, {
          Caption,
          Label,
        });

        export default FormControl;
      `);

      expect(docs).toHaveLength(1);
      expect(docs[0].props).toHaveProperty('id');
      expect(docs[0].props).toHaveProperty('required');
      expect(docs[0].props).toHaveProperty('disabled');
      expect(docs[0].props.id.required).toBe(true);
      expect(docs[0].props.id.description).toBe('Unique identifier');
      // Sub-components should NOT appear as props
      expect(docs[0].props).not.toHaveProperty('Caption');
      expect(docs[0].props).not.toHaveProperty('Label');
    });
  });

  describe('Pattern 5: aliased barrel re-export (Primer)', () => {
    it('detects component through aliased re-export', () => {
      const buttonPath = f('BarrelButton.tsx');
      const indexPath = f('BarrelIndex.ts');

      const files = {
        [buttonPath]: `
          import React from 'react';
          interface ButtonProps {
            /** Button label */
            label: string;
            /** Visual variant */
            variant?: 'solid' | 'outline' | 'ghost';
          }
          export const InternalButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
            (props, ref) => <button ref={ref}>{props.label}</button>
          );
          InternalButton.displayName = 'Button';
        `,
        [indexPath]: `export { InternalButton as Button } from './BarrelButton';`,
      };

      const program = createVirtualProgram(files);
      const docs = extractComponentDocs(ts, indexPath, program);

      expect(docs).toHaveLength(1);
      expect(docs[0].exportName).toBe('Button');
      expect(docs[0].props).toHaveProperty('label');
      expect(docs[0].props).toHaveProperty('variant');
      expect(docs[0].props.label.required).toBe(true);
      expect(docs[0].props.variant.type.name).toBe('enum');
    });
  });

  describe('Pattern 6: empty interface with deep extends (Mantine)', () => {
    it('extracts props from empty interface extending multiple bases', () => {
      const docs = extract({
        [f('TextInput.tsx')]: `
          import React from 'react';

          interface StylesApiProps {
            /** CSS class name */
            className?: string;
            /** Inline styles */
            style?: React.CSSProperties;
          }

          interface BaseInputProps {
            /** Input label */
            label?: React.ReactNode;
            /** Error message */
            error?: React.ReactNode;
            /** Description text */
            description?: React.ReactNode;
          }

          interface BoxProps {
            /** Custom component */
            component?: React.ElementType;
          }

          // Simulates Mantine's ElementProps — extends HTML attributes
          type ElementProps<E extends React.ElementType, Excluded extends string = never> =
            Omit<React.ComponentPropsWithoutRef<E>, Excluded>;

          // The problematic pattern: empty body, everything from extends
          interface TextInputProps extends BoxProps, BaseInputProps,
            StylesApiProps, ElementProps<'input', 'size'> {}

          export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
            (props, ref) => <input ref={ref} />
          );
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('TextInput');
      // Props from BaseInputProps
      expect(docs[0].props).toHaveProperty('label');
      expect(docs[0].props).toHaveProperty('error');
      expect(docs[0].props).toHaveProperty('description');
      // Props from BoxProps
      expect(docs[0].props).toHaveProperty('component');
      // Props from StylesApiProps
      expect(docs[0].props).toHaveProperty('className');
      expect(docs[0].props).toHaveProperty('style');
      // HTML input props should be filtered by >30 threshold
      expect(docs[0].props).not.toHaveProperty('onChange');
      expect(docs[0].props).not.toHaveProperty('onBlur');
    });
  });

  describe('Pattern 7: factory() wrapping forwardRef internally (Mantine)', () => {
    it('detects component from factory HOC', () => {
      const docs = extract({
        [f('factory.tsx')]: `
          import React from 'react';

          interface FactoryPayload {
            props: Record<string, any>;
            ref: HTMLElement;
          }

          type MantineComponent<Payload extends FactoryPayload> =
            React.ForwardRefExoticComponent<
              Payload['props'] & React.RefAttributes<Payload['ref']>
            >;

          function factory<Payload extends FactoryPayload>(
            renderFn: (props: Payload['props'], ref: React.Ref<Payload['ref']>) => React.ReactNode
          ): MantineComponent<Payload> {
            const Component = React.forwardRef(renderFn as any) as any;
            return Component;
          }

          interface SelectProps {
            /** Currently selected value */
            value?: string;
            /** Change handler */
            onChange?: (value: string | null) => void;
            /** Dropdown options */
            data: string[];
            /** Whether the select is searchable */
            searchable?: boolean;
          }

          interface SelectFactory extends FactoryPayload {
            props: SelectProps;
            ref: HTMLInputElement;
          }

          export const Select = factory<SelectFactory>((_props, ref) => {
            return <input ref={ref} />;
          });
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Select');
      expect(docs[0].props).toHaveProperty('value');
      expect(docs[0].props).toHaveProperty('onChange');
      expect(docs[0].props).toHaveProperty('data');
      expect(docs[0].props).toHaveProperty('searchable');
      expect(docs[0].props.data.required).toBe(true);
      expect(docs[0].props.searchable.required).toBe(false);
      expect(docs[0].props.value.description).toBe('Currently selected value');
    });
  });

  describe('Pattern 8a: polymorphicFactory() with HTML extends (Mantine)', () => {
    it('extracts user props from polymorphicFactory component extending HTMLButtonElement', () => {
      const docs = extract({
        [f('polymorphicFactory.tsx')]: `
          import React from 'react';

          // Simplified version of Mantine's polymorphic type utilities
          type ExtendedProps<Props = {}, OverrideProps = {}> = OverrideProps &
            Omit<Props, keyof OverrideProps>;

          type InheritedProps<C extends React.ElementType, Props = {}> =
            ExtendedProps<React.ComponentPropsWithoutRef<C>, Props>;

          type PolymorphicComponentProps<C, Props = {}> = C extends React.ElementType
            ? InheritedProps<C, Props & { component?: C }> & {
                ref?: C extends React.ElementType
                  ? React.ComponentPropsWithRef<C>['ref']
                  : never;
                renderRoot?: (props: any) => any;
              }
            : Props & { component: React.ElementType; renderRoot?: (props: Record<string, any>) => React.ReactNode };

          // Simplified PolymorphicFactoryPayload
          interface FactoryPayload {
            props: Record<string, any>;
            defaultComponent: any;
            defaultRef: any;
          }

          // The key type: generic callable (not ForwardRefExoticComponent)
          type PolymorphicComponent<Payload extends FactoryPayload> =
            (<C = Payload['defaultComponent']>(
              props: PolymorphicComponentProps<C, Payload['props']>
            ) => React.ReactElement) &
            Omit<React.FunctionComponent<PolymorphicComponentProps<any, Payload['props']>>, never>;

          function polymorphicFactory<Payload extends FactoryPayload>(
            ui: React.ForwardRefRenderFunction<Payload['defaultRef'], Payload['props']>
          ): PolymorphicComponent<Payload> {
            return React.forwardRef(ui) as unknown as PolymorphicComponent<Payload>;
          }

          // Component-specific types
          interface ButtonProps {
            /** Custom variant */
            variant?: 'primary' | 'secondary' | 'outline';
            /** Button label text */
            label: string;
            /** Whether loading */
            loading?: boolean;
          }

          interface ButtonFactory extends FactoryPayload {
            props: ButtonProps;
            defaultComponent: 'button';
            defaultRef: HTMLButtonElement;
          }

          export const Button = polymorphicFactory<ButtonFactory>((_props, ref) => {
            return <button ref={ref} />;
          });
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      // User-defined props should survive the >30 filter
      expect(docs[0].props).toHaveProperty('variant');
      expect(docs[0].props).toHaveProperty('label');
      expect(docs[0].props).toHaveProperty('loading');
      expect(docs[0].props.variant.description).toBe('Custom variant');
      expect(docs[0].props.label.required).toBe(true);
      expect(docs[0].props.loading.required).toBe(false);
      // HTML button attributes should be filtered (>30 from @types/react)
      expect(docs[0].props).not.toHaveProperty('onClick');
      expect(docs[0].props).not.toHaveProperty('className');
    });

    it('extracts user props from polymorphicFactory with BoxProps-like utility base (40+ props)', () => {
      const docs = extract({
        [f('polymorphicWithBox.tsx')]: `
          import React from 'react';

          // Simulates Mantine's BoxProps — a large utility interface with >30 style props
          interface BoxProps {
            m?: string; mt?: string; mb?: string; ml?: string; mr?: string;
            mx?: string; my?: string;
            p?: string; pt?: string; pb?: string; pl?: string; pr?: string;
            px?: string; py?: string;
            bg?: string; c?: string; opacity?: string;
            ff?: string; fz?: string; fw?: string; lts?: string; ta?: string;
            lh?: string; fs?: string; tt?: string; td?: string;
            w?: string; miw?: string; maw?: string;
            h?: string; mih?: string; mah?: string;
            pos?: string; top?: string; left?: string; bottom?: string; right?: string;
            inset?: string; display?: string;
          }

          type ExtendedProps<Props = {}, OverrideProps = {}> = OverrideProps &
            Omit<Props, keyof OverrideProps>;

          type InheritedProps<C extends React.ElementType, Props = {}> =
            ExtendedProps<React.ComponentPropsWithoutRef<C>, Props>;

          type PolymorphicComponentProps<C, Props = {}> = C extends React.ElementType
            ? InheritedProps<C, Props & { component?: C }> & {
                ref?: C extends React.ElementType
                  ? React.ComponentPropsWithRef<C>['ref']
                  : never;
              }
            : Props & { component: React.ElementType };

          interface FactoryPayload {
            props: Record<string, any>;
            defaultComponent: any;
            defaultRef: any;
          }

          type PolymorphicComponent<Payload extends FactoryPayload> =
            (<C = Payload['defaultComponent']>(
              props: PolymorphicComponentProps<C, Payload['props']>
            ) => React.ReactElement) &
            Omit<React.FunctionComponent<PolymorphicComponentProps<any, Payload['props']>>, never>;

          function polymorphicFactory<Payload extends FactoryPayload>(
            ui: React.ForwardRefRenderFunction<Payload['defaultRef'], Payload['props']>
          ): PolymorphicComponent<Payload> {
            return React.forwardRef(ui) as unknown as PolymorphicComponent<Payload>;
          }

          // Component props extend BoxProps (40+ style utility props)
          interface ButtonProps extends BoxProps {
            /** Custom variant */
            variant?: 'primary' | 'secondary';
            /** Button size */
            size?: 'sm' | 'md' | 'lg';
          }

          interface ButtonFactory extends FactoryPayload {
            props: ButtonProps;
            defaultComponent: 'button';
            defaultRef: HTMLButtonElement;
          }

          export const Button = polymorphicFactory<ButtonFactory>((_props, ref) => {
            return <button ref={ref} />;
          });
        `,
      });

      expect(docs).toHaveLength(1);
      expect(docs[0].displayName).toBe('Button');
      // Component-specific props must survive
      expect(docs[0].props).toHaveProperty('variant');
      expect(docs[0].props).toHaveProperty('size');
      expect(docs[0].props.variant.description).toBe('Custom variant');
      // BoxProps are from a local file (not node_modules) — should also be present
      // even though there are >30 of them
      expect(docs[0].props).toHaveProperty('m');
      expect(docs[0].props).toHaveProperty('bg');
      // HTML button attributes should be filtered (>30 from @types/react node_modules)
      expect(docs[0].props).not.toHaveProperty('onClick');
      expect(docs[0].props).not.toHaveProperty('className');
    });
  });

  describe('Pattern 8: false positive rejection', () => {
    it('rejects utility function with single object param', () => {
      expect(detect(`
        export function CreateTheme(options: { primary: string; secondary: string }) {
          return { colors: options };
        }
      `)).toEqual([]);
    });

    it('rejects higher-order function returning non-component', () => {
      expect(detect(`
        export function CreateValidator(config: { strict: boolean }) {
          return (value: string) => config.strict ? value.trim() : value;
        }
      `)).toEqual([]);
    });

    it('rejects class not extending React.Component', () => {
      expect(detect(`
        export class EventEmitter {
          private listeners = new Map<string, Function[]>();
          on(event: string, fn: Function) { /* ... */ }
          emit(event: string) { /* ... */ }
        }
      `)).toEqual([]);
    });

    it('rejects namespace-like const object', () => {
      expect(detect(`
        export const Utils = {
          format: (value: string) => value.trim(),
          parse: (input: string) => JSON.parse(input),
        };
      `)).toEqual([]);
    });

    it('rejects async function returning non-ReactNode', () => {
      expect(detect(`
        export async function FetchData(url: string) {
          const response = await fetch(url);
          return response.json();
        }
      `)).toEqual([]);
    });
  });
});
