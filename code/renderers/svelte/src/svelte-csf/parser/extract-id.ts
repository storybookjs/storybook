// extract a story id
export function extractId({ id, name }: { id?: string; name?: string }): string {
  if (id) {
    return id;
  }

  return name.replaceAll(/[^a-zA-Z0-9_]/g, '_');
}
