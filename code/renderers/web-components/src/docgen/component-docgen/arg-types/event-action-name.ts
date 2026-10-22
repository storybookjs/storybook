import { pascalCase } from 'es-toolkit/string';

export function eventActionName(name: string): string {
  return `on${pascalCase(name)}`;
}
