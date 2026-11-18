import type { PackageJson } from '../types/index.ts';

/**
 * Detects whether a Next.js project opts into Turbopack via an explicit `--turbopack` /
 * `--webpack` flag on its `next dev` / `next build` scripts.
 *
 * Returns:
 *
 * - `true` when a `next` script explicitly passes `--turbopack`
 * - `false` when a `next` script explicitly passes `--webpack`
 * - `undefined` when no `next` script is found, or none of them pass either flag (this is
 *   ambiguous from Next.js 16 onwards, where Turbopack is the default bundler)
 *
 * @param packageJson The package JSON of the project
 * @returns Boolean-ish turbopack usage, or undefined when it can't be determined
 */
export function getHasTurbopack(packageJson: PackageJson): boolean | undefined {
  // a `next dev` / `next build` invocation, with `next` as a standalone command word — the only
  // Next CLI commands that accept a bundler flag. Not part of another command or path such as
  // `next-sitemap`, `something-next` or `next.config.js`, and not `next` as an argument to
  // another command such as `echo next`.
  const nextCommand = /(?<![\w/.-])next\s+(?:dev|build)(?![\w.-])/;
  const scripts = Object.values(packageJson?.scripts ?? {}).filter(
    (script): script is string => typeof script === 'string' && nextCommand.test(script)
  );

  if (scripts.length === 0) {
    return undefined;
  }

  if (scripts.some((script) => /--turbopack\b/.test(script))) {
    return true;
  }

  if (scripts.some((script) => /--webpack\b/.test(script))) {
    return false;
  }

  return undefined;
}
