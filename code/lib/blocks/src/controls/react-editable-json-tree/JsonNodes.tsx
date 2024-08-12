/* eslint-disable react/no-direct-mutation-state */

/* eslint-disable react/sort-comp */
import type { ReactElement } from 'react';
import React, { Component, cloneElement } from 'react';

import * as dataTypes from './types/dataTypes';
import * as deltaTypes from './types/deltaTypes';
import * as inputUsageTypes from './types/inputUsageTypes';
import { getObjectType, isComponentWillChange } from './utils/objectTypes';

interface JsonAddValueState {
  inputRefKey: any;
  inputRefValue: any;
}

export class JsonAddValue extends Component<JsonAddValueProps, JsonAddValueState> {
  constructor(props: JsonAddValueProps) {
    super(props);
    this.state = {
      inputRefKey: null,
      inputRefValue: null,
    };
    // Bind
    this.refInputValue = this.refInputValue.bind(this);
    this.refInputKey = this.refInputKey.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
  }

  componentDidMount() {
    const { inputRefKey, inputRefValue } = this.state;
    const { onlyValue } = this.props;

    if (inputRefKey && typeof inputRefKey.focus === 'function') {
      inputRefKey.focus();
    }

    if (onlyValue && inputRefValue && typeof inputRefValue.focus === 'function') {
      inputRefValue.focus();
    }

    document.addEventListener('keydown', this.onKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeydown);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    if (event.code === 'Enter' || event.key === 'Enter') {
      event.preventDefault();
      this.onSubmit();
    }
    if (event.code === 'Escape' || event.key === 'Escape') {
      event.preventDefault();
      this.props.handleCancel();
    }
  }

  onSubmit() {
    const { handleAdd, onlyValue, onSubmitValueParser, keyPath, deep } = this.props;
    const { inputRefKey, inputRefValue } = this.state;
    const result: any = {};
    // Check if we have the key
    if (!onlyValue) {
      // Check that there is a key
      if (!inputRefKey.value) {
        // Empty key => Not authorized
        return;
      }

      result.key = inputRefKey.value;
    }
    result.newValue = onSubmitValueParser(false, keyPath, deep, result.key, inputRefValue.value);
    handleAdd(result);
  }

  refInputKey(node: any) {
    // @ts-expect-error (Converted from ts-ignore)
    this.state.inputRefKey = node;
  }

  refInputValue(node: any) {
    // @ts-expect-error (Converted from ts-ignore)
    this.state.inputRefValue = node;
  }

  render() {
    const {
      handleCancel,
      onlyValue,
      addButtonElement,
      cancelButtonElement,
      inputElementGenerator,
      keyPath,
      deep,
    } = this.props;
    const addButtonElementLayout = cloneElement(addButtonElement, {
      onClick: this.onSubmit,
    });
    const cancelButtonElementLayout = cloneElement(cancelButtonElement, {
      onClick: handleCancel,
    });
    const inputElementValue = inputElementGenerator(inputUsageTypes.VALUE, keyPath, deep);
    const inputElementValueLayout = cloneElement(inputElementValue, {
      placeholder: 'Value',
      ref: this.refInputValue,
    });
    let inputElementKeyLayout = null;

    if (!onlyValue) {
      const inputElementKey = inputElementGenerator(inputUsageTypes.KEY, keyPath, deep);
      inputElementKeyLayout = cloneElement(inputElementKey, {
        placeholder: 'Key',
        ref: this.refInputKey,
      });
    }

    return (
      <span className="rejt-add-value-node">
        {inputElementKeyLayout}
        {inputElementValueLayout}
        {cancelButtonElementLayout}
        {addButtonElementLayout}
      </span>
    );
  }
}

interface JsonAddValueProps {
  handleAdd: (...args: any) => any;
  handleCancel: (...args: any) => any;
  onlyValue?: boolean;
  addButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  inputElementGenerator: (...args: any) => any;
  keyPath?: string[];
  deep?: number;
  onSubmitValueParser: (...args: any) => any;
}

// @ts-expect-error (Converted from ts-ignore)
JsonAddValue.defaultProps = {
  onlyValue: false,
  addButtonElement: <button>+</button>,
  cancelButtonElement: <button>c</button>,
};

interface JsonArrayState {
  data: JsonArrayProps['data'];
  name: JsonArrayProps['name'];
  keyPath: string[];
  deep: JsonArrayProps['deep'];
  nextDeep: JsonArrayProps['deep'];
  collapsed: any;
  addFormVisible: boolean;
}
export class JsonArray extends Component<JsonArrayProps, JsonArrayState> {
  constructor(props: JsonArrayProps) {
    super(props);
    const keyPath = [...props.keyPath, props.name];
    this.state = {
      data: props.data,
      name: props.name,
      keyPath,
      deep: props.deep,
      nextDeep: props.deep + 1,
      collapsed: props.isCollapsed(keyPath, props.deep, props.data),
      addFormVisible: false,
    };

    // Bind
    this.handleCollapseMode = this.handleCollapseMode.bind(this);
    this.handleRemoveItem = this.handleRemoveItem.bind(this);
    this.handleAddMode = this.handleAddMode.bind(this);
    this.handleAddValueAdd = this.handleAddValueAdd.bind(this);
    this.handleAddValueCancel = this.handleAddValueCancel.bind(this);
    this.handleEditValue = this.handleEditValue.bind(this);
    this.onChildUpdate = this.onChildUpdate.bind(this);
    this.renderCollapsed = this.renderCollapsed.bind(this);
    this.renderNotCollapsed = this.renderNotCollapsed.bind(this);
  }

