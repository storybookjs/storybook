// TODO ?
export interface JsDocParam {
  name: string;
  description?: string;
}

export interface JsDocParamDeprecated {
  deprecated?: string;
}

export interface JsDocReturns {
  description?: string;
}

export interface JsDocTags {
  params?: JsDocParam[];
  deprecated?: JsDocParamDeprecated;
  returns?: JsDocReturns;
}

export interface Args {
  [key: string]: any;
}

export type Globals = { [name: string]: any };
