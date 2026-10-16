export function ext(language: 'ts' | 'js', jsx: boolean): string {
  if (language === 'ts') {
    return jsx ? 'tsx' : 'ts';
  }
  return jsx ? 'jsx' : 'js';
}
