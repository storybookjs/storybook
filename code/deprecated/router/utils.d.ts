interface StoryData {
  viewMode?: string;
  storyId?: string;
}
interface SeparatorOptions {
  rootSeparator: string | RegExp;
  groupSeparator: string | RegExp;
}
export declare const knownNonViewModesRegex: RegExp;
export declare const sanitize: (string: string) => string;
export declare const toId: (kind: string, name: string) => string;
export declare const parsePath: (path?: string) => StoryData;
interface Query {
  [key: string]: any;
}
export declare const queryFromString: (s: string) => Query;
export declare const queryFromLocation: (location: { search: string }) => Query;
export declare const stringifyQuery: (query: Query) => any;
export declare const getMatch: (
  current: string,
  target: string,
  startsWith?: boolean
) => {
  path: string;
};
export declare const parseKind: (
  kind: string,
  { rootSeparator, groupSeparator }: SeparatorOptions
) => {
  root: string;
  groups: string[];
};
export {};
