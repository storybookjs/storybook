import React from 'react';

export const StoryContent = ({
  dynamic,
  withPopover,
}: {
  dynamic: boolean;
  withPopover: boolean;
}) => {
  const [extra, setExtra] = React.useState(false);
  React.useEffect(() => {
    if (!dynamic) {
      return;
    }
    const interval = setInterval(() => setExtra((v) => !v), 1200);
    return () => clearInterval(interval);
  }, [dynamic]);

  return (
    <main style={{ minHeight: 1200, minWidth: 1200 }}>
      {withPopover && (
        <>
          {/* @ts-expect-error popover is not yet supported by React */}
          <button popovertarget="my-popover">Open Popover 1</button>
          {/* @ts-expect-error popover is not yet supported by React */}
          <div popover="manual" id="my-popover" style={{ padding: 20 }}>
            Greetings, one and all!
          </div>
        </>
      )}
      <input
        aria-label="Sample input"
        id="input"
        type="text"
        style={{ margin: 20 }}
        defaultValue="input"
      />
      <div id="zeroheight" />
      <div id="zerowidth" style={{ width: 0, margin: 20 }} />
      <div
        id="sticky"
        style={{
          position: 'sticky',
          marginTop: 150,
          top: 0,
          left: 0,
          width: '100%',
          height: 50,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
      <div
        id="fixed"
        style={{
          position: 'fixed',
          top: 300,
          left: 50,
          right: 50,
          height: 150,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
      <div
        id="moving"
        style={{
          position: 'absolute',
          top: 100,
          left: 150,
          width: 150,
          height: 150,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
      <div
        id="scaling"
        style={{
          position: 'absolute',
          top: 50,
          left: '50%',
          width: 200,
          height: 150,
          border: '1px solid black',
          borderRadius: 10,
        }}
      >
        <div
          id="inner"
          style={{
            position: 'absolute',
            top: '25%',
            left: '-1px',
            width: 120,
            height: '50%',
            border: '1px solid black',
            borderRadius: 10,
          }}
        />
      </div>
      <div
        id="overflow"
        style={{
          position: 'absolute',
          top: 100,
          left: 350,
          width: 200,
          height: 150,
          border: '1px solid black',
          overflow: 'auto',
        }}
      >
        <div
          id="child"
          style={{
            margin: 30,
            width: 120,
            height: 200,
            backgroundColor: 'yellow',
          }}
        />
      </div>
      {extra && (
        <div
          id="extra"
          style={{
            position: 'absolute',
            top: 325,
            left: 75,
            width: 300,
            height: 100,
            border: '1px solid black',
            borderRadius: 10,
          }}
        />
      )}
      <div
        id="footer"
        style={{
          position: 'absolute',
          top: 1000,
          left: 10,
          right: 10,
          height: 190,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
    </main>
  );
};
