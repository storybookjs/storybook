// Turbopack injection probe — see PROBE-NOTES.md. Phase 1 (bare static
// import, both bundlers) and E1 ('use client' + static import) recorded
// silent elimination. This is the minimal injection that actually ships and
// executes the client script.
import type { ReactNode } from 'react';

import { DevtoolsClient } from './devtools-client.tsx';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <DevtoolsClient />
      </body>
    </html>
  );
}
