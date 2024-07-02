import { ObjectInspector } from '@devtools-ds/object-inspector';
import type { Call, CallRef, ElementRef } from '@storybook/instrumenter';
import { useTheme } from 'storybook/internal/theming';
import type { ReactElement } from 'react';
import React, { Fragment } from 'react';

const colorsLight = {
  base: '#444',
  nullish: '#7D99AA',
  string: '#16B242',
  number: '#5D40D0',
  boolean: '#f41840',
  objectkey: '#698394',
  instance: '#A15C20',
  function: '#EA7509',
  muted: '#7D99AA',
  tag: {
    name: '#6F2CAC',
    suffix: '#1F99E5',
  },
  date: '#459D9C',
  error: {
    name: '#D43900',
    message: '#444',
  },
  regex: {
    source: '#A15C20',
    flags: '#EA7509',
  },
  meta: '#EA7509',
  method: '#0271B6',
};

const colorsDark = {
  base: '#eee',
  nullish: '#aaa',
  string: '#5FE584',
  number: '#6ba5ff',
  boolean: '#ff4191',
  objectkey: '#accfe6',
  instance: '#E3B551',
  function: '#E3B551',
  muted: '#aaa',
  tag: {
    name: '#f57bff',
    suffix: '#8EB5FF',
  },
  date: '#70D4D3',
  error: {
    name: '#f40',
    message: '#eee',
  },
  regex: {
    source: '#FAD483',
    flags: '#E3B551',
  },
  meta: '#FAD483',
  method: '#5EC1FF',
};

const useThemeColors = () => {
  const { base } = useTheme();
  return base === 'dark' ? colorsDark : colorsLight;
};

const special = /[^A-Z0-9]/i;
const trimEnd = /[\s.,…]+$/gm;
const ellipsize = (string: string, maxlength: number): string => {
  if (string.length <= maxlength) return string;
  for (let i = maxlength - 1; i >= 0; i -= 1) {
    if (special.test(string[i]) && i > 10) {
      return `${string.slice(0, i).replace(trimEnd, '')}…`;
    }
  }
  return `${string.slice(0, maxlength).replace(trimEnd, '')}…`;
};

const stringify = (value: any) => {
  try {
    return JSON.stringify(value, null, 1);
  } catch (e) {
    return String(value);
  }
};

const interleave = (nodes: ReactElement[], separator: ReactElement) =>
  nodes.flatMap((node, index) =>
    index === nodes.length - 1
      ? [node]
      : [node, React.cloneElement(separator, { key: `sep${index}` })]
  );

export const Node = ({
  value,
  nested,
  showObjectInspector,
  callsById,
  ...props
}: {
  value: any;
  nested?: boolean;
  /**
   * Shows an object inspector instead of just printing the object.
   * Only available for Objects
   */
  showObjectInspector?: boolean;
  callsById?: Map<Call['id'], Call>;
  [props: string]: any;
}) => {
  switch (true) {
    case value === null:
      return <NullNode {...props} />;
    case value === undefined:
      return <UndefinedNode {...props} />;
    case Array.isArray(value):
      return <ArrayNode {...props} value={value} callsById={callsById} />;
    case typeof value === 'string':
      return <StringNode {...props} value={value} />;
    case typeof value === 'number':
      return <NumberNode {...props} value={value} />;
    case typeof value === 'boolean':
      return <BooleanNode {...props} value={value} />;

    /* eslint-disable no-underscore-dangle */
    case Object.prototype.hasOwnProperty.call(value, '__date__'):
      return <DateNode {...props} {...value.__date__} />;
    case Object.prototype.hasOwnProperty.call(value, '__error__'):
      return <ErrorNode {...props} {...value.__error__} />;
    case Object.prototype.hasOwnProperty.call(value, '__regexp__'):
      return <RegExpNode {...props} {...value.__regexp__} />;
    case Object.prototype.hasOwnProperty.call(value, '__function__'):
      return <FunctionNode {...props} {...value.__function__} />;
    case Object.prototype.hasOwnProperty.call(value, '__symbol__'):
      return <SymbolNode {...props} {...value.__symbol__} />;
    case Object.prototype.hasOwnProperty.call(value, '__element__'):
      return <ElementNode {...props} {...value.__element__} />;
    case Object.prototype.hasOwnProperty.call(value, '__class__'):
      return <ClassNode {...props} {...value.__class__} />;
    case Object.prototype.hasOwnProperty.call(value, '__callId__'):
      return <MethodCall call={callsById.get(value.__callId__)} callsById={callsById} />;
    /* eslint-enable no-underscore-dangle */

    case Object.prototype.toString.call(value) === '[object Object]':
      return (
        <ObjectNode
          value={value}
          showInspector={showObjectInspector}
          callsById={callsById}
          {...props}
        />
      );
    default:
      return <OtherNode value={value} {...props} />;
  }
};

