export type Framework = 'vue3' | 'angular';

export type ViolationKind =
  | 'lost-arg'
  | 'lost-description'
  | 'lost-default'
  | 'lost-type'
  | 'lost-summary'
  | 'changed-summary'
  | 'lost-required'
  | 'type-fidelity'
  | 'lost-representation'
  | 'changed-root'
  | 'lost-attribute'
  | 'unparsable-candidate';

export interface Violation {
  arg: string;
  kind: ViolationKind;
  message: string;
}
