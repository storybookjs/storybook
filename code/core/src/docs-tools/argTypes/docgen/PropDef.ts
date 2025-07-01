// FIXME: this is legacy code that needs to be updated & simplified with ArgType refactor

export interface JsDocParam {
  name: string | undefined | null;
  description?: string | null;
}

export interface JsDocReturns {
  description?: string | null;
}

export interface JsDocTags {
  params?: JsDocParam[] | null;
  returns?: JsDocReturns | null;
}

export interface PropSummaryValue {
  summary?: string;
  detail?: string;
}

export type PropType = PropSummaryValue;
export type PropDefaultValue = PropSummaryValue;

export interface PropDef {
  name: string;
  type: PropType | null;
  sbType?: any;
  required: boolean;
  description?: string;
  defaultValue?: PropDefaultValue | null;
  jsDocTags?: JsDocTags;
}
