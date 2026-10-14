/**
 * Fills a Svelte CSF story template (the `<Story>` content as authored) with the current args.
 *
 * Copied from `generateCodeToEmit` in `@storybook/svelte` (`svelte-csf/runtime/emit-code.ts`), the
 * original of the JSX filler in `fill-template.ts`; core cannot import from renderers. Keep both in
 * sync.
 */
export function fillSvelteTemplate(code: string, args: Record<string, unknown> = {}): string {
  // A template that renders `{args.children}` as content must not also get it as a prop.
  const childrenUsedInTemplate = /\bargs\??\.children\b/.test(code);

  const allPropsArray = Object.entries(args ?? {})
    .map(([argKey, argValue]) =>
      childrenUsedInTemplate && argKey === 'children' ? null : argsToProps(argKey, argValue)
    )
    .filter((p) => p);

  let allPropsString = allPropsArray.join(' ');
  if (allPropsString.length > 50) {
    allPropsString = `\n  ${allPropsArray.join('\n  ')}\n`;
  }

  return (
    code
      .replaceAll('{...args}', allPropsString)
      // <Button>{args.children}</Button> => <Button>Click me</Button>; prop={args.x} is skipped
      .replace(/(?<!=)\{\s*(args(?:[\w\d_$.?[\]"'])+)\s*\}/g, (match, argPath: string) => {
        const value = getPath({ args }, argPath.replaceAll('?', ''));
        return isPlainText(value) ? value : match;
      })
      // myProp={args.something} => myProp={"actual"}
      .replace(/args(?:[\w\d_$.?[\]"'])+/g, (argPath) =>
        valueToString(getPath({ args }, argPath.replaceAll('?', '')))
      )
  );
}

/** Minimal `lodash.get` for paths such as `args.items[0]["label"]`. */
function getPath(object: unknown, path: string): unknown {
  const keys = path
    .replace(/\[\s*(['"]?)(.*?)\1\s*\]/g, '.$2')
    .split('.')
    .filter(Boolean);
  let current: any = object;
  for (const key of keys) {
    if (current == null) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

const isPlainText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !/[{}<>"\\&]/.test(value);

type MockableFunction = ((...args: any[]) => any) & { getMockName?: () => string };

const getFunctionName = (fn: MockableFunction) => {
  const name = fn.getMockName?.() ?? fn.name;
  return name && name !== 'spy' ? name : '() => {}';
};

const valueToString = (value: any): string => {
  if (typeof value === 'object' && value?.[Symbol.for('svelte.snippet')]) {
    return 'snippet';
  }
  if (typeof value === 'function') {
    return getFunctionName(value);
  }
  return JSON.stringify(value, null, 1)
    ?.replace(/\n/g, '')
    .replace(/(?<!\s)([}\]])$/, ' $1');
};

const argsToProps = (key: string, value: any): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === true) {
    return key;
  }
  const stringValue = valueToString(value);
  return typeof value === 'string' ? `${key}=${stringValue}` : `${key}={${stringValue}}`;
};