  static getDerivedStateFromProps(props: JsonArrayProps, state: JsonArrayState) {
    return props.data !== state.data ? { data: props.data } : null;
  }

  onChildUpdate(childKey: string, childData: any) {
    const { data, keyPath } = this.state;
    // Update data
    // @ts-expect-error (Converted from ts-ignore)
    data[childKey] = childData;
    // Put new data
    this.setState({
      data,
    });
    // Spread
    const { onUpdate } = this.props;
    const size = keyPath.length;
    onUpdate(keyPath[size - 1], data);
  }

  handleAddMode() {
    this.setState({
      addFormVisible: true,
    });
  }

  handleCollapseMode() {
    this.setState((state) => ({
      collapsed: !state.collapsed,
    }));
  }

  handleRemoveItem(index: number) {
    return () => {
      const { beforeRemoveAction, logger } = this.props;
      const { data, keyPath, nextDeep: deep } = this.state;
      const oldValue = data[index];

      // Before Remove Action
      beforeRemoveAction(index, keyPath, deep, oldValue)
        .then(() => {
          const deltaUpdateResult = {
            keyPath,
            deep,
            key: index,
            oldValue,
            type: deltaTypes.REMOVE_DELTA_TYPE,
          };

          data.splice(index, 1);
          this.setState({ data });

          // Spread new update
          const { onUpdate, onDeltaUpdate } = this.props;
          onUpdate(keyPath[keyPath.length - 1], data);
          // Spread delta update
          onDeltaUpdate(deltaUpdateResult);
        })
        .catch(logger.error);
    };
  }

  handleAddValueAdd({ newValue }: any) {
    const { data, keyPath, nextDeep: deep } = this.state;
    const { beforeAddAction, logger } = this.props;

    beforeAddAction(data.length, keyPath, deep, newValue)
      .then(() => {
        // Update data
        const newData = [...data, newValue];
        this.setState({
          data: newData,
        });
        // Cancel add to close
        this.handleAddValueCancel();
        // Spread new update
        const { onUpdate, onDeltaUpdate } = this.props;
        onUpdate(keyPath[keyPath.length - 1], newData);
        // Spread delta update
        onDeltaUpdate({
          type: deltaTypes.ADD_DELTA_TYPE,
          keyPath,
          deep,
          key: newData.length - 1,
          newValue,
        });
      })
      .catch(logger.error);
  }

  handleAddValueCancel() {
    this.setState({
      addFormVisible: false,
    });
  }

  handleEditValue({ key, value }: any) {
    return new Promise((resolve, reject) => {
      const { beforeUpdateAction } = this.props;
      const { data, keyPath, nextDeep: deep } = this.state;

      // Old value
      const oldValue = data[key];

      // Before update action
      beforeUpdateAction(key, keyPath, deep, oldValue, value)
        .then(() => {
          // Update value
          data[key] = value;
          // Set state
          this.setState({
            data,
          });
          // Spread new update
          const { onUpdate, onDeltaUpdate } = this.props;
          onUpdate(keyPath[keyPath.length - 1], data);
          // Spread delta update
          onDeltaUpdate({
            type: deltaTypes.UPDATE_DELTA_TYPE,
            keyPath,
            deep,
            key,
            newValue: value,
            oldValue,
          });
          // Resolve
          resolve(undefined);
        })
        .catch(reject);
    });
  }

  renderCollapsed() {
    const { name, data, keyPath, deep } = this.state;
    const { handleRemove, readOnly, getStyle, dataType, minusMenuElement } = this.props;
    const { minus, collapsed } = getStyle(name, data, keyPath, deep, dataType);

    const isReadOnly = readOnly(name, data, keyPath, deep, dataType);

    const removeItemButton = cloneElement(minusMenuElement, {
      onClick: handleRemove,
      className: 'rejt-minus-menu',
      style: minus,
    });

    return (
      <span className="rejt-collapsed">
        <span className="rejt-collapsed-text" style={collapsed} onClick={this.handleCollapseMode}>
          [...] {data.length} {data.length === 1 ? 'item' : 'items'}
        </span>
        {!isReadOnly && removeItemButton}
      </span>
    );
  }

