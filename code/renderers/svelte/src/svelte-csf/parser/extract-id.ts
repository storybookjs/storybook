// extract a story id
export function extractId({ id, name }: { id?: string; name?: string }): string {
  if (id) {
    return id;
  }

  return name.replace(/\W+(.)/g, (_, chr) => chr.toUpperCase());
}