export const NullNode = (props: object) => {
  const colors = useThemeColors();
  return (
    <span style={{ color: colors.nullish }} {...props}>
      null
    </span>
  );
};

export const UndefinedNode = (props: object) => {
  const colors = useThemeColors();
  return (
    <span style={{ color: colors.nullish }} {...props}>
      undefined
    </span>
  );
};

export const StringNode = ({ value, ...props }: { value: string }) => {
  const colors = useThemeColors();
  return (
    <span style={{ color: colors.string }} {...props}>
      {JSON.stringify(ellipsize(value, 50))}
    </span>
  );
};

export const NumberNode = ({ value, ...props }: { value: number }) => {
  const colors = useThemeColors();
  return (
    <span style={{ color: colors.number }} {...props}>
      {value}
    </span>
  );
};

export const BooleanNode = ({ value, ...props }: { value: boolean }) => {
  const colors = useThemeColors();
  return (
    <span style={{ color: colors.boolean }} {...props}>
      {String(value)}
    </span>
  );
};

export const ArrayNode = ({
  value,
  nested = false,
  callsById,
}: {
  value: any[];
  nested?: boolean;
  callsById?: Map<Call['id'], Call>;
}) => {
  const colors = useThemeColors();
  if (nested) {
    return <span style={{ color: colors.base }}>[…]</span>;
  }
  const nodes = value
    .slice(0, 3)
    .map((v) => <Node key={JSON.stringify(v)} value={v} nested callsById={callsById} />);
  const nodelist = interleave(nodes, <span>, </span>);
  if (value.length <= 3) {
    return <span style={{ color: colors.base }}>[{nodelist}]</span>;
  }
  return (
    <span style={{ color: colors.base }}>
      ({value.length}) [{nodelist}, …]
    </span>
  );
};

export const ObjectNode = ({
  showInspector,
  value,
  callsById,
  nested = false,
}: {
  showInspector?: boolean;
  value: object;
  nested?: boolean;
  callsById?: Map<Call['id'], Call>;
}) => {
  const isDarkMode = useTheme().base === 'dark';
  const colors = useThemeColors();

  if (showInspector) {
    return (
      <>
        <ObjectInspector
          id="interactions-object-inspector"
          data={value}
          includePrototypes={false}
          colorScheme={isDarkMode ? 'dark' : 'light'}
        />
      </>
    );
  }

  if (nested) {
    return <span style={{ color: colors.base }}>{'{…}'}</span>;
  }
  const nodelist = interleave(
    Object.entries(value)
      .slice(0, 2)
      .map(([k, v]) => (
        <Fragment key={k}>
          <span style={{ color: colors.objectkey }}>{k}: </span>
          <Node value={v} callsById={callsById} nested />
        </Fragment>
      )),
    <span>, </span>
  );
  if (Object.keys(value).length <= 2) {
    return (
      <span style={{ color: colors.base }}>
        {'{ '}
        {nodelist}
        {' }'}
      </span>
    );
  }
  return (
    <span style={{ color: colors.base }}>
      ({Object.keys(value).length}) {'{ '}
      {nodelist}
      {', … }'}
    </span>
  );
};

export const ClassNode = ({ name }: { name: string }) => {
  const colors = useThemeColors();
  return <span style={{ color: colors.instance }}>{name}</span>;
};

export const FunctionNode = ({ name }: { name: string }) => {
  const colors = useThemeColors();
  return name ? (
    <span style={{ color: colors.function }}>{name}</span>
  ) : (
    <span style={{ color: colors.nullish, fontStyle: 'italic' }}>anonymous</span>
  );
};

export const ElementNode = ({
  prefix,
  localName,
  id,
  classNames = [],
  innerText,
}: ElementRef['__element__']) => {
  const name = prefix ? `${prefix}:${localName}` : localName;
  const colors = useThemeColors();
  return (
    <span style={{ wordBreak: 'keep-all' }}>
      <span key={`${name}_lt`} style={{ color: colors.muted }}>
        &lt;
      </span>
      <span key={`${name}_tag`} style={{ color: colors.tag.name }}>
        {name}
      </span>
      <span key={`${name}_suffix`} style={{ color: colors.tag.suffix }}>
        {id ? `#${id}` : classNames.reduce((acc, className) => `${acc}.${className}`, '')}
      </span>
      <span key={`${name}_gt`} style={{ color: colors.muted }}>
        &gt;
      </span>
      {!id && classNames.length === 0 && innerText && (
        <>
          <span key={`${name}_text`}>{innerText}</span>
          <span key={`${name}_close_lt`} style={{ color: colors.muted }}>
            &lt;
          </span>
          <span key={`${name}_close_tag`} style={{ color: colors.tag.name }}>
            /{name}
          </span>
          <span key={`${name}_close_gt`} style={{ color: colors.muted }}>
            &gt;
          </span>
        </>
      )}
    </span>
  );
};

