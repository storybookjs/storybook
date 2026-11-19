/** A user of the component. */
export interface User {
  /** The display name. */
  name: string;
  age: number;
}

export interface TreeNode {
  parent?: TreeNode;
  label: string;
}

export enum Color {
  Red = 'red',
  Green = 'green',
}

export type ScalarId = string;

export type PanelConfig = { collapsed: boolean };
