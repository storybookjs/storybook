// WebContainerRunner.tsx
import React, { useEffect, useState } from 'react';

import { WebContainer } from '@webcontainer/api';

export function WebContainerRunner() {
  const [logs, setLogs] = useState<string[]>([]);
  const [containerReady, setContainerReady] = useState(false);
  const [iframeURL, setIframeURL] = useState<string>('');

  useEffect(() => {
    const setup = async () => {
      const webcontainerInstance = await WebContainer.boot();

      // For demonstration, let's create a small package.json for a React project
      const files = {
        'package.json': {
          file: {
            contents: JSON.stringify({
              name: 'webcontainer-react-example',
              scripts: {
                start: 'react-scripts start',
                build: 'react-scripts build',
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                'react-scripts': 'latest',
              },
            }),
          },
        },
        src: { directory: {} },
        'src/index.js': {
          file: {
            contents: `
              import React from 'react';
              import ReactDOM from 'react-dom';
              import os from 'node:os';


              function App() {
                return <>
                  <h1>Hello from WebContainers in the browser!</h1>;
                  <h2>The OS of the webcontainer is {os.type()} (THIS INFO IS COMING FROM Node.js backend)</h2>
                </>
              }
              ReactDOM.render(<App />, document.getElementById('root'));
            `,
          },
        },
        public: { directory: {} },
        'public/index.html': {
          file: {
            contents: `
              <!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="utf-8"/>
                  <title>WebContainers React Example</title>
                </head>
                <body>
                  <div id="root"></div>
                </body>
              </html>
            `,
          },
        },
      };

      // Write these files to the in-memory filesystem
      await webcontainerInstance.mount(files);

      // Install dependencies
      const installProcess = await webcontainerInstance.spawn('npm', ['install']);
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            setLogs((prev) => [...prev, data]);
          },
        })
      );
      await installProcess.exit;

      // Start the dev server
      const startProcess = await webcontainerInstance.spawn('npm', ['start']);
      startProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            setLogs((prev) => [...prev, data]);
          },
        })
      );

      // Wait for dev server to be up (create a port mapping)
      webcontainerInstance.on('server-ready', (port, url) => {
        // This event fires when the server is listening on a given port
        setIframeURL(url);
        setContainerReady(true);
      });
    };

    setup();
  }, []);

  return (
    <div>
      <h3>WebContainer React App</h3>
      <div>
        <strong>Status:</strong> {containerReady ? 'Running!' : 'Starting...'}
      </div>
      {containerReady && iframeURL && (
        <iframe
          src={iframeURL}
          style={{ width: '100%', height: '400px', border: '1px solid #ccc' }}
          title="WebContainer React App"
          allow="cross-origin-isolated"
        />
      )}
      <pre>{logs.join('')}</pre>
    </div>
  );
}
