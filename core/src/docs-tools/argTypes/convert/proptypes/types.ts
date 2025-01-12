interface PTBaseType {
  name: string;
  description?: string;
  required?: boolean;
}

export type PTType = PTBaseType & {
  value?: any;
  raw?: string;
  computed?: boolean;
};
