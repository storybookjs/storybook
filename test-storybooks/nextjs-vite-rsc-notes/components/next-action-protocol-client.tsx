"use client";

import { useState } from "react";

type ServerAction = () => Promise<unknown>;

export function NextActionProtocolClient({
  defaultRedirectAction,
  notFoundAction,
  redirectAction,
  throwAction,
}: {
  defaultRedirectAction: ServerAction;
  notFoundAction: ServerAction;
  redirectAction: ServerAction;
  throwAction: ServerAction;
}) {
  const [status, setStatus] = useState("idle");

  async function run(label: string, action: ServerAction) {
    try {
      await action();
      setStatus(`${label}: resolved`);
    } catch (error) {
      setStatus(`${label}: ${error instanceof Error ? error.message : "caught"}`);
    }
  }

  return (
    <div>
      <p>action protocol status: {status}</p>
      <button onClick={() => run("default redirect", defaultRedirectAction)}>
        Capture default redirect action
      </button>
      <button onClick={() => run("redirect", redirectAction)}>Capture redirect action</button>
      <button onClick={() => run("not-found", notFoundAction)}>Capture not-found action</button>
      <button onClick={() => run("throw", throwAction)}>Capture throw action</button>
    </div>
  );
}
