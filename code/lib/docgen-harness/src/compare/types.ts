export type Framework = 'vue3' | 'angular';

export type ViolationKind =
  | 'lost-arg'
  | 'lost-description'
  | 'lost-default'
  | 'lost-type'
  | 'type-fidelity'
  | 'lost-representation';

export interface Violation {
  arg: string;
  kind: ViolationKind;
  message: string;
}
