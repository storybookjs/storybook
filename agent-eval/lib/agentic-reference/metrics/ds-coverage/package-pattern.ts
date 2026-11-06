// Which bare import specifiers belong to the design system.
//
// The DS is named by import patterns (`@base-ui/react`, `storybook/internal/components`)
// matched against a specifier as a prefix. That covers both shapes a DS ships in:
// a package whose subpaths are all DS (`@base-ui/react/button`), and a package
// that exposes its DS at one subpath among many (`storybook/internal/components`
// is one of many folders of a monorepo).

/** The package-name half of a bare specifier: `@scope/name` or `name`. */
export function packageNameOf(specifier: string): string {
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : (segments[0] ?? specifier);
}

/**
 * A predicate over bare specifiers for a list of import patterns. `*` matches
 * within one path segment (`@ds/*` matches `@ds/button`, not `@dsx/button`);
 * everything else is literal.
 *
 * A pattern matches exact matches and prefix matches e.g. `^${pattern}/`:
 * `@base-ui/react` covers `@base-ui/react/button` but not `@base-ui/react-extras`.
 */
export function createPackageMatcher(patterns: string[]): (specifier: string) => boolean {
  const matchers = patterns.map((pattern) => {
    const source = pattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*');
    return new RegExp(`^${source}(?:/|$)`);
  });

  return (specifier) => matchers.some((matcher) => matcher.test(specifier));
}
