export interface CustomElementsItem {
  name: string;
  type?: { text?: string } | string;
  description?: string;
  default?: unknown;
  kind?: string;
  defaultValue?: unknown;
}

export interface CustomElementsItemGroups {
  attributes?: CustomElementsItem[];
  properties?: CustomElementsItem[];
  events?: CustomElementsItem[];
  methods?: CustomElementsItem[];
  members?: CustomElementsItem[];
  slots?: CustomElementsItem[];
  cssProperties?: CustomElementsItem[];
  cssParts?: CustomElementsItem[];
}

export interface CustomElementsDeclaration extends CustomElementsItemGroups {
  [key: string]: unknown;
}

export interface CustomElementDefinitionExport {
  kind?: string;
  name?: string;
  declaration?: {
    name?: string;
    module?: string;
  };
}

export interface CustomElementsModule {
  path?: string;
  declarations?: CustomElementsDeclaration[];
  exports?: CustomElementDefinitionExport[];
}

export interface CustomElementsManifest {
  modules: CustomElementsModule[];
  [key: string]: unknown;
}
