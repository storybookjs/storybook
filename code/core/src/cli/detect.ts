import * as find from 'empathic/find';

// TODO: Remove in SB11
export async function detectPnp() {
  return !!find.any(['.pnp.js', '.pnp.cjs']);
}
