import React from "react";

export default () => {
  return (
    <div>
      <p>
        <strong>Environment variable from next.config:</strong>{" "}
        {process.env.nextConfigEnv}
      </p>
      <p>
        <strong>Environment variable from .env:</strong>{" "}
        {process.env.NEXT_PUBLIC_EXAMPLE1}
      </p>
      <p>
        <strong>
          Environment variable from .env and not prefixed with NEXT_PUBLIC:
        </strong>{" "}
        {process.env.EXAMPLE2 ?? "RESTRICTED_VALUE"}
      </p>
    </div>
  );
};
