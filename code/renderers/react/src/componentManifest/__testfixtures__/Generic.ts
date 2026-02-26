interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => string;
  emptyMessage?: string;
}

export function StringList(_props: ListProps<string>) {
  return null;
}

export function NumberList(_props: ListProps<number>) {
  return null;
}
