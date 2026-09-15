import type { ReactNode } from 'react';

export interface ItemProps {
  item: string;
  itemTemplate: (item: string) => ReactNode;
}

// Nested shape: Item is rendered by List and takes a function prop — the
// flagged/degradation case for story generation.
export function Item({ item, itemTemplate }: ItemProps) {
  return <li>{itemTemplate(item)}</li>;
}

export interface ListProps {
  items: string[];
  itemTemplate: (item: string) => ReactNode;
}

export function List({ items, itemTemplate }: ListProps) {
  return (
    <ul>
      {items.map((item) => (
        <Item key={item} item={item} itemTemplate={itemTemplate} />
      ))}
    </ul>
  );
}