  renderNotCollapsed() {
    const { name, data, keyPath, deep, addFormVisible, nextDeep } = this.state;
    const {
      isCollapsed,
      handleRemove,
      onDeltaUpdate,
      readOnly,
      getStyle,
      dataType,
      addButtonElement,
      cancelButtonElement,
      editButtonElement,
      inputElementGenerator,
      textareaElementGenerator,
      minusMenuElement,
      plusMenuElement,
      beforeRemoveAction,
      beforeAddAction,
      beforeUpdateAction,
      logger,
      onSubmitValueParser,
    } = this.props;
    const { minus, plus, delimiter, ul, addForm } = getStyle(name, data, keyPath, deep, dataType);

    const isReadOnly = readOnly(name, data, keyPath, deep, dataType);

    const addItemButton = cloneElement(plusMenuElement, {
      onClick: this.handleAddMode,
      className: 'rejt-plus-menu',
      style: plus,
    });
    const removeItemButton = cloneElement(minusMenuElement, {
      onClick: handleRemove,
      className: 'rejt-minus-menu',
      style: minus,
    });

    const onlyValue = true;
    const startObject = '[';
    const endObject = ']';
    return (
      <span className="rejt-not-collapsed">
        <span className="rejt-not-collapsed-delimiter" style={delimiter}>
          {startObject}
        </span>
        {!addFormVisible && addItemButton}
        <ul className="rejt-not-collapsed-list" style={ul}>
          {data.map((item, index) => (
            <JsonNode
              key={index}
              name={index.toString()}
              data={item}
              keyPath={keyPath}
              deep={nextDeep}
              isCollapsed={isCollapsed}
              handleRemove={this.handleRemoveItem(index)}
              handleUpdateValue={this.handleEditValue}
              onUpdate={this.onChildUpdate}
              onDeltaUpdate={onDeltaUpdate}
              readOnly={readOnly}
              getStyle={getStyle}
              addButtonElement={addButtonElement}
              cancelButtonElement={cancelButtonElement}
              editButtonElement={editButtonElement}
              inputElementGenerator={inputElementGenerator}
              textareaElementGenerator={textareaElementGenerator}
              minusMenuElement={minusMenuElement}
              plusMenuElement={plusMenuElement}
              beforeRemoveAction={beforeRemoveAction}
              beforeAddAction={beforeAddAction}
              beforeUpdateAction={beforeUpdateAction}
              logger={logger}
              onSubmitValueParser={onSubmitValueParser}
            />
          ))}
        </ul>
        {!isReadOnly && addFormVisible && (
          <div className="rejt-add-form" style={addForm}>
            <JsonAddValue
              handleAdd={this.handleAddValueAdd}
              handleCancel={this.handleAddValueCancel}
              onlyValue={onlyValue}
              addButtonElement={addButtonElement}
              cancelButtonElement={cancelButtonElement}
              inputElementGenerator={inputElementGenerator}
              keyPath={keyPath}
              deep={deep}
              onSubmitValueParser={onSubmitValueParser}
            />
          </div>
        )}
        <span className="rejt-not-collapsed-delimiter" style={delimiter}>
          {endObject}
        </span>
        {!isReadOnly && removeItemButton}
      </span>
    );
  }

  render() {
    const { name, collapsed, data, keyPath, deep } = this.state;
    const { dataType, getStyle } = this.props;
    const value = collapsed ? this.renderCollapsed() : this.renderNotCollapsed();
    const style = getStyle(name, data, keyPath, deep, dataType);

    return (
      <div className="rejt-array-node">
        <span onClick={this.handleCollapseMode}>
          <span className="rejt-name" style={style.name}>
            {name} :{' '}
          </span>
        </span>
        {value}
      </div>
    );
  }
}

interface JsonArrayProps {
  data: any[];
  name: string;
  isCollapsed: (...args: any) => any;
  keyPath?: string[];
  deep?: number;
  handleRemove?: (...args: any) => any;
  onUpdate: (...args: any) => any;
  onDeltaUpdate: (...args: any) => any;
  readOnly: (...args: any) => any;
  dataType?: string;
  getStyle: (...args: any) => any;
  addButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  editButtonElement?: ReactElement;
  inputElementGenerator: (...args: any) => any;
  textareaElementGenerator: (...args: any) => any;
  minusMenuElement?: ReactElement;
  plusMenuElement?: ReactElement;
  beforeRemoveAction?: (...args: any) => any;
  beforeAddAction?: (...args: any) => any;
  beforeUpdateAction?: (...args: any) => any;
  logger: any;
  onSubmitValueParser: (...args: any) => any;
}

// @ts-expect-error (Converted from ts-ignore)
JsonArray.defaultProps = {
  keyPath: [],
  deep: 0,
  minusMenuElement: <span> - </span>,
  plusMenuElement: <span> + </span>,
};

interface JsonFunctionValueState {
  value: JsonFunctionValueProps['value'];
  name: JsonFunctionValueProps['name'];
  keyPath: string[];
  deep: JsonFunctionValueProps['deep'];
  editEnabled: boolean;
  inputRef: any;
}

export class JsonFunctionValue extends Component<JsonFunctionValueProps, JsonFunctionValueState> {
  constructor(props: JsonFunctionValueProps) {
    super(props);
    const keyPath = [...props.keyPath, props.name];
    this.state = {
      value: props.value,
      name: props.name,
      keyPath,
      deep: props.deep,
      editEnabled: false,
      inputRef: null,
    };

    // Bind
    this.handleEditMode = this.handleEditMode.bind(this);
    this.refInput = this.refInput.bind(this);
    this.handleCancelEdit = this.handleCancelEdit.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
  }

  static getDerivedStateFromProps(props: JsonFunctionValueProps, state: JsonFunctionValueState) {
    return props.value !== state.value ? { value: props.value } : null;
  }

