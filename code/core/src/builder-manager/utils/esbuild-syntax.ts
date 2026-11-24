import { extname } from 'pathe';
import type { Plugin } from 'rolldown';

import { BROWSER_TARGETS } from '../../shared/constants/environments-support.ts';

// What CSS, Sass or a license comment writes after `@`, in text that is no decorator. The first
// group is never one. The second is one only when called, as Lit's `@property()`.
const NEVER = 'media|supports|container|scope';
const UNLESS_CALLED = [
  'charset|import|namespace|layer|font-face|keyframes|page|property|counter-style',
  'font-feature-values|font-palette-values|position-try|starting-style|view-transition',
  'include|mixin|extend|use|forward|if|else|each|for|while|function|return|apply|tailwind|screen',
  'license|preserve|copyright|author|version|cc_on|link|linkcode|linkplain|inheritDoc|label',
].join('|');
// A decorator starts a line or follows `{`, `}`, `;`, `=`, `export` or `default`. Neither a
// template placeholder nor the name of a scoped package is one.
const DECORATOR = `@(?<=(?:^|[{};=]|\\b(?:export|default)\\s)[ \\t\\r\\n]*@)(?!\\$\\{)(?![\\w$.-]+\\/)(?!(?:${NEVER})\\b)(?!(?:${UNLESS_CALLED})(?![\\w$(]))[A-Za-z_$(]`;
const ACCESSOR = `accessor(?<=(?:^|[{};]|\\bstatic)\\s*accessor)\\s+[\\w$#["']`;

// Rolldown leaves decorators and `accessor` fields as written, which no supported browser runs.
// The match is loose: a file that only seems to use them is compiled by esbuild all the same.
// Both patterns start with their rarest text, so that scanning every module stays cheap.
const DECORATORS = new RegExp(`${DECORATOR}|${ACCESSOR}`, 'm');
// Rolldown loses the members that one block of a merged namespace reads from another.
const NAMESPACES = /\b(?:namespace|module)\s+[\w$.]+\s*\{/;

const LOADERS: Record<string, 'ts' | 'tsx' | 'js'> = {
  '.ts': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.tsx': 'tsx',
  '.mjs': 'js',
  '.cjs': 'js',
};

const compileWithEsbuild = (name: string, id: RegExp, code: RegExp): Plugin => ({
  name,
  transform: {
    filter: { id, code },
    handler: async (source, file) => {
      const { transform } = await import('esbuild');
      const compiled = await transform(source, {
        loader: LOADERS[extname(file)] ?? 'jsx',
        target: BROWSER_TARGETS,
        sourcefile: file,
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
      });
      return { code: compiled.code, moduleType: 'js' };
    },
  },
});

// esbuild compiles the files that use syntax which Rolldown does not compile as esbuild does.
export const esbuildSyntax = (): Plugin[] => [
  compileWithEsbuild('storybook:manager-namespaces', /\.[cm]?tsx?$/, NAMESPACES),
  compileWithEsbuild('storybook:manager-decorators', /\.[cm]?[jt]sx?$/, DECORATORS),
];
