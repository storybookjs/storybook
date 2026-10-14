import type { StoryObj } from '../../../public-types.ts';
import { get, isEqual } from 'es-toolkit/compat';

const generateLegacyCode = ({ code, args }: { code: string; args: StoryObj['args'] }) => {
  // check if children is used in the template (e.g., {args.children})
  // if so, we should exclude it from the props to avoid it appearing twice
  const childrenUsedInTemplate = /\bargs\??\.children\b/.test(code);

  const allPropsArray = Object.entries(args ?? {})
    .map(([argKey, argValue]) => {
      // skip children if it's used in the template content (slot)
      if (childrenUsedInTemplate && argKey === 'children') {
        return null;
      }
      return argsToProps(argKey, argValue);
    })
    .filter((p) => p);

  let allPropsString = allPropsArray.join(' ');
  // make the props multiline if the string is longer than 50 chars
  // TODO: do this at the final stage instead, taking into account the singular args replacements
  if (allPropsString.length > 50) {
    // TODO: the indentation only works if it's in the root-level component. In a nested component, the indentation will be too shallow
    allPropsString = `\n  ${allPropsArray.join('\n  ')}\n`;
  }

  const codeToEmit = code
    .replaceAll('{...args}', allPropsString)
    // replace text expressions that reference a string arg with the plain text,
    // eg. <Button>{args.children}</Button> => <Button>Click me</Button>
    // attribute values like prop={args.something} are skipped
    .replace(/(?<!=)\{\s*(args(?:[\w\d_$.?[\]"'])+)\s*\}/g, (match, argPath: string) => {
      const value = get({ args }, argPath.replaceAll('?', ''));
      return isPlainText(value) ? value : match;
    })
    // replace single arg references with their actual value,
    // eg. myProp={args.something} => myProp={"actual"}
    // or <h1>{args.something}</h1> => <h1>"actual"</h1>
    .replace(/args(?:[\w\d_$.?[\]"'])+/g, (argPath) => {
      const path = argPath.replaceAll('?', ''); // remove optional chaining character
      const value = get({ args }, path);
      return valueToString(value);
    });

  return codeToEmit;
};

const isPlainText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !/[{}<>"\\&]/.test(value);

type MockableFunction = ((...args: any[]) => any) & {
  getMockName?: () => string;
};

const getFunctionName = (fn: MockableFunction) => {
  const name = fn.getMockName?.() ?? fn.name;
  if (name && name !== 'spy') {
    return name;
  }
  return '() => {}';
};

export const valueToString = (value: any): string => {
  if (typeof value === 'object' && value[Symbol.for('svelte.snippet')]) {
    return 'snippet';
  }

  if (typeof value === 'function') {
    return getFunctionName(value);
  }

  return (
    JSON.stringify(value, null, 1)
      ?.replace(/\n/g, '')
      // Find "}" or "]" at the end of the string, not preceded by a space, and add a space
      .replace(/(?<!\s)([}\]])$/, ' $1')
  );
};

export const argsToProps = (key: string, value: any): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (value === true) {
    return key;
  }

  const stringValue = valueToString(value);

  if (typeof value === 'string') {
    return `${key}=${stringValue}`;
  }

  return `${key}={${stringValue}}`;
};

function generateServerCode({
  code,
  args,
  omitDefaults,
}: {
  code: string;
  args: Record<string, unknown>;
  omitDefaults: Record<string, unknown>;
}): string {
  const props = Object.entries(args)
    .filter(([key, value]) => {
      if (key === 'children' && /\bargs\??\.children\b/.test(code)) {
        return false;
      }
      return !(key in omitDefaults) || !isEqual(value, omitDefaults[key]);
    })
    .map(([key, value]) => argsToProps(key, value))
    .filter(Boolean);
  const spread = props.join(' ').length > 50 ? `\n  ${props.join('\n  ')}\n` : props.join(' ');
  const path = 'args(?:[\\w\\d_$.?[\\]"\\\'])+';
  const pattern = new RegExp(
    `\\{\\.\\.\\.args\\}|="[^"\\n]*"|='[^'\\n]*'|=\\{\\s*(${path})\\s*\\}|\\{\\s*(${path})\\s*\\}|${path}`,
    'g'
  );
  return (spread ? code : code.replace(/[ \t]*\{\.\.\.args\}[ \t]*/g, ' '))
    .replace(pattern, (match, attributePath?: string, textPath?: string) => {
      if (match === '{...args}') return spread;
      if (match.startsWith('="') || match.startsWith("='")) {
        return match.replace(new RegExp(`\\{\\s*(${path})\\s*\\}`, 'g'), (_, argPath: string) => {
          const value = get({ args }, argPath.replaceAll('?', ''));
          return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
        });
      }
      const argPath = attributePath ?? textPath ?? match;
      const value = get({ args }, argPath.replaceAll('?', ''));
      const printed = value === null ? 'null' : (valueToString(value) ?? 'undefined');
      if (attributePath) return `={${printed}}`;
      if (textPath)
        return typeof value === 'string' && !/[{}<>"\\&]/.test(value) ? value : `{${printed}}`;
      return printed;
    })
    .replace(/[ \t]+$/gm, '');
}

export function generateCodeToEmit(params: {
  code: string;
  args: StoryObj['args'];
  omitDefaults?: Record<string, unknown>;
  textSubstitution?: 'raw';
}): string {
  return params.textSubstitution === 'raw'
    ? generateServerCode({
        code: params.code,
        args: params.args ?? {},
        omitDefaults: params.omitDefaults ?? {},
      })
    : generateLegacyCode(params);
}
