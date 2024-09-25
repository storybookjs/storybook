import type { ReactElement } from 'react';
import React, { Component } from 'react';

import { JsonNode } from './JsonNodes';
import * as DATA_TYPES from './types/dataTypes';
import { ADD_DELTA_TYPE, REMOVE_DELTA_TYPE, UPDATE_DELTA_TYPE } from './types/deltaTypes';
import * as INPUT_USAGE_TYPES from './types/inputUsageTypes';
import { getObjectType } from './utils/objectTypes';
import { parse } from './utils/parse';
import { array, object, value } from './utils/styles';

interface JsonTreeState {
  data: JsonTreeProps['data'];
  rootName: JsonTreeProps['rootName'];
}
export class JsonTree extends Component<JsonTreeProps, JsonTreeState> {
  constructor(props: JsonTreeProps) {
    super(props);
    this.state = {
      data: props.data,
      rootName: props.rootName,
    };
    // Bind
    this.onUpdate = this.onUpdate.bind(this);
    this.removeRoot = this.removeRoot.bind(this);
  }

  static getDerivedStateFromProps(props: JsonTreeProps, state: JsonTreeState) {
    if (props.data !== state.data || props.rootName !== state.rootName) {
      return {
        data: props.data,
        rootName: props.rootName,
      };
    }
    return null;
  }

  onUpdate(key: string, data: any) {
    this.setState({ data });
    this.props.onFullyUpdate(data);
  }

  removeRoot() {
    this.onUpdate(null, null);
  }

  render() {
    const { data, rootName } = this.state;
    const {
      isCollapsed,
      onDeltaUpdate,
      readOnly,
      getStyle,
      addButtonElement,
      cancelButtonElement,
      editButtonElement,
      inputElement,
      textareaElement,
      minusMenuElement,
      plusMenuElement,
      beforeRemoveAction,
      beforeAddAction,
      beforeUpdateAction,
      logger,
      onSubmitValueParser,
      fallback = null,
    } = this.props;

    // Node type
    const dataType = getObjectType(data);

    let readOnlyFunction = readOnly;
    if (getObjectType(readOnly) === 'Boolean') {
      readOnlyFunction = () => readOnly;
    }
    let inputElementFunction = inputElement;
    if (inputElement && getObjectType(inputElement) !== 'Function') {
      // @ts-expect-error (Converted from ts-ignore)
      inputElementFunction = () => inputElement;
    }
    let textareaElementFunction = textareaElement;
    if (textareaElement && getObjectType(textareaElement) !== 'Function') {
      // @ts-expect-error (Converted from ts-ignore)
      textareaElementFunction = () => textareaElement;
    }

    if (dataType === 'Object' || dataType === 'Array') {
      return (
        <div className="rejt-tree">
          <JsonNode
            data={data}
            name={rootName}
            deep={-1}
            isCollapsed={isCollapsed}
            onUpdate={this.onUpdate}
            onDeltaUpdate={onDeltaUpdate}
            readOnly={readOnlyFunction as (...args: any) => any}
            getStyle={getStyle}
            addButtonElement={addButtonElement}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementFunction as (...args: any) => any}
            textareaElementGenerator={textareaElementFunction as (...args: any) => any}
            minusMenuElement={minusMenuElement}
            plusMenuElement={plusMenuElement}
            handleRemove={this.removeRoot}
            beforeRemoveAction={beforeRemoveAction}
            beforeAddAction={beforeAddAction}
            beforeUpdateAction={beforeUpdateAction}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        </div>
      );
    }

    return fallback;
  }
}

interface JsonTreeProps {
  data: any;
  rootName?: string;
  isCollapsed?: (...args: any) => any;
  onFullyUpdate?: (...args: any) => any;
  onDeltaUpdate?: (...args: any) => any;
  readOnly?: boolean | ((...args: any) => any);
  getStyle?: (...args: any) => any;
  addButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  editButtonElement?: ReactElement;
  inputElement?: ReactElement | ((...args: any) => ReactElement);
  textareaElement?: ReactElement | ((...args: any) => ReactElement);
  minusMenuElement?: ReactElement;
  plusMenuElement?: ReactElement;
  fallback?: ReactElement;
  beforeRemoveAction?: (...args: any) => Promise<any>;
  beforeAddAction?: (...args: any) => Promise<any>;
  beforeUpdateAction?: (...args: any) => any;
  logger?: object;
  onSubmitValueParser?: (...args: any) => any;
}

// @ts-expect-error (Converted from ts-ignore)
JsonTree.defaultProps = {
  rootName: 'root',
  isCollapsed: (keyPath, deep) => deep !== -1,
  getStyle: (keyName, data, keyPath, deep, dataType) => {
    switch (dataType) {
      case 'Object':
      case 'Error':
        return object;
      case 'Array':
        return array;
      default:
        return value;
    }
  },
  readOnly: () => false,
  onFullyUpdate: () => {},
  onDeltaUpdate: () => {},
  beforeRemoveAction: () => Promise.resolve(),
  beforeAddAction: () => Promise.resolve(),
  beforeUpdateAction: () => Promise.resolve(),
  logger: { error: () => {} },
  onSubmitValueParser: (isEditMode, keyPath, deep, name, rawValue) => parse(rawValue),
  inputElement: () => <input />,
  textareaElement: () => <textarea />,
  fallback: null,
} as Partial<JsonTreeProps>;

export {
  getObjectType,
  ADD_DELTA_TYPE,
  REMOVE_DELTA_TYPE,
  UPDATE_DELTA_TYPE,
  DATA_TYPES,
  INPUT_USAGE_TYPES,
};
