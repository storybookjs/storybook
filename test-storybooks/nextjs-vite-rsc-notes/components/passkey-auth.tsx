"use client";

import { useEffect, useState } from "react";
import { KeyRoundIcon, PlusIcon } from "#components/icons.tsx";
import { Button } from "#components/ui/button.tsx";
import { authClient } from "#lib/auth-client-passkey.ts";

function isPasskeySupported() {
  return window.isSecureContext && typeof PublicKeyCredential !== "undefined";
}

export function PasskeySignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  async function signInWithPasskey() {
    setError(null);

    if (!passkeySupported) {
      setError("Passkeys aren’t available in this browser. Use email instead.");
      return;
    }

    setPending(true);
    const result = await authClient.signIn.passkey({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/notes";
        },
      },
    });
    setPending(false);

    if (result?.error) {
      setError(result.error.message ?? "Couldn’t sign in with a passkey. Use email instead.");
    }
  }

  if (passkeySupported === false) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-2xl border-border/70 bg-background/60 py-3 text-foreground backdrop-blur hover:bg-muted/70"
        disabled={pending || passkeySupported !== true}
        onClick={() => {
          void signInWithPasskey();
        }}
      >
        <KeyRoundIcon data-icon="inline-start" className="text-brand" />
        {pending
          ? "Waiting for passkey..."
          : passkeySupported === null
            ? "Checking passkey support..."
            : "Sign in with a passkey"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function AddPasskeyButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function addPasskey() {
    setError(null);

    if (!isPasskeySupported()) {
      setError("Passkeys are not available in this browser.");
      return;
    }

    setPending(true);
    const result = await authClient.passkey.addPasskey({
      name: "Primary passkey",
    });
    setPending(false);

    if (result?.error) {
      setError(result.error.message ?? "Could not add passkey.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="w-full rounded-full px-5 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_12px_-6px_oklch(0.32_0.06_70/0.45)] sm:w-auto"
        disabled={pending}
        onClick={() => {
          void addPasskey();
        }}
      >
        <PlusIcon data-icon="inline-start" />
        {pending ? "Waiting for passkey..." : "Add passkey"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
