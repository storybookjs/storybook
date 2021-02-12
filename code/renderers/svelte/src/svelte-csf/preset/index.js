export function config(entry = []) {
  return [...entry, require.resolve("./preview")]
}

export function managerEntries(entry = []) {
  return [...entry, require.resolve("./manager")]
}
