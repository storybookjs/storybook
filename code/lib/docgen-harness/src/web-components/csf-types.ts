export interface Meta {
  args?: Record<string, unknown>;
  component: string;
  parameters?: Record<string, unknown>;
  render?: (args: Record<string, unknown>) => unknown;
  title: string;
}

export interface Story {
  args?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  render?: (args: Record<string, unknown>) => unknown;
}
