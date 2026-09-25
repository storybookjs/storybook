export function eventActionName(name: string): string {
  const camelName = name
    .replace(/(-|_|:|\.|\s)+(.)?/g, (_match, _separator, chr: string) =>
      chr ? chr.toUpperCase() : ''
    )
    .replace(/^([A-Z])/, (match) => match.toLowerCase());

  return `on${camelName.charAt(0).toUpperCase() + camelName.slice(1)}`;
}
