import { camelCase, upperFirst } from 'es-toolkit/compat';

export const sanitizeName = (name: string) => {
  let key = upperFirst(camelCase(name));
  // prepend _ if name starts with a digit
  if (/^\d/.test(key)) {
    key = `_${key}`;
  }
  // prepend _ if name starts with a digit
  if (/^\d/.test(key)) {
    key = `_${key}`;
  }
  return key;
};

export function jscodeshiftToPrettierParser(parser?: string) {
  const parserMap: Record<string, string> = {
    babylon: 'babel',
    flow: 'flow',
    ts: 'typescript',
    tsx: 'typescript',
  };

  if (!parser) {
    return 'babel';
  }
  return parserMap[parser] || 'babel';
}
