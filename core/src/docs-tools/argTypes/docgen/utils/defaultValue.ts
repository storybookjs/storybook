const BLACKLIST = ['null', 'undefined'];

export function isDefaultValueBlacklisted(value: string): boolean {
  return BLACKLIST.some((x) => x === value);
}