  componentDidUpdate() {
    const { editEnabled, inputRef, name, value, keyPath, deep } = this.state;
    const { readOnly, dataType } = this.props;
    const readOnlyResult = readOnly(name, value, keyPath, deep, dataType);

    if (editEnabled && !readOnlyResult && typeof inputRef.focus === 'function') {
      inputRef.focus();
    }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeydown);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    if (event.code === 'Enter' || event.key === 'Enter') {
      event.preventDefault();
      this.handleEdit();
    }
    if (event.code === 'Escape' || event.key === 'Escape') {
      event.preventDefault();
      this.handleCancelEdit();
    }
  }

  handleEdit() {
    const { handleUpdateValue, originalValue, logger, onSubmitValueParser, keyPath } = this.props;
    const { inputRef, name, deep } = this.state;
    if (!inputRef) return;

    const newValue = onSubmitValueParser(true, keyPath, deep, name, inputRef.value);

    const result = {
      value: newValue,
      key: name,
    };

    // Run update
    handleUpdateValue(result)
      .then(() => {
        // Cancel edit mode if necessary
        if (!isComponentWillChange(originalValue, newValue)) {
          this.handleCancelEdit();
        }
      })
      .catch(logger.error);
  }

  handleEditMode() {
    this.setState({
      editEnabled: true,
    });
  }

  refInput(node: any) {
    // @ts-expect-error (Converted from ts-ignore)
    this.state.inputRef = node;
  }

  handleCancelEdit() {
    this.setState({
      editEnabled: false,
    });
  }

  render() {
    const { name, value, editEnabled, keyPath, deep } = this.state;
    const {
      handleRemove,
      originalValue,
      readOnly,
      dataType,
      getStyle,
      editButtonElement,
      cancelButtonElement,
      textareaElementGenerator,
      minusMenuElement,
      keyPath: comeFromKeyPath,
    } = this.props;

    const style = getStyle(name, originalValue, keyPath, deep, dataType);
    let result = null;
    let minusElement = null;
    const resultOnlyResult = readOnly(name, originalValue, keyPath, deep, dataType);

    if (editEnabled && !resultOnlyResult) {
      const textareaElement = textareaElementGenerator(
        inputUsageTypes.VALUE,
        comeFromKeyPath,
        deep,
        name,
        originalValue,
        dataType
      );

      const editButtonElementLayout = cloneElement(editButtonElement, {
        onClick: this.handleEdit,
      });
      const cancelButtonElementLayout = cloneElement(cancelButtonElement, {
        onClick: this.handleCancelEdit,
      });
      const textareaElementLayout = cloneElement(textareaElement, {
        ref: this.refInput,
        defaultValue: originalValue,
      });

      result = (
        <span className="rejt-edit-form" style={style.editForm}>
          {textareaElementLayout} {cancelButtonElementLayout}
          {editButtonElementLayout}
        </span>
      );
      minusElement = null;
    } else {
      result = (
        <span
          className="rejt-value"
          style={style.value}
          onClick={resultOnlyResult ? null : this.handleEditMode}
        >
          {value}
        </span>
      );
      const minusMenuLayout = cloneElement(minusMenuElement, {
        onClick: handleRemove,
        className: 'rejt-minus-menu',
        style: style.minus,
      });
      minusElement = resultOnlyResult ? null : minusMenuLayout;
    }

    return (
      <li className="rejt-function-value-node" style={style.li}>
        <span className="rejt-name" style={style.name}>
          {name} :{' '}
        </span>
        {result}
        {minusElement}
      </li>
    );
  }
}

interface JsonFunctionValueProps {
  name: string;
  value: any;
  originalValue?: any;
  keyPath?: string[];
  deep?: number;
  handleRemove?: (...args: any) => any;
  handleUpdateValue?: (...args: any) => any;
  readOnly: (...args: any) => any;
  dataType?: string;
  getStyle: (...args: any) => any;
  editButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  textareaElementGenerator: (...args: any) => any;
  minusMenuElement?: ReactElement;
  logger: any;
  onSubmitValueParser: (...args: any) => any;
}

// @ts-expect-error (Converted from ts-ignore)
JsonFunctionValue.defaultProps = {
  keyPath: [],
  deep: 0,
  handleUpdateValue: () => {},
  editButtonElement: <button>e</button>,
  cancelButtonElement: <button>c</button>,
  minusMenuElement: <span> - </span>,
};

interface JsonNodeState {
  data: JsonNodeProps['data'];
  name: JsonNodeProps['name'];
  keyPath: JsonNodeProps['keyPath'];
  deep: JsonNodeProps['deep'];
}

export class JsonNode extends Component<JsonNodeProps, JsonNodeState> {
  constructor(props: JsonNodeProps) {
    super(props);
    this.state = {
      data: props.data,
      name: props.name,
      keyPath: props.keyPath,
      deep: props.deep,
    };
  }

  static getDerivedStateFromProps(props: JsonNodeProps, state: JsonNodeState) {
    return props.data !== state.data ? { data: props.data } : null;
  }

