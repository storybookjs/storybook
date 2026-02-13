type Base = {
  id: string;
  createdAt: Date;
};

type WithMeta = {
  tags: string[];
  archived?: boolean;
};

type ItemProps = Base &
  WithMeta & {
    title: string;
    onSave: () => Promise<void>;
  };

export function Item(props: ItemProps) {
  return null;
}
