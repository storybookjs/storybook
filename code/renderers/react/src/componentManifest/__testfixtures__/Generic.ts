interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => string;
  emptyMessage?: string;
}

export function StringList(props: ListProps<string>) {
  return null;
}

export function NumberList(props: ListProps<number>) {
  return null;
}