export const DateNode = ({ value }: { value: string | Date }) => {
  let dateSplit: string[] = [];
  if (value instanceof Date) {
    try {
      dateSplit = value.toISOString().split(/[T.Z]/);
    } catch (error) {
      console.error('Invalid date value provided to DateNode:', value);
      dateSplit = ['Invalid date', '', ''];
    }
  } else {
    dateSplit = value.split(/[T.Z]/);
  }
  const [date, time, ms] = dateSplit;

  const colors = useThemeColors();
  return (
    <span style={{ whiteSpace: 'nowrap', color: colors.date }}>
      {date}
      { date !== 'Invalid date' && (
        <>
          <span style={{ opacity: 0.7 }}>T</span>
          {time === '00:00:00' ? <span style={{ opacity: 0.7 }}>{time}</span> : time}
          {ms === '000' ? <span style={{ opacity: 0.7 }}>.{ms}</span> : `.${ms}`}
          <span style={{ opacity: 0.7 }}>Z</span>
        </>
      )}
    </span>
  );
};

export const ErrorNode = ({ name, message }: { name: string; message: string }) => {
  const colors = useThemeColors();
  return (
    <span style={{ color: colors.error.name }}>
      {name}
      {message && ': '}
      {message && (
        <span style={{ color: colors.error.message }} title={message.length > 50 ? message : ''}>
          {ellipsize(message, 50)}
        </span>
      )}
    </span>
  );
};

export const RegExpNode = ({ flags, source }: { flags: string; source: string }) => {
  const colors = useThemeColors();
  return (
    <span style={{ whiteSpace: 'nowrap', color: colors.regex.flags }}>
      /<span style={{ color: colors.regex.source }}>{source}</span>/{flags}
    </span>
  );
};

export const SymbolNode = ({ description }: { description: string }) => {
  const colors = useThemeColors();
  return (
    <span style={{ whiteSpace: 'nowrap', color: colors.instance }}>
      Symbol(
      {description && <span style={{ color: colors.meta }}>"{description}"</span>})
    </span>
  );
};

export const OtherNode = ({ value }: { value: any }) => {
  const colors = useThemeColors();
  return <span style={{ color: colors.meta }}>{stringify(value)}</span>;
};

export const StepNode = ({ label }: { label: string }) => {
  const colors = useThemeColors();
  const { typography } = useTheme();
  return (
    <span
      style={{
        color: colors.base,
        fontFamily: typography.fonts.base,
        fontSize: typography.size.s2 - 1,
      }}
    >
      {label}
    </span>
  );
};

export const MethodCall = ({
  call,
  callsById,
}: {
  call?: Call;
  callsById: Map<Call['id'], Call>;
}) => {
  // Call might be undefined during initial render, can be safely ignored.
  if (!call) return null;

  if (call.method === 'step' && call.path.length === 0) {
    return <StepNode label={call.args[0]} />;
  }

  const path = call.path.flatMap((elem, index) => {
    // eslint-disable-next-line no-underscore-dangle
    const callId = (elem as CallRef).__callId__;
    return [
      callId ? (
        <MethodCall key={`elem${index}`} call={callsById.get(callId)} callsById={callsById} />
      ) : (
        <span key={`elem${index}`}>{elem as any}</span>
      ),
      <wbr key={`wbr${index}`} />,
      <span key={`dot${index}`}>.</span>,
    ];
  });

  const args = call.args.flatMap((arg, index, array) => {
    const node = <Node key={`node${index}`} value={arg} callsById={callsById} />;
    return index < array.length - 1
      ? [node, <span key={`comma${index}`}>,&nbsp;</span>, <wbr key={`wbr${index}`} />]
      : [node];
  });

  const colors = useThemeColors();
  return (
    <>
      <span style={{ color: colors.base }}>{path}</span>
      <span style={{ color: colors.method }}>{call.method}</span>
      <span style={{ color: colors.base }}>
        (<wbr />
        {args}
        <wbr />)
      </span>
    </>
  );
};
