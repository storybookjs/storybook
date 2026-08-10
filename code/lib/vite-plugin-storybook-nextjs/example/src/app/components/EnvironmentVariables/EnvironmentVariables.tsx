import React from "react";

export default () => {
  return (
    <div>
      <p>
        <strong>Environment variable from next.config:</strong>{" "}
        <span data-testid="nextConfigEnv">{process.env.nextConfigEnv}</span>
      </p>
      <p>
        <strong>Environment variable from .env:</strong>{" "}
        <span data-testid="nextPrefixEnv">
          {process.env.NEXT_PUBLIC_EXAMPLE1}
        </span>
      </p>
      <p>
        <strong>
          Environment variable from .env and not prefixed with NEXT_PUBLIC:
        </strong>{" "}
        <span data-testid="nonNextPrefixEnv">
          {process.env.EXAMPLE2 ?? "RESTRICTED_VALUE"}
        </span>
      </p>
    </div>
  );
};
