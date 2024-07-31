/**
 * Mimicking the satisfies operator until we can upgrade to TS4.9
 */
export function satisfies<A>() {
  return <T extends A>(x: T) => x;
}