  render() {
    const { data, name, keyPath, deep } = this.state;
    const {
      isCollapsed,
      handleRemove,
      handleUpdateValue,
      onUpdate,
      onDeltaUpdate,
      readOnly,
      getStyle,
      addButtonElement,
      cancelButtonElement,
      editButtonElement,
      inputElementGenerator,
      textareaElementGenerator,
      minusMenuElement,
      plusMenuElement,
      beforeRemoveAction,
      beforeAddAction,
      beforeUpdateAction,
      logger,
      onSubmitValueParser,
    } = this.props;
    const readOnlyTrue = () => true;

    const dataType = getObjectType(data);
    switch (dataType) {
      case dataTypes.ERROR:
        return (
          <JsonObject
            data={data}
            name={name}
            isCollapsed={isCollapsed}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            onUpdate={onUpdate}
            onDeltaUpdate={onDeltaUpdate}
            readOnly={readOnlyTrue}
            dataType={dataType}
            getStyle={getStyle}
            addButtonElement={addButtonElement}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            textareaElementGenerator={textareaElementGenerator}
            minusMenuElement={minusMenuElement}
            plusMenuElement={plusMenuElement}
            beforeRemoveAction={beforeRemoveAction}
            beforeAddAction={beforeAddAction}
            beforeUpdateAction={beforeUpdateAction}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.OBJECT:
        return (
          <JsonObject
            data={data}
            name={name}
            isCollapsed={isCollapsed}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            onUpdate={onUpdate}
            onDeltaUpdate={onDeltaUpdate}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            addButtonElement={addButtonElement}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            textareaElementGenerator={textareaElementGenerator}
            minusMenuElement={minusMenuElement}
            plusMenuElement={plusMenuElement}
            beforeRemoveAction={beforeRemoveAction}
            beforeAddAction={beforeAddAction}
            beforeUpdateAction={beforeUpdateAction}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.ARRAY:
        return (
          <JsonArray
            data={data}
            name={name}
            isCollapsed={isCollapsed}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            onUpdate={onUpdate}
            onDeltaUpdate={onDeltaUpdate}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            addButtonElement={addButtonElement}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            textareaElementGenerator={textareaElementGenerator}
            minusMenuElement={minusMenuElement}
            plusMenuElement={plusMenuElement}
            beforeRemoveAction={beforeRemoveAction}
            beforeAddAction={beforeAddAction}
            beforeUpdateAction={beforeUpdateAction}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.STRING:
        return (
          <JsonValue
            name={name}
            value={`"${data}"`}
            originalValue={data}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.NUMBER:
        return (
          <JsonValue
            name={name}
            value={data}
            originalValue={data}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.BOOLEAN:
        return (
          <JsonValue
            name={name}
            value={data ? 'true' : 'false'}
            originalValue={data}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.DATE:
        return (
          <JsonValue
            name={name}
            value={data.toISOString()}
            originalValue={data}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnlyTrue}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.NULL:
        return (
          <JsonValue
            name={name}
            value="null"
            originalValue="null"
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.UNDEFINED:
        return (
          <JsonValue
            name={name}
            value="undefined"
            originalValue="undefined"
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.FUNCTION:
        return (
          <JsonFunctionValue
            name={name}
            value={data.toString()}
            originalValue={data}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnly}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            textareaElementGenerator={textareaElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      case dataTypes.SYMBOL:
        return (
          <JsonValue
            name={name}
            value={data.toString()}
            originalValue={data}
            keyPath={keyPath}
            deep={deep}
            handleRemove={handleRemove}
            handleUpdateValue={handleUpdateValue}
            readOnly={readOnlyTrue}
            dataType={dataType}
            getStyle={getStyle}
            cancelButtonElement={cancelButtonElement}
            editButtonElement={editButtonElement}
            inputElementGenerator={inputElementGenerator}
            minusMenuElement={minusMenuElement}
            logger={logger}
            onSubmitValueParser={onSubmitValueParser}
          />
        );
      default:
        return null;
    }
  }
}

interface JsonNodeProps {
  name: string;
  data?: any;
  isCollapsed: (...args: any) => any;
  keyPath?: string[];
  deep?: number;
  handleRemove?: (...args: any) => any;
  handleUpdateValue?: (...args: any) => any;
  onUpdate: (...args: any) => any;
  onDeltaUpdate: (...args: any) => any;
  readOnly: (...args: any) => any;
  getStyle: (...args: any) => any;
  addButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  editButtonElement?: ReactElement;
  inputElementGenerator: (...args: any) => any;
  textareaElementGenerator: (...args: any) => any;
  minusMenuElement?: ReactElement;
  plusMenuElement?: ReactElement;
  beforeRemoveAction?: (...args: any) => any;
  beforeAddAction?: (...args: any) => any;
  beforeUpdateAction?: (...args: any) => any;
  logger: object;
  onSubmitValueParser: (...args: any) => any;
}

/// @ts-expect-error (Converted from ts-ignore)
JsonNode.defaultProps = {
  keyPath: [],
  deep: 0,
};

interface JsonObjectState {
  name: string;
  collapsed: ReturnType<JsonObjectProps['isCollapsed']>;
  data: JsonObjectProps['data'];
  keyPath: JsonObjectProps['keyPath'];
  deep: JsonObjectProps['deep'];
  nextDeep: number;
  addFormVisible: boolean;
}

export class JsonObject extends Component<JsonObjectProps, JsonObjectState> {
  constructor(props: JsonObjectProps) {
    super(props);
    const keyPath = props.deep === -1 ? [] : [...props.keyPath, props.name];
    this.state = {
      name: props.name,
      data: props.data,
      keyPath,
      deep: props.deep,
      nextDeep: props.deep + 1,
      collapsed: props.isCollapsed(keyPath, props.deep, props.data),
      addFormVisible: false,
    };

    // Bind
    this.handleCollapseMode = this.handleCollapseMode.bind(this);
    this.handleRemoveValue = this.handleRemoveValue.bind(this);
    this.handleAddMode = this.handleAddMode.bind(this);
    this.handleAddValueAdd = this.handleAddValueAdd.bind(this);
    this.handleAddValueCancel = this.handleAddValueCancel.bind(this);
    this.handleEditValue = this.handleEditValue.bind(this);
    this.onChildUpdate = this.onChildUpdate.bind(this);
    this.renderCollapsed = this.renderCollapsed.bind(this);
    this.renderNotCollapsed = this.renderNotCollapsed.bind(this);
  }

  static getDerivedStateFromProps(props: JsonObjectProps, state: JsonObjectState) {
    return props.data !== state.data ? { data: props.data } : null;
  }

  onChildUpdate(childKey: string, childData: any) {
    const { data, keyPath } = this.state;
    // Update data
    data[childKey] = childData;
    // Put new data
    this.setState({
      data,
    });
    // Spread
    const { onUpdate } = this.props;
    const size = keyPath.length;
    onUpdate(keyPath[size - 1], data);
  }

  handleAddMode() {
    this.setState({
      addFormVisible: true,
    });
  }

  handleAddValueCancel() {
    this.setState({
      addFormVisible: false,
    });
  }

  handleAddValueAdd({ key, newValue }: any) {
    const { data, keyPath, nextDeep: deep } = this.state;
    const { beforeAddAction, logger } = this.props;

    beforeAddAction(key, keyPath, deep, newValue)
      .then(() => {
        // Update data
        data[key] = newValue;
        this.setState({
          data,
        });
        // Cancel add to close
        this.handleAddValueCancel();
        // Spread new update
        const { onUpdate, onDeltaUpdate } = this.props;
        onUpdate(keyPath[keyPath.length - 1], data);
        // Spread delta update
        onDeltaUpdate({
          type: deltaTypes.ADD_DELTA_TYPE,
          keyPath,
          deep,
          key,
          newValue,
        });
      })
      .catch(logger.error);
  }

  handleRemoveValue(key: string) {
    return () => {
      const { beforeRemoveAction, logger } = this.props;
      const { data, keyPath, nextDeep: deep } = this.state;
      const oldValue = data[key];
      // Before Remove Action
      beforeRemoveAction(key, keyPath, deep, oldValue)
        .then(() => {
          const deltaUpdateResult = {
            keyPath,
            deep,
            key,
            oldValue,
            type: deltaTypes.REMOVE_DELTA_TYPE,
          };

          delete data[key];
          this.setState({ data });

          // Spread new update
          const { onUpdate, onDeltaUpdate } = this.props;
          onUpdate(keyPath[keyPath.length - 1], data);
          // Spread delta update
          onDeltaUpdate(deltaUpdateResult);
        })
        .catch(logger.error);
    };
  }

  handleCollapseMode() {
    this.setState((state) => ({
      collapsed: !state.collapsed,
    }));
  }

  handleEditValue({ key, value }: any) {
    return new Promise<void>((resolve, reject) => {
      const { beforeUpdateAction } = this.props;
      const { data, keyPath, nextDeep: deep } = this.state;

      // Old value
      const oldValue = data[key];

      // Before update action
      beforeUpdateAction(key, keyPath, deep, oldValue, value)
        .then(() => {
          // Update value
          data[key] = value;
          // Set state
          this.setState({
            data,
          });
          // Spread new update
          const { onUpdate, onDeltaUpdate } = this.props;
          onUpdate(keyPath[keyPath.length - 1], data);
          // Spread delta update
          onDeltaUpdate({
            type: deltaTypes.UPDATE_DELTA_TYPE,
            keyPath,
            deep,
            key,
            newValue: value,
            oldValue,
          });
          // Resolve
          resolve();
        })
        .catch(reject);
    });
  }

  renderCollapsed() {
    const { name, keyPath, deep, data } = this.state;
    const { handleRemove, readOnly, dataType, getStyle, minusMenuElement } = this.props;

    const { minus, collapsed } = getStyle(name, data, keyPath, deep, dataType);
    const keyList = Object.getOwnPropertyNames(data);

    const isReadOnly = readOnly(name, data, keyPath, deep, dataType);

    const removeItemButton = cloneElement(minusMenuElement, {
      onClick: handleRemove,
      className: 'rejt-minus-menu',
      style: minus,
    });

    return (
      <span className="rejt-collapsed">
        <span className="rejt-collapsed-text" style={collapsed} onClick={this.handleCollapseMode}>
          {'{...}'} {keyList.length} {keyList.length === 1 ? 'key' : 'keys'}
        </span>
        {!isReadOnly && removeItemButton}
      </span>
    );
  }

  renderNotCollapsed() {
    const { name, data, keyPath, deep, nextDeep, addFormVisible } = this.state;
    const {
      isCollapsed,
      handleRemove,
      onDeltaUpdate,
      readOnly,
      getStyle,
      dataType,
      addButtonElement,
      cancelButtonElement,
      editButtonElement,
      inputElementGenerator,
      textareaElementGenerator,
      minusMenuElement,
      plusMenuElement,
      beforeRemoveAction,
      beforeAddAction,
      beforeUpdateAction,
      logger,
      onSubmitValueParser,
    } = this.props;

    const { minus, plus, addForm, ul, delimiter } = getStyle(name, data, keyPath, deep, dataType);
    const keyList = Object.getOwnPropertyNames(data);

    const isReadOnly = readOnly(name, data, keyPath, deep, dataType);

    const addItemButton = cloneElement(plusMenuElement, {
      onClick: this.handleAddMode,
      className: 'rejt-plus-menu',
      style: plus,
    });
    const removeItemButton = cloneElement(minusMenuElement, {
      onClick: handleRemove,
      className: 'rejt-minus-menu',
      style: minus,
    });

    const list = keyList.map((key) => (
      <JsonNode
        key={key}
        name={key}
        data={data[key]}
        keyPath={keyPath}
        deep={nextDeep}
        isCollapsed={isCollapsed}
        handleRemove={this.handleRemoveValue(key)}
        handleUpdateValue={this.handleEditValue}
        onUpdate={this.onChildUpdate}
        onDeltaUpdate={onDeltaUpdate}
        readOnly={readOnly}
        getStyle={getStyle}
        addButtonElement={addButtonElement}
        cancelButtonElement={cancelButtonElement}
        editButtonElement={editButtonElement}
        inputElementGenerator={inputElementGenerator}
        textareaElementGenerator={textareaElementGenerator}
        minusMenuElement={minusMenuElement}
        plusMenuElement={plusMenuElement}
        beforeRemoveAction={beforeRemoveAction}
        beforeAddAction={beforeAddAction}
        beforeUpdateAction={beforeUpdateAction}
        logger={logger}
        onSubmitValueParser={onSubmitValueParser}
      />
    ));

    const startObject = '{';
    const endObject = '}';

    return (
      <span className="rejt-not-collapsed">
        <span className="rejt-not-collapsed-delimiter" style={delimiter}>
          {startObject}
        </span>
        {!isReadOnly && addItemButton}
        <ul className="rejt-not-collapsed-list" style={ul}>
          {list}
        </ul>
        {!isReadOnly && addFormVisible && (
          <div className="rejt-add-form" style={addForm}>
            <JsonAddValue
              handleAdd={this.handleAddValueAdd}
              handleCancel={this.handleAddValueCancel}
              addButtonElement={addButtonElement}
              cancelButtonElement={cancelButtonElement}
              inputElementGenerator={inputElementGenerator}
              keyPath={keyPath}
              deep={deep}
              onSubmitValueParser={onSubmitValueParser}
            />
          </div>
        )}
        <span className="rejt-not-collapsed-delimiter" style={delimiter}>
          {endObject}
        </span>
        {!isReadOnly && removeItemButton}
      </span>
    );
  }

  render() {
    const { name, collapsed, data, keyPath, deep } = this.state;
    const { getStyle, dataType } = this.props;
    const value = collapsed ? this.renderCollapsed() : this.renderNotCollapsed();
    const style = getStyle(name, data, keyPath, deep, dataType);

    return (
      <div className="rejt-object-node">
        <span onClick={this.handleCollapseMode}>
          <span className="rejt-name" style={style.name}>
            {name} :{' '}
          </span>
        </span>
        {value}
      </div>
    );
  }
}

interface JsonObjectProps {
  data: Record<string, any>;
  name: string;
  isCollapsed: (...args: any) => any;
  keyPath?: string[];
  deep?: number;
  handleRemove?: (...args: any) => any;
  onUpdate: (...args: any) => any;
  onDeltaUpdate: (...args: any) => any;
  readOnly: (...args: any) => any;
  dataType?: string;
  getStyle: (...args: any) => any;
  addButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  editButtonElement?: ReactElement;
  inputElementGenerator: (...args: any) => any;
  textareaElementGenerator: (...args: any) => any;
  minusMenuElement?: ReactElement;
  plusMenuElement?: ReactElement;
  beforeRemoveAction?: (...args: any) => any;
  beforeAddAction?: (...args: any) => any;
  beforeUpdateAction?: (...args: any) => any;
  logger: any;
  onSubmitValueParser: (...args: any) => any;
}

// @ts-expect-error (Converted from ts-ignore)
JsonObject.defaultProps = {
  keyPath: [],
  deep: 0,
  minusMenuElement: <span> - </span>,
  plusMenuElement: <span> + </span>,
};

interface JsonValueState {
  value: JsonValueProps['value'];
  name: JsonValueProps['name'];
  keyPath: string[];
  deep: JsonValueProps['deep'];
  editEnabled: boolean;
  inputRef: any;
}

export class JsonValue extends Component<JsonValueProps, JsonValueState> {
  constructor(props: JsonValueProps) {
    super(props);
    const keyPath = [...props.keyPath, props.name];
    this.state = {
      value: props.value,
      name: props.name,
      keyPath,
      deep: props.deep,
      editEnabled: false,
      inputRef: null,
    };

    // Bind
    this.handleEditMode = this.handleEditMode.bind(this);
    this.refInput = this.refInput.bind(this);
    this.handleCancelEdit = this.handleCancelEdit.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
  }

  static getDerivedStateFromProps(props: JsonValueProps, state: JsonValueState) {
    return props.value !== state.value ? { value: props.value } : null;
  }

  componentDidUpdate() {
    const { editEnabled, inputRef, name, value, keyPath, deep } = this.state;
    const { readOnly, dataType } = this.props;
    const isReadOnly = readOnly(name, value, keyPath, deep, dataType);

    if (editEnabled && !isReadOnly && typeof inputRef.focus === 'function') {
      inputRef.focus();
    }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeydown);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    if (event.code === 'Enter' || event.key === 'Enter') {
      event.preventDefault();
      this.handleEdit();
    }
    if (event.code === 'Escape' || event.key === 'Escape') {
      event.preventDefault();
      this.handleCancelEdit();
    }
  }

  handleEdit() {
    const { handleUpdateValue, originalValue, logger, onSubmitValueParser, keyPath } = this.props;
    const { inputRef, name, deep } = this.state;
    if (!inputRef) return;

    const newValue = onSubmitValueParser(true, keyPath, deep, name, inputRef.value);

    const result = {
      value: newValue,
      key: name,
    };

    // Run update
    handleUpdateValue(result)
      .then(() => {
        // Cancel edit mode if necessary
        if (!isComponentWillChange(originalValue, newValue)) {
          this.handleCancelEdit();
        }
      })
      .catch(logger.error);
  }

  handleEditMode() {
    this.setState({
      editEnabled: true,
    });
  }

  refInput(node: any) {
    // @ts-expect-error (Converted from ts-ignore)
    this.state.inputRef = node;
  }

  handleCancelEdit() {
    this.setState({
      editEnabled: false,
    });
  }

  render() {
    const { name, value, editEnabled, keyPath, deep } = this.state;
    const {
      handleRemove,
      originalValue,
      readOnly,
      dataType,
      getStyle,
      editButtonElement,
      cancelButtonElement,
      inputElementGenerator,
      minusMenuElement,
      keyPath: comeFromKeyPath,
    } = this.props;

    const style = getStyle(name, originalValue, keyPath, deep, dataType);
    const isReadOnly = readOnly(name, originalValue, keyPath, deep, dataType);
    const isEditing = editEnabled && !isReadOnly;
    const inputElement = inputElementGenerator(
      inputUsageTypes.VALUE,
      comeFromKeyPath,
      deep,
      name,
      originalValue,
      dataType
    );

    const editButtonElementLayout = cloneElement(editButtonElement, {
      onClick: this.handleEdit,
    });
    const cancelButtonElementLayout = cloneElement(cancelButtonElement, {
      onClick: this.handleCancelEdit,
    });
    const inputElementLayout = cloneElement(inputElement, {
      ref: this.refInput,
      defaultValue: JSON.stringify(originalValue),
    });
    const minusMenuLayout = cloneElement(minusMenuElement, {
      onClick: handleRemove,
      className: 'rejt-minus-menu',
      style: style.minus,
    });

    return (
      <li className="rejt-value-node" style={style.li}>
        <span className="rejt-name" style={style.name}>
          {name}
          {' : '}
        </span>
        {isEditing ? (
          <span className="rejt-edit-form" style={style.editForm}>
            {inputElementLayout} {cancelButtonElementLayout}
            {editButtonElementLayout}
          </span>
        ) : (
          <span
            className="rejt-value"
            style={style.value}
            onClick={isReadOnly ? null : this.handleEditMode}
          >
            {String(value)}
          </span>
        )}
        {!isReadOnly && !isEditing && minusMenuLayout}
      </li>
    );
  }
}

interface JsonValueProps {
  name: string;
  value: any;
  originalValue?: any;
  keyPath?: string[];
  deep?: number;
  handleRemove?: (...args: any) => any;
  handleUpdateValue?: (...args: any) => any;
  readOnly: (...args: any) => any;
  dataType?: string;
  getStyle: (...args: any) => any;
  editButtonElement?: ReactElement;
  cancelButtonElement?: ReactElement;
  inputElementGenerator: (...args: any) => any;
  minusMenuElement?: ReactElement;
  logger: any;
  onSubmitValueParser: (...args: any) => any;
}

// @ts-expect-error (Converted from ts-ignore)
JsonValue.defaultProps = {
  keyPath: [],
  deep: 0,
  handleUpdateValue: () => Promise.resolve(),
  editButtonElement: <button>e</button>,
  cancelButtonElement: <button>c</button>,
  minusMenuElement: <span> - </span>,
};
