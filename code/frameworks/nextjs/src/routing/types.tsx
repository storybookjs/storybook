export type RouteParams = {
  pathname: string;
  query: Record<string, string>;
  [key: string]: any;
};

export type NextAppDirectory = boolean;
